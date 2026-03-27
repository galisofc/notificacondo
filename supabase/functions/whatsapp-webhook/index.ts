import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetaWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile?: { name?: string };
        wa_id?: string;
        user_id?: string;
      }>;
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id?: string;
        recipient_user_id?: string;
        user_id?: string;
        errors?: Array<{
          code: number;
          title: string;
          message?: string;
        }>;
        conversation?: {
          id: string;
          origin?: { type: string };
          expiration_timestamp?: string;
        };
        pricing?: {
          billable: boolean;
          pricing_model: string;
          category: string;
        };
      }>;
    };
    field: string;
  }>;
}

interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

function normalizeMetaStatus(status: string): string {
  const statusMap: Record<string, string> = {
    accepted: "accepted",
    sent: "sent",
    delivered: "delivered",
    read: "read",
    failed: "failed",
  };
  return statusMap[status.toLowerCase()] || status.toLowerCase();
}

function formatErrors(errors: Array<{ code: number; title: string; message?: string }>): string {
  return errors.map(e => `[${e.code}] ${e.title}${e.message ? ': ' + e.message : ''}`).join(' | ');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET — Webhook verification with token validation
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    const hubToken = url.searchParams.get("hub.verify_token");
    const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");

    if (mode === "subscribe" && challenge && hubToken && hubToken === verifyToken) {
      console.log("[WEBHOOK] Verification request accepted");
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    console.warn("[WEBHOOK] Verification rejected - invalid or missing token");
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: MetaWebhookPayload = await req.json();
    console.log("[WEBHOOK] Received:", JSON.stringify(payload).substring(0, 500));

    // Save raw payload
    const { data: rawLog } = await supabase
      .from("webhook_raw_logs")
      .insert({ payload, source: "meta" })
      .select("id")
      .single();

    const rawLogId = rawLog?.id;

    if (payload.object !== "whatsapp_business_account") {
      console.log("[WEBHOOK] Ignoring non-WhatsApp payload:", payload.object);
      return new Response(
        JSON.stringify({ success: true, message: "Not a WhatsApp event" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalUpdated = 0;
    let totalBsuidsCapured = 0;
    let totalStatuses = 0;
    let totalErrors = 0;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue;

        const statuses = change.value.statuses || [];
        totalStatuses += statuses.length;

        const contacts = change.value.contacts || [];
        const contactBsuid = contacts.length > 0 ? contacts[0].user_id : null;
        const contactWaId = contacts.length > 0 ? contacts[0].wa_id : null;

        for (const status of statuses) {
          const messageId = status.id;
          const normalizedStatus = normalizeMetaStatus(status.status);
          const recipientPhone = status.recipient_id || contactWaId;
          const bsuid = status.user_id || status.recipient_user_id || contactBsuid;
          const hasErrors = status.errors && status.errors.length > 0;
          const errorText = hasErrors ? formatErrors(status.errors!) : null;

          console.log(`[WEBHOOK] Status: ${status.status} -> ${normalizedStatus} | msgId: ${messageId} | phone: ${recipientPhone} | bsuid: ${bsuid || "none"}${hasErrors ? ' | ERRORS: ' + errorText : ''}`);

          // Build update for notifications_sent
          const now = new Date().toISOString();
          const updateData: Record<string, unknown> = {
            zpro_status: normalizedStatus,
          };

          // Backfill: always set current + all earlier timestamps
          if (normalizedStatus === "accepted") {
            updateData.accepted_at = now;
          } else if (normalizedStatus === "sent") {
            updateData.accepted_at = now;
          } else if (normalizedStatus === "delivered") {
            updateData.accepted_at = now;
            updateData.delivered_at = now;
          } else if (normalizedStatus === "read") {
            updateData.accepted_at = now;
            updateData.delivered_at = now;
            updateData.read_at = now;
          }

          const { data, error } = await supabase
            .from("notifications_sent")
            .update(updateData)
            .eq("zpro_message_id", messageId)
            .select("id");

          if (error) {
            console.error(`[WEBHOOK] Error updating notification:`, error);
          } else {
            totalUpdated += data?.length || 0;
          }

          // Build update for whatsapp_notification_logs
          const logUpdate: Record<string, unknown> = { status: normalizedStatus };
          // Backfill: set current + all earlier timestamps to ensure consistency
          if (normalizedStatus === "accepted") {
            logUpdate.accepted_at = now;
          } else if (normalizedStatus === "sent") {
            logUpdate.accepted_at = now;
            logUpdate.sent_at = now;
          } else if (normalizedStatus === "delivered") {
            logUpdate.accepted_at = now;
            logUpdate.sent_at = now;
            logUpdate.delivered_at = now;
          } else if (normalizedStatus === "read") {
            logUpdate.accepted_at = now;
            logUpdate.sent_at = now;
            logUpdate.delivered_at = now;
            logUpdate.read_at = now;
          }

          if (errorText) {
            logUpdate.error_message = errorText;
            totalErrors++;
          }

          await supabase
            .from("whatsapp_notification_logs")
            .update(logUpdate)
            .eq("message_id", messageId);

          // Capture BSUID if present
          if (bsuid && recipientPhone) {
            const cleanPhone = recipientPhone.replace(/\D/g, "");
            const phoneVariants = [cleanPhone];
            if (cleanPhone.startsWith("55")) {
              phoneVariants.push(cleanPhone.substring(2));
            }

            for (const phoneVar of phoneVariants) {
              const { data: residents, error: findError } = await supabase
                .from("residents")
                .select("id, bsuid")
                .or(`phone.like.%${phoneVar}`)
                .is("bsuid", null)
                .limit(5);

              if (!findError && residents && residents.length > 0) {
                for (const resident of residents) {
                  const { error: updateError } = await supabase
                    .from("residents")
                    .update({ bsuid })
                    .eq("id", resident.id);

                  if (!updateError) {
                    totalBsuidsCapured++;
                    console.log(`[WEBHOOK] BSUID captured for resident ${resident.id}: ${bsuid}`);
                  }
                }
                break;
              }
            }
          }
        }
      }
    }

    // Update raw log with counters
    if (rawLogId) {
      await supabase
        .from("webhook_raw_logs")
        .update({
          statuses_count: totalStatuses,
          bsuids_captured: totalBsuidsCapured,
          notifications_updated: totalUpdated,
        })
        .eq("id", rawLogId);
    }

    console.log(`[WEBHOOK] Processing complete: ${totalUpdated} notifications updated, ${totalBsuidsCapured} BSUIDs captured, ${totalErrors} errors saved`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: totalUpdated,
        bsuids_captured: totalBsuidsCapured,
        errors_saved: totalErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[WEBHOOK] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationToSync {
  id: string;
  zpro_message_id: string | null;
  zpro_status: string | null;
  delivered_at: string | null;
  read_at: string | null;
  sent_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting notification status sync...");

    // Find notifications that need status sync:
    // 1. Has zpro_status = 'sent' but no delivered_at (might have been delivered but webhook missed)
    // 2. Has delivered_at but zpro_status is still 'sent' (sync zpro_status with timestamp)
    // 3. Has read_at but zpro_status is not 'read' (sync zpro_status with timestamp)
    const { data: notifications, error: fetchError } = await supabase
      .from("notifications_sent")
      .select("id, zpro_message_id, zpro_status, delivered_at, read_at, sent_at")
      .or("zpro_status.eq.sent,zpro_status.is.null")
      .order("sent_at", { ascending: false })
      .limit(100);

    if (fetchError) {
      console.error("Error fetching notifications:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedNotifications = notifications as NotificationToSync[];
    console.log(`Found ${typedNotifications.length} notifications to check`);

    let synced = 0;
    const updates: { id: string; from: string | null; to: string }[] = [];

    for (const notification of typedNotifications) {
      let newStatus: string | null = null;
      const updateData: Record<string, unknown> = {};

      // Determine the correct status based on timestamps
      if (notification.read_at) {
        // If read_at is set, status should be "read"
        if (notification.zpro_status !== "read") {
          newStatus = "read";
          updateData.zpro_status = "read";
          // Ensure delivered_at is also set if read
          if (!notification.delivered_at) {
            updateData.delivered_at = notification.read_at;
          }
        }
      } else if (notification.delivered_at) {
        // If delivered_at is set but not read, status should be "delivered"
        if (notification.zpro_status !== "delivered" && notification.zpro_status !== "read") {
          newStatus = "delivered";
          updateData.zpro_status = "delivered";
        }
      }

      // If we have updates to make
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from("notifications_sent")
          .update(updateData)
          .eq("id", notification.id);

        if (updateError) {
          console.error(`Error updating notification ${notification.id}:`, updateError);
        } else {
          synced++;
          updates.push({
            id: notification.id,
            from: notification.zpro_status,
            to: newStatus || notification.zpro_status || "unknown",
          });
          console.log(`Synced notification ${notification.id}: ${notification.zpro_status} -> ${newStatus}`);
        }
      }
    }

    console.log(`Sync complete. Updated ${synced} notifications.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída`,
        checked: typedNotifications.length,
        synced,
        updates,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

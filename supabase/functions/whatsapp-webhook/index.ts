import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ZProWebhookPayload {
  messageId?: string;
  status?: string;
  timestamp?: number;
  // Z-API format
  id?: string;
  momment?: string;
  // Evolution API format
  key?: {
    remoteJid?: string;
    id?: string;
  };
  update?: string;
  // WPPConnect format
  ack?: number;
  from?: string;
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

    const payload: ZProWebhookPayload = await req.json();
    console.log("Webhook received:", JSON.stringify(payload));

    // Normalize message ID and status from different providers
    let messageId: string | null = null;
    let status: string | null = null;
    let deliveredAt: string | null = null;
    let readAt: string | null = null;

    // Z-PRO format
    if (payload.messageId && payload.status) {
      messageId = payload.messageId;
      status = normalizeStatus(payload.status);
      console.log(`Z-PRO format detected - messageId: ${messageId}, status: ${status}`);
    }
    // Z-API format
    else if (payload.id && payload.status) {
      messageId = payload.id;
      status = normalizeStatus(payload.status);
      console.log(`Z-API format detected - messageId: ${messageId}, status: ${status}`);
    }
    // Evolution API format
    else if (payload.key?.id && payload.update) {
      messageId = payload.key.id;
      status = normalizeStatus(payload.update);
      console.log(`Evolution API format detected - messageId: ${messageId}, status: ${status}`);
    }
    // WPPConnect format (uses ack numbers)
    else if (payload.ack !== undefined) {
      // WPPConnect doesn't send messageId in webhook, need to handle differently
      status = normalizeWPPConnectAck(payload.ack);
      console.log(`WPPConnect format detected - ack: ${payload.ack}, status: ${status}`);
    }

    if (!messageId) {
      console.log("No message ID found in payload, skipping update");
      return new Response(
        JSON.stringify({ success: true, message: "No message ID to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set timestamps based on status
    const now = new Date().toISOString();
    if (status === "delivered") {
      deliveredAt = now;
    } else if (status === "read") {
      readAt = now;
      deliveredAt = now; // If read, it was also delivered
    }

    // Update notification record
    const updateData: Record<string, unknown> = {
      zpro_status: status,
    };

    if (deliveredAt) {
      updateData.delivered_at = deliveredAt;
    }
    if (readAt) {
      updateData.read_at = readAt;
    }

    const { data, error } = await supabase
      .from("notifications_sent")
      .update(updateData)
      .eq("zpro_message_id", messageId)
      .select();

    if (error) {
      console.error("Error updating notification:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Notification updated successfully:`, data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Status updated",
        messageId,
        status,
        updated: data?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function normalizeStatus(status: string): string {
  const statusLower = status.toLowerCase();
  
  // Map various status names to normalized values
  const statusMap: Record<string, string> = {
    // Sent statuses
    "sent": "sent",
    "enviado": "sent",
    "server": "sent",
    
    // Delivered statuses
    "delivered": "delivered",
    "entregue": "delivered",
    "received": "delivered",
    "recebido": "delivered",
    
    // Read statuses
    "read": "read",
    "lido": "read",
    "viewed": "read",
    "visualizado": "read",
    
    // Failed statuses
    "failed": "failed",
    "erro": "failed",
    "error": "failed",
    "falha": "failed",
    
    // Pending statuses
    "pending": "pending",
    "pendente": "pending",
    "queued": "pending",
  };

  return statusMap[statusLower] || statusLower;
}

function normalizeWPPConnectAck(ack: number): string {
  // WPPConnect ack values:
  // -1 = Error
  // 0 = Pending
  // 1 = Sent
  // 2 = Received/Delivered
  // 3 = Read
  // 4 = Played (for audio)
  const ackMap: Record<number, string> = {
    [-1]: "failed",
    0: "pending",
    1: "sent",
    2: "delivered",
    3: "read",
    4: "read",
  };

  return ackMap[ack] || "unknown";
}

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProviderConfig {
  sendMessage: (config: WhatsAppConfig, phone: string, message: string) => Promise<{ messageId?: string; error?: string }>;
}

interface WhatsAppConfig {
  api_url: string;
  api_key: string;
  instance_id: string;
  provider: string;
}

const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("55")) {
    return cleaned;
  }
  return `55${cleaned}`;
};

const providers: Record<string, ProviderConfig> = {
  zpro: {
    async sendMessage(config, phone, message) {
      const formattedPhone = formatPhoneNumber(phone);
      const response = await fetch(`${config.api_url}/instances/${config.instance_id}/token/${config.api_key}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formattedPhone,
          message,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        return { error: result.message || "Erro ao enviar mensagem via Z-PRO" };
      }
      return { messageId: result.messageId || result.id };
    },
  },
  zapi: {
    async sendMessage(config, phone, message) {
      const formattedPhone = formatPhoneNumber(phone);
      const response = await fetch(`${config.api_url}/instances/${config.instance_id}/token/${config.api_key}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formattedPhone,
          message,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        return { error: result.message || "Erro ao enviar mensagem via Z-API" };
      }
      return { messageId: result.messageId || result.zapiMessageId };
    },
  },
  evolution: {
    async sendMessage(config, phone, message) {
      const formattedPhone = formatPhoneNumber(phone);
      const response = await fetch(`${config.api_url}/message/sendText/${config.instance_id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.api_key,
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: message,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        return { error: result.message || "Erro ao enviar mensagem via Evolution" };
      }
      return { messageId: result.key?.id };
    },
  },
  wppconnect: {
    async sendMessage(config, phone, message) {
      const formattedPhone = formatPhoneNumber(phone);
      const response = await fetch(`${config.api_url}/api/${config.instance_id}/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.api_key}`,
        },
        body: JSON.stringify({
          phone: formattedPhone,
          message,
          isGroup: false,
        }),
      });

      const result = await response.json();
      if (!response.ok || result.status === "error") {
        return { error: result.message || "Erro ao enviar mensagem via WPPConnect" };
      }
      return { messageId: result.id };
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { bookingId, notificationType = "reminder" } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: "bookingId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Valid notification types: "reminder", "cancelled"
    const validTypes = ["reminder", "cancelled"];
    if (!validTypes.includes(notificationType)) {
      return new Response(
        JSON.stringify({ error: `Invalid notificationType. Valid types: ${validTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch booking with related data
    const { data: booking, error: bookingError } = await supabase
      .from("party_hall_bookings")
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        condominium_id,
        resident:residents!inner(
          id,
          full_name,
          phone,
          email
        ),
        party_hall_setting:party_hall_settings!inner(
          name
        ),
        condominium:condominiums!inner(
          id,
          name,
          owner_id
        )
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("Booking fetch error:", bookingError);
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check authorization
    const condo = booking.condominium as any;
    const resident = booking.resident as any;
    const hallSetting = booking.party_hall_setting as any;
    const isOwner = condo.owner_id === user.id;
    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .single();

    if (!isOwner && !roleCheck) {
      return new Response(
        JSON.stringify({ error: "Unauthorized to send notification for this booking" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp config
    const { data: whatsappConfig, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .single();

    if (configError || !whatsappConfig) {
      return new Response(
        JSON.stringify({ error: "WhatsApp configuration not found or inactive" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get template based on notification type
    const templateSlug = notificationType === "cancelled" ? "party_hall_cancelled" : "party_hall_reminder";
    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("content")
      .eq("slug", templateSlug)
      .eq("is_active", true)
      .single();

    // Format date
    const bookingDate = new Date(booking.booking_date + "T00:00:00");
    const formattedDate = bookingDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Build message
    let message: string;
    if (template?.content) {
      message = template.content
        .replace("{condominio}", condo.name)
        .replace("{nome}", resident.full_name.split(" ")[0])
        .replace("{espaco}", hallSetting.name)
        .replace("{data}", formattedDate)
        .replace("{horario_inicio}", booking.start_time.slice(0, 5))
        .replace("{horario_fim}", booking.end_time.slice(0, 5));
    } else {
      // Default messages based on type
      if (notificationType === "cancelled") {
        message = `❌ *RESERVA CANCELADA*

🏢 *${condo.name}*

Olá, *${resident.full_name.split(" ")[0]}*!

Informamos que sua reserva do *${hallSetting.name}* foi cancelada.

📅 *Data:* ${formattedDate}
⏰ *Horário:* ${booking.start_time.slice(0, 5)} às ${booking.end_time.slice(0, 5)}

Se você não solicitou este cancelamento ou tem dúvidas, entre em contato com a administração.

Atenciosamente,
Equipe ${condo.name}`;
      } else {
        message = `🎉 *LEMBRETE DE RESERVA*

🏢 *${condo.name}*

Olá, *${resident.full_name.split(" ")[0]}*!

Sua reserva do *${hallSetting.name}* está confirmada para:
📅 *Data:* ${formattedDate}
⏰ *Horário:* ${booking.start_time.slice(0, 5)} às ${booking.end_time.slice(0, 5)}

📋 *Lembre-se:*
• Compareça no horário para o checklist de entrada
• Traga documento de identificação
• Respeite as regras do espaço

Em caso de dúvidas, entre em contato com a administração.

Boa festa! 🎊`;
      }
    }

    // Check if resident has phone
    if (!resident.phone) {
      return new Response(
        JSON.stringify({ error: "Resident has no phone number registered" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send message
    const provider = providers[whatsappConfig.provider];
    if (!provider) {
      return new Response(
        JSON.stringify({ error: `Unknown WhatsApp provider: ${whatsappConfig.provider}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await provider.sendMessage(
      whatsappConfig as WhatsAppConfig,
      resident.phone,
      message
    );

    if (result.error) {
      console.error("WhatsApp send error:", result.error);
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update booking with notification timestamp (only for reminders)
    if (notificationType === "reminder") {
      await supabase
        .from("party_hall_bookings")
        .update({ notification_sent_at: new Date().toISOString() })
        .eq("id", bookingId);
    }

    console.log(`Party hall ${notificationType} notification sent successfully for booking ${bookingId}`);

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-party-hall-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
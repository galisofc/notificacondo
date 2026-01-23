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
  use_official_api?: boolean;
}

const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("55")) {
    return cleaned;
  }
  return `55${cleaned}`;
};

const parseResponseSafely = async (response: Response): Promise<{ data: any; error?: string }> => {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return { data };
  } catch {
    console.error("Non-JSON response received:", text.substring(0, 500));
    return { data: null, error: `API returned non-JSON response (status ${response.status}): ${text.substring(0, 200)}` };
  }
};

const providers: Record<string, ProviderConfig> = {
  zpro: {
    async sendMessage(config, phone, message) {
      const formattedPhone = formatPhoneNumber(phone);
      const baseUrl = config.api_url.replace(/\/$/, "");
      
      // If instance_id is empty or placeholder, fallback to api_key
      let externalKey = config.instance_id || "";
      if (!externalKey || externalKey === "zpro-embedded") {
        externalKey = config.api_key;
      }
      
      let response;
      
      // Check if using official WABA API endpoints
      if (config.use_official_api) {
        console.log("Z-PRO using OFFICIAL WABA API");
        
        // For WABA, we use instance_id as the channel identifier in the URL
        // and api_key as the externalkey header for authentication
        const urlParts = baseUrl.match(/^(https?:\/\/[^\/]+)/);
        const baseDomain = urlParts ? urlParts[1] : baseUrl;
        const channelId = config.instance_id || "";
        const targetUrl = `${baseDomain}/v2/api/${channelId}/SendMessageAPIText`;
        console.log("Z-PRO WABA sending text to:", formattedPhone);
        console.log("Z-PRO WABA endpoint:", targetUrl);
        console.log("Z-PRO WABA channelId:", channelId);
        
        response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "externalkey": config.api_key,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: message,
          }),
        });
      } else {
        // Unofficial API (legacy behavior) - GET with query parameters
        const params = new URLSearchParams({
          body: message,
          number: formattedPhone,
          externalKey,
          bearertoken: config.api_key,
          isClosed: "false"
        });
        
        const sendUrl = `${baseUrl}/params/?${params.toString()}`;
        console.log("Z-PRO sending to:", sendUrl.substring(0, 150) + "...");
        
        response = await fetch(sendUrl, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
      }

      const { data: result, error: parseError } = await parseResponseSafely(response);
      if (parseError) return { error: parseError };
      
      if (response.ok) {
        const extractedMessageId = result?.id || result?.messageId || result?.key?.id || result?.msgId;
        if (extractedMessageId) {
          return { messageId: String(extractedMessageId) };
        }
        // Generate tracking ID if no message ID returned
        return { messageId: `zpro_${Date.now()}` };
      }
      
      return { error: result?.message || result?.error || "Erro ao enviar mensagem via Z-PRO" };
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

      const { data: result, error: parseError } = await parseResponseSafely(response);
      if (parseError) return { error: parseError };
      if (!response.ok) {
        return { error: result?.message || "Erro ao enviar mensagem via Z-API" };
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

      const { data: result, error: parseError } = await parseResponseSafely(response);
      if (parseError) return { error: parseError };
      if (!response.ok) {
        return { error: result?.message || "Erro ao enviar mensagem via Evolution" };
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

      const { data: result, error: parseError } = await parseResponseSafely(response);
      if (parseError) return { error: parseError };
      if (!response.ok || result?.status === "error") {
        return { error: result?.message || "Erro ao enviar mensagem via WPPConnect" };
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

    // Get template based on notification type - first check for custom condominium template
    const templateSlug = notificationType === "cancelled" ? "party_hall_cancelled" : "party_hall_reminder";
    
    let templateContent: string | null = null;
    
    // Check for custom condominium template first
    const { data: customTemplate } = await supabase
      .from("condominium_whatsapp_templates")
      .select("content")
      .eq("condominium_id", booking.condominium_id)
      .eq("template_slug", templateSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (customTemplate?.content) {
      templateContent = customTemplate.content;
      console.log("Using custom condominium template for", templateSlug);
    } else {
      // Fall back to default template
      const { data: defaultTemplate } = await supabase
        .from("whatsapp_templates")
        .select("content")
        .eq("slug", templateSlug)
        .eq("is_active", true)
        .maybeSingle();
      
      if (defaultTemplate?.content) {
        templateContent = defaultTemplate.content;
        console.log("Using default system template for", templateSlug);
      }
    }
    
    const template = templateContent ? { content: templateContent } : null;

    // Format date
    const bookingDate = new Date(booking.booking_date + "T00:00:00");
    const formattedDate = bookingDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Fetch checklist template items for reminder notifications
    let checklistItems: string[] = [];
    if (notificationType === "reminder") {
      const { data: templateItems } = await supabase
        .from("party_hall_checklist_templates")
        .select("item_name, category")
        .eq("condominium_id", booking.condominium_id)
        .eq("is_active", true)
        .order("category")
        .order("display_order");

      if (templateItems && templateItems.length > 0) {
        // Group items by category
        const grouped: Record<string, string[]> = {};
        templateItems.forEach((item: any) => {
          const cat = item.category || "Geral";
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item.item_name);
        });

        // Format checklist items
        Object.entries(grouped).forEach(([category, items]) => {
          checklistItems.push(`*${category}:*`);
          items.forEach(item => checklistItems.push(`  • ${item}`));
        });
      }
    }

    // Build message
    let message: string;
    if (template?.content) {
      message = template.content
        .replace("{condominio}", condo.name)
        .replace("{nome}", resident.full_name.split(" ")[0])
        .replace("{espaco}", hallSetting.name)
        .replace("{data}", formattedDate)
        .replace("{horario_inicio}", booking.start_time.slice(0, 5))
        .replace("{horario_fim}", booking.end_time.slice(0, 5))
        .replace("{checklist}", checklistItems.length > 0 ? checklistItems.join("\n") : "");
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
        const checklistSection = checklistItems.length > 0 
          ? `\n📋 *ITENS QUE SERÃO VERIFICADOS:*\n${checklistItems.join("\n")}\n`
          : "";

        message = `🎉 *LEMBRETE DE RESERVA*

🏢 *${condo.name}*

Olá, *${resident.full_name.split(" ")[0]}*!

Sua reserva do *${hallSetting.name}* está confirmada para:
📅 *Data:* ${formattedDate}
⏰ *Horário:* ${booking.start_time.slice(0, 5)} às ${booking.end_time.slice(0, 5)}
${checklistSection}
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

    // Save notification to history
    const notificationRecord = {
      booking_id: bookingId,
      condominium_id: booking.condominium_id,
      resident_id: resident.id,
      notification_type: notificationType,
      phone: resident.phone,
      message_content: message,
      message_id: result.messageId || null,
      status: result.error ? "failed" : "sent",
      error_message: result.error || null,
      sent_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from("party_hall_notifications")
      .insert(notificationRecord);

    if (insertError) {
      console.error("Error saving notification history:", insertError);
    }

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
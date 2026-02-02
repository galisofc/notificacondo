import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWabaTemplate, formatPhoneForWaba, buildParamsArray } from "../_shared/waba-sender.ts";

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
  use_waba_templates?: boolean;
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
      
      let externalKey = config.instance_id || "";
      if (!externalKey || externalKey === "zpro-embedded") {
        externalKey = config.api_key;
      }
      
      const params = new URLSearchParams({
        body: message,
        number: formattedPhone,
        externalKey,
        bearertoken: config.api_key,
        isClosed: "false"
      });
      
      const sendUrl = `${baseUrl}/params/?${params.toString()}`;
      console.log("Z-PRO sending to:", sendUrl.substring(0, 150) + "...");
      
      const response = await fetch(sendUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const { data: result, error: parseError } = await parseResponseSafely(response);
      if (parseError) return { error: parseError };
      
      if (response.ok) {
        const extractedMessageId = result?.id || result?.messageId || result?.key?.id || result?.msgId;
        if (extractedMessageId) {
          return { messageId: String(extractedMessageId) };
        }
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

/**
 * Send message via Meta WhatsApp Cloud API using WABA template
 * Uses the approved templates: party_hall_reminder, party_hall_cancelled
 */
async function sendViaMetaCloudApiTemplate(
  phone: string,
  templateName: string,
  language: string,
  params: string[]
): Promise<{ messageId?: string; error?: string }> {
  const accessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("META_WHATSAPP_PHONE_ID");

  if (!accessToken || !phoneNumberId) {
    console.error("META_WHATSAPP_ACCESS_TOKEN or META_WHATSAPP_PHONE_ID not configured");
    return { error: "Meta WhatsApp API não configurada" };
  }

  const formattedPhone = formatPhoneForWaba(phone);
  const endpoint = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  console.log(`[META-WABA] Sending template "${templateName}" to ${formattedPhone}`);
  console.log(`[META-WABA] Params: ${JSON.stringify(params)}`);

  // Build template components - body only (no header image for party hall)
  const components: Array<Record<string, unknown>> = [];
  
  if (params.length > 0) {
    components.push({
      type: "body",
      parameters: params.map((value) => ({
        type: "text",
        text: String(value || ""),
      })),
    });
  }

  const requestBody = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: language,
      },
      components,
    },
  };

  console.log(`[META-WABA] Request body: ${JSON.stringify(requestBody)}`);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log(`[META-WABA] Response status: ${response.status}`);
    console.log(`[META-WABA] Response body: ${responseText.substring(0, 500)}`);

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      return { error: `Meta API returned non-JSON: ${responseText.substring(0, 200)}` };
    }

    if (!response.ok) {
      const errorMessage = responseData?.error?.message || responseData?.error?.error_data?.details || "Erro ao enviar via Meta API";
      return { error: errorMessage };
    }

    const messageId = responseData?.messages?.[0]?.id;
    return { messageId };
  } catch (error) {
    console.error("[META-WABA] Error sending message:", error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Send message via Meta WhatsApp Cloud API (official WABA)
 * Falls back to direct text message when templates are not available
 */
async function sendViaMetaCloudApiText(
  phone: string,
  message: string
): Promise<{ messageId?: string; error?: string }> {
  const accessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("META_WHATSAPP_PHONE_ID");

  if (!accessToken || !phoneNumberId) {
    console.error("META_WHATSAPP_ACCESS_TOKEN or META_WHATSAPP_PHONE_ID not configured");
    return { error: "Meta WhatsApp API não configurada" };
  }

  const formattedPhone = formatPhoneForWaba(phone);
  const endpoint = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  console.log(`[META] Sending direct message to ${formattedPhone}`);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "text",
        text: {
          body: message,
        },
      }),
    });

    const responseText = await response.text();
    console.log(`[META] Response status: ${response.status}`);
    console.log(`[META] Response body: ${responseText.substring(0, 500)}`);

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      return { error: `Meta API returned non-JSON: ${responseText.substring(0, 200)}` };
    }

    if (!response.ok) {
      const errorMessage = responseData?.error?.message || responseData?.error?.error_data?.details || "Erro ao enviar via Meta API";
      return { error: errorMessage };
    }

    const messageId = responseData?.messages?.[0]?.id;
    return { messageId };
  } catch (error) {
    console.error("[META] Error sending message:", error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

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

    // Check if we should use official Meta API and WABA templates
    const useOfficialApi = whatsappConfig.use_official_api === true;
    const useWabaTemplates = whatsappConfig.use_waba_templates === true;
    console.log(`[PARTY-HALL] use_official_api: ${useOfficialApi}, use_waba_templates: ${useWabaTemplates}`);

    // Get template based on notification type - first check for custom condominium template
    const templateSlug = notificationType === "cancelled" ? "party_hall_cancelled" : "party_hall_reminder";
    
    let templateContent: string | null = null;
    let wabaTemplateName: string | null = null;
    let wabaLanguage: string = "pt_BR";
    let paramsOrder: string[] = [];
    
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
      // Fall back to default template with WABA metadata
      const { data: defaultTemplate } = await supabase
        .from("whatsapp_templates")
        .select("content, waba_template_name, waba_language, params_order")
        .eq("slug", templateSlug)
        .eq("is_active", true)
        .maybeSingle();
      
      if (defaultTemplate) {
        templateContent = defaultTemplate.content;
        wabaTemplateName = defaultTemplate.waba_template_name;
        wabaLanguage = defaultTemplate.waba_language || "pt_BR";
        paramsOrder = defaultTemplate.params_order || [];
        console.log(`Using default system template for ${templateSlug}, WABA: ${wabaTemplateName}`);
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

    // Send message - use Meta API if configured, otherwise use legacy providers
    let result: { messageId?: string; error?: string };

    // Helper function to sanitize text for WABA templates
    // Meta API doesn't allow newlines, tabs, or 4+ consecutive spaces (#132018)
    const sanitizeForWaba = (text: string): string => {
      return text
        .replace(/[\n\r\t]/g, " ")  // Replace newlines/tabs with space
        .replace(/\s{4,}/g, "   ")  // Max 3 consecutive spaces
        .replace(/\s+/g, " ")       // Collapse multiple spaces
        .trim();
    };

    if (useOfficialApi) {
      // Check if we should use WABA templates
      if (useWabaTemplates && wabaTemplateName && paramsOrder.length > 0) {
        console.log(`[PARTY-HALL] Sending via Meta WABA template: ${wabaTemplateName}`);
        console.log(`[PARTY-HALL] Notification type: ${notificationType}, Template: ${wabaTemplateName}`);
        
        // Build checklist as comma-separated items without formatting (only for reminders)
        const checklistString = checklistItems.length > 0 
          ? sanitizeForWaba(checklistItems
              .filter(item => !item.startsWith("*"))  // Remove category headers like "*Limpeza:*"
              .map(item => item.replace(/^\s*•\s*/, "").trim())  // Remove bullets
              .filter(Boolean)
              .join(", "))
          : "";
        
        // Build params map - sanitize ALL text values for Meta API compliance
        const paramsMap: Record<string, string> = {
          condominio: sanitizeForWaba(condo.name),
          nome: sanitizeForWaba(resident.full_name.split(" ")[0]),
          espaco: sanitizeForWaba(hallSetting.name),
          data: sanitizeForWaba(formattedDate),
          horario_inicio: booking.start_time.slice(0, 5),
          horario_fim: booking.end_time.slice(0, 5),
          checklist: checklistString,
        };
        
        console.log(`[PARTY-HALL] Params order: ${JSON.stringify(paramsOrder)}`);
        console.log(`[PARTY-HALL] Params map: ${JSON.stringify(paramsMap)}`);
        
        const templateParams = buildParamsArray(paramsMap, paramsOrder);
        console.log(`[PARTY-HALL] Final template params: ${JSON.stringify(templateParams)}`);
        
        result = await sendViaMetaCloudApiTemplate(
          resident.phone, 
          wabaTemplateName, 
          wabaLanguage, 
          templateParams
        );
      } else {
        // Fallback to direct text message (requires 24h window)
        console.log("[PARTY-HALL] Sending via Meta WhatsApp Cloud API (text message)");
        result = await sendViaMetaCloudApiText(resident.phone, message);
      }
    } else {
      // Legacy provider flow
      const provider = providers[whatsappConfig.provider];
      if (!provider) {
        return new Response(
          JSON.stringify({ error: `Unknown WhatsApp provider: ${whatsappConfig.provider}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[PARTY-HALL] Sending via legacy provider: ${whatsappConfig.provider}`);
      result = await provider.sendMessage(
        whatsappConfig as WhatsAppConfig,
        resident.phone,
        message
      );
    }

    // Save notification to party_hall_notifications history
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

    // Also save to whatsapp_notification_logs for unified WABA logs view
    if (useOfficialApi && useWabaTemplates && wabaTemplateName) {
      const wabaLogRecord = {
        function_name: "send-party-hall-notification",
        phone: resident.phone,
        template_name: wabaTemplateName,
        template_language: wabaLanguage,
        request_payload: {
          to: resident.phone.replace(/\D/g, "").startsWith("55") 
            ? resident.phone.replace(/\D/g, "") 
            : "55" + resident.phone.replace(/\D/g, ""),
          type: "template",
          template: {
            name: wabaTemplateName,
            language: { code: wabaLanguage },
          },
          messaging_product: "whatsapp",
        },
        response_status: result.error ? 500 : 200,
        response_body: result.error ? JSON.stringify({ error: result.error }) : JSON.stringify({ messageId: result.messageId }),
        success: !result.error,
        message_id: result.messageId || null,
        error_message: result.error || null,
        resident_id: resident.id,
        debug_info: {
          booking_id: bookingId,
          condominium_id: booking.condominium_id,
          notification_type: notificationType,
        },
      };

      const { error: wabaLogError } = await supabase
        .from("whatsapp_notification_logs")
        .insert(wabaLogRecord);

      if (wabaLogError) {
        console.error("Error saving WABA log:", wabaLogError);
      } else {
        console.log("[PARTY-HALL] WABA log saved successfully");
      }
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

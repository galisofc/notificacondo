import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";
import { 
  sendMetaTemplate, 
  isMetaConfigured,
  formatPhoneForMeta,
  buildParamsArray,
  type MetaSendResult 
} from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const SendNotificationSchema = z.object({
  occurrence_id: z.string().uuid("occurrence_id deve ser um UUID válido"),
  resident_id: z.string().uuid("resident_id deve ser um UUID válido"),
  message_template: z.string().max(2000, "Mensagem não pode exceder 2000 caracteres").optional(),
});

// Sanitize strings for use in messages - remove forbidden characters and normalize whitespace
const sanitizeForWaba = (str: string): string => {
  return str
    .replace(/[<>"'`]/g, "")
    .replace(/[\n\r\t]/g, " ")
    .replace(/\s{3,}/g, "  ")
    .trim();
};

interface ButtonConfigItem {
  type: "url" | "quick_reply" | "call";
  text: string;
  url_base?: string;
  has_dynamic_suffix?: boolean;
}

interface WhatsAppTemplateRow {
  id: string;
  slug: string;
  content: string;
  is_active: boolean;
  waba_template_name?: string;
  waba_language?: string;
  params_order?: string[];
  button_config?: ButtonConfigItem | ButtonConfigItem[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== CHECK META CONFIG ==========
    if (!isMetaConfigured()) {
      console.error("Meta WhatsApp not configured");
      return new Response(
        JSON.stringify({ error: "Meta WhatsApp não configurado. Configure META_WHATSAPP_PHONE_ID e META_WHATSAPP_ACCESS_TOKEN." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== AUTHENTICATION ==========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    // ========== INPUT VALIDATION ==========
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "JSON inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = SendNotificationSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Validation error:", parsed.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Dados inválidos", 
          details: parsed.error.errors.map(e => e.message) 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { occurrence_id, resident_id, message_template } = parsed.data;

    // ========== AUTHORIZATION ==========
    const { data: occurrence, error: occCheckError } = await supabase
      .from("occurrences")
      .select("condominium_id")
      .eq("id", occurrence_id)
      .single();

    if (occCheckError || !occurrence) {
      console.error("Occurrence not found for auth check:", occCheckError);
      return new Response(
        JSON.stringify({ error: "Ocorrência não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: condo } = await supabase
      .from("condominiums")
      .select("owner_id")
      .eq("id", occurrence.condominium_id)
      .single();

    if (!condo || condo.owner_id !== user.id) {
      // Check if super_admin
      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!superAdminRole) {
        console.error(`User ${user.id} is not owner of condominium and not super_admin`);
        return new Response(
          JSON.stringify({ error: "Sem permissão para enviar notificações neste condomínio" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Authorization passed for user ${user.id}`);

    // Get app URL from settings or use default
    const { data: appSettings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "app_url")
      .maybeSingle();
    
    const appBaseUrl = (appSettings?.value as string) || "https://notificacondo.lovable.app";

    // Fetch resident and occurrence details
    const { data: resident, error: residentError } = await supabase
      .from("residents")
      .select(`
        id,
        full_name,
        phone,
        email,
        apartments!inner (
          number,
          blocks!inner (
            name,
            condominiums!inner (
              id,
              name
            )
          )
        )
      `)
      .eq("id", resident_id)
      .single();

    if (residentError || !resident) {
      console.error("Resident not found:", residentError);
      return new Response(
        JSON.stringify({ error: "Morador não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!resident.phone) {
      return new Response(
        JSON.stringify({ error: "Morador não possui telefone cadastrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: occurrenceData, error: occError } = await supabase
      .from("occurrences")
      .select("id, title, type, status")
      .eq("id", occurrence_id)
      .single();

    if (occError || !occurrenceData) {
      console.error("Occurrence not found:", occError);
      return new Response(
        JSON.stringify({ error: "Ocorrência não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate secure token for the link
    const secureToken = crypto.randomUUID();
    const secureLink = `${appBaseUrl}/acesso/${secureToken}`;

    const apt = resident.apartments as any;
    const condoName = apt.blocks.condominiums.name;
    const condoId = apt.blocks.condominiums.id;

    // Type label mapping
    const typeLabels: Record<string, string> = {
      advertencia: "Advertência",
      notificacao: "Notificação",
      multa: "Multa",
    };

    // ========== FETCH WABA TEMPLATE ==========
    const { data: wabaTemplate } = await supabase
      .from("whatsapp_templates")
      .select("id, slug, content, is_active, waba_template_name, waba_language, params_order, button_config")
      .eq("slug", "notification_occurrence")
      .eq("is_active", true)
      .maybeSingle() as { data: WhatsAppTemplateRow | null; error: any };

    const wabaTemplateName = wabaTemplate?.waba_template_name || null;
    const wabaLanguage = wabaTemplate?.waba_language || "pt_BR";
    const paramsOrder = wabaTemplate?.params_order || [];

    console.log(`Template WABA config: name=${wabaTemplateName}, lang=${wabaLanguage}, params=${paramsOrder.join(",")}`);

    // Build variables for template BODY (order: condominio, nome, tipo, titulo)
    // NOTE: The "link" is passed as a BUTTON parameter, not body parameter
    const variables: Record<string, string> = {
      condominio: sanitizeForWaba(condoName),
      nome: sanitizeForWaba(resident.full_name || "Morador"),
      tipo: typeLabels[occurrenceData.type] || occurrenceData.type,
      titulo: sanitizeForWaba(occurrenceData.title),
    };

    // Build message content for notification record
    const messageContent = `🏢 *${sanitizeForWaba(condoName)}*

Olá, *${sanitizeForWaba(resident.full_name)}*!

Você recebeu uma *${typeLabels[occurrenceData.type] || occurrenceData.type}*:
📋 *${sanitizeForWaba(occurrenceData.title)}*

Acesse o link abaixo para ver os detalhes e apresentar sua defesa:
👉 ${secureLink}

Este link é pessoal e intransferível.`;

    // Save notification record
    const { data: notification, error: notifError } = await supabase
      .from("notifications_sent")
      .insert({
        occurrence_id,
        resident_id,
        message_content: messageContent,
        sent_via: "whatsapp_meta",
        secure_link: secureLink,
        secure_link_token: secureToken,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (notifError) {
      console.error("Failed to save notification:", notifError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar notificação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== SEND VIA WABA TEMPLATE ==========
    let result: MetaSendResult;

    if (wabaTemplateName && paramsOrder.length > 0) {
      console.log(`Using WABA template: ${wabaTemplateName}`);
      
      const { values: bodyParams, names: bodyParamNames } = buildParamsArray(variables, paramsOrder);
      
      console.log(`Body params: ${JSON.stringify(bodyParams)}`);
      console.log(`Body param names: ${JSON.stringify(bodyParamNames)}`);
      
      // Build button params for URL buttons with dynamic suffix (e.g., magic link token)
      const buttonConfigs = wabaTemplate?.button_config 
        ? (Array.isArray(wabaTemplate.button_config) ? wabaTemplate.button_config : [wabaTemplate.button_config])
        : [];
      
      const urlButtonsWithSuffix = buttonConfigs
        .map((btn, idx) => ({ btn, idx }))
        .filter(({ btn }) => btn.type === "url" && btn.has_dynamic_suffix);

      const buttonParams = urlButtonsWithSuffix.map(({ idx }) => ({
        type: "button" as const,
        subType: "url" as const,
        index: idx,
        parameters: [{ type: "text" as const, text: secureToken }],
      }));

      if (buttonParams.length > 0) {
        console.log(`Button params: ${JSON.stringify(buttonParams)}`);
      }

      result = await sendMetaTemplate({
        phone: resident.phone,
        templateName: wabaTemplateName,
        language: wabaLanguage,
        bodyParams,
        bodyParamNames,
        buttonParams: buttonParams.length > 0 ? buttonParams : undefined,
      });
    } else {
      // Fallback to text message (will only work within 24h window)
      console.warn("No WABA template configured, falling back to text message (may fail outside 24h window)");
      
      const { sendMetaText } = await import("../_shared/meta-whatsapp.ts");
      result = await sendMetaText({
        phone: resident.phone,
        message: messageContent,
        previewUrl: true,
      });
    }

    // Log to whatsapp_notification_logs for monitoring
    await supabase.from("whatsapp_notification_logs").insert({
      function_name: "send-whatsapp-notification",
      phone: resident.phone,
      resident_id: resident.id,
      condominium_id: condoId,
      template_name: wabaTemplateName || "notification_occurrence_fallback",
      template_language: wabaLanguage,
      success: result.success,
      message_id: result.messageId,
      error_message: result.error,
      request_payload: result.debug?.payload || { variables, params_order: paramsOrder },
      response_body: result.debug?.response,
      response_status: result.debug?.status,
    });

    // Update notification with result
    await supabase
      .from("notifications_sent")
      .update({
        zpro_message_id: result.messageId,
        zpro_status: result.success ? "sent" : "failed",
      })
      .eq("id", notification.id);

    if (!result.success) {
      console.error("WhatsApp send failed:", result.error);
      return new Response(
        JSON.stringify({ 
          error: "Falha ao enviar WhatsApp", 
          details: result.error,
          notification_id: notification.id 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp notification sent successfully:", result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notificação enviada com sucesso",
        notification_id: notification.id,
        message_id: result.messageId,
        secure_link: secureLink,
        template_used: wabaTemplateName || "fallback_text",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

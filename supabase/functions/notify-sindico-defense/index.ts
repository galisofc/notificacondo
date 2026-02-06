import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMetaTemplate, isMetaConfigured, buildParamsArray } from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifySindicoRequest {
  occurrence_id: string;
  resident_name: string;
  occurrence_title: string;
}

interface WhatsAppTemplateRow {
  id: string;
  slug: string;
  content: string;
  is_active: boolean;
  waba_template_name?: string;
  waba_language?: string;
  params_order?: string[];
  button_config?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { occurrence_id, resident_name, occurrence_title }: NotifySindicoRequest = await req.json();
    console.log("Notify síndico request:", { occurrence_id, resident_name, occurrence_title });

    if (!occurrence_id) {
      return new Response(
        JSON.stringify({ error: "occurrence_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch occurrence to get condominium and owner (síndico) info
    const { data: occurrence, error: occError } = await supabase
      .from("occurrences")
      .select(`
        id,
        title,
        type,
        condominium_id,
        condominiums!inner (
          id,
          name,
          owner_id
        )
      `)
      .eq("id", occurrence_id)
      .single();

    if (occError || !occurrence) {
      console.error("Occurrence not found:", occError);
      return new Response(
        JSON.stringify({ error: "Ocorrência não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const condo = occurrence.condominiums as any;
    const sindicoUserId = condo.owner_id;

    // Fetch síndico profile to get phone
    const { data: sindicoProfile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("user_id", sindicoUserId)
      .single();

    if (profileError || !sindicoProfile) {
      console.error("Síndico profile not found:", profileError);
      return new Response(
        JSON.stringify({ error: "Perfil do síndico não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sindicoProfile.phone) {
      console.log("Síndico has no phone registered, skipping WhatsApp notification");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Síndico sem telefone cadastrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if Meta is configured
    if (!isMetaConfigured()) {
      console.log("Meta WhatsApp not configured, skipping notification");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Meta WhatsApp não configurado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch WhatsApp config for app_url
    const { data: whatsappConfig } = await supabase
      .from("whatsapp_config")
      .select("app_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const appBaseUrl = (whatsappConfig as any)?.app_url || "https://notificacondo.com.br";

    // Fetch WABA template config
    const { data: wabaTemplate } = await supabase
      .from("whatsapp_templates")
      .select("id, slug, content, is_active, waba_template_name, waba_language, params_order, button_config")
      .eq("slug", "notify_sindico_defense")
      .eq("is_active", true)
      .maybeSingle() as { data: WhatsAppTemplateRow | null; error: any };

    const wabaTemplateName = wabaTemplate?.waba_template_name || "nova_defesa";
    const wabaLanguage = wabaTemplate?.waba_language || "pt_BR";
    const paramsOrder = wabaTemplate?.params_order || ["nome_morador", "tipo", "titulo", "condominio", "link"];

    // Type label mapping
    const typeLabels: Record<string, string> = {
      advertencia: "Advertência",
      notificacao: "Notificação",
      multa: "Multa",
    };

    // Build variables
    const variables: Record<string, string> = {
      nome_morador: resident_name || "Morador",
      tipo: typeLabels[occurrence.type] || occurrence.type,
      titulo: occurrence_title || occurrence.title,
      condominio: condo.name,
      link: `${appBaseUrl}/defenses`,
    };

    console.log("Template variables:", variables);
    console.log(`Using WABA template: ${wabaTemplateName} (${wabaLanguage})`);

    // Build params in correct order
    const { values: bodyParams, names: bodyParamNames } = buildParamsArray(variables, paramsOrder);
    console.log(`Body params: ${JSON.stringify(bodyParams)}`);

    // Send via Meta WABA template
    const result = await sendMetaTemplate({
      phone: sindicoProfile.phone,
      templateName: wabaTemplateName,
      language: wabaLanguage,
      bodyParams,
      bodyParamNames,
    });

    // Log the notification
    await supabase.from("whatsapp_notification_logs").insert({
      function_name: "notify-sindico-defense",
      phone: sindicoProfile.phone,
      template_name: wabaTemplateName,
      template_language: wabaLanguage,
      success: result.success,
      message_id: result.messageId || null,
      error_message: result.error || null,
      request_payload: { variables, bodyParams, bodyParamNames },
      response_status: result.debug?.status || null,
      response_body: typeof result.debug?.response === "string" ? result.debug.response.substring(0, 1000) : null,
      condominium_id: occurrence.condominium_id,
    });

    if (!result.success) {
      console.error("WhatsApp send failed:", result.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Falha ao enviar WhatsApp para síndico", 
          details: result.error 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp sent to síndico successfully:", result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: result.messageId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

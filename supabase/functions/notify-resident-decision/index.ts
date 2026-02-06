import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMetaTemplate, buildParamsArray } from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyResidentRequest {
  occurrence_id: string;
  decision: "arquivada" | "advertido" | "multado";
  justification: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let notificationId: string | null = null;

  try {
    const { occurrence_id, decision, justification }: NotifyResidentRequest = await req.json();
    console.log("Notify resident decision:", { occurrence_id, decision });

    if (!occurrence_id || !decision) {
      return new Response(
        JSON.stringify({ error: "occurrence_id e decision são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch occurrence with resident info
    const { data: occurrence, error: occError } = await supabase
      .from("occurrences")
      .select(`
        id, title, type, condominium_id,
        residents!inner (
          id, full_name, phone, email,
          apartments!inner (
            number,
            blocks!inner (
              name,
              condominiums!inner ( id, name )
            )
          )
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

    const resident = occurrence.residents as any;

    if (!resident?.phone) {
      console.log("Resident has no phone, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Morador sem telefone" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const condoName = resident.apartments.blocks.condominiums.name;
    const condoId = occurrence.condominium_id;

    // Map decision to template slug
    const templateSlugMap: Record<string, string> = {
      arquivada: "decision_archived",
      advertido: "decision_warning",
      multado: "decision_fine",
    };
    const templateSlug = templateSlugMap[decision];

    // Fetch WABA template config
    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("waba_template_name, waba_language, params_order, variables, button_config")
      .eq("slug", templateSlug)
      .eq("is_active", true)
      .maybeSingle();

    const wabaTemplateName = template?.waba_template_name;
    const wabaLanguage = template?.waba_language || "pt_BR";
    const paramsOrder = template?.params_order || template?.variables || [];

    if (!wabaTemplateName) {
      console.error(`No WABA template linked for slug: ${templateSlug}`);
      return new Response(
        JSON.stringify({ error: `Template WABA não vinculado para ${templateSlug}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build link
    const appBaseUrl = "https://notificacondo.lovable.app";
    const link = `${appBaseUrl}/resident/occurrences/${occurrence_id}`;

    // Build variables
    const variables: Record<string, string> = {
      nome: resident.full_name || "Morador",
      titulo: occurrence.title,
      condominio: condoName,
      justificativa: justification || "Sem justificativa adicional.",
      link,
    };

    const { values: bodyParams, names: bodyParamNames } = buildParamsArray(variables, paramsOrder);

    // Build button params if template has URL buttons with dynamic suffix
    let buttonParams: any[] | undefined;
    if (template?.button_config) {
      const btnConfigs = Array.isArray(template.button_config) ? template.button_config : [template.button_config];
      const urlButtons = btnConfigs
        .map((btn: any, idx: number) => ({ btn, idx }))
        .filter(({ btn }: any) => btn.type === "url" && btn.has_dynamic_suffix);

      if (urlButtons.length > 0) {
        buttonParams = urlButtons.map(({ idx }: any) => ({
          type: "button",
          subType: "url",
          index: idx,
          parameters: [{ type: "text", text: link }],
        }));
      }
    }

    // Create notification log entry
    const { data: logEntry } = await supabase
      .from("whatsapp_notification_logs")
      .insert({
        function_name: "notify-resident-decision",
        phone: resident.phone,
        template_name: wabaTemplateName,
        template_language: wabaLanguage,
        condominium_id: condoId,
        resident_id: resident.id,
        success: false,
      })
      .select("id")
      .single();

    notificationId = logEntry?.id || null;

    console.log(`Sending Meta template "${wabaTemplateName}" to ${resident.phone}`);

    const result = await sendMetaTemplate({
      phone: resident.phone,
      templateName: wabaTemplateName,
      language: wabaLanguage,
      bodyParams,
      bodyParamNames,
      buttonParams,
    });

    // Update log
    if (notificationId) {
      await supabase
        .from("whatsapp_notification_logs")
        .update({
          success: result.success,
          message_id: result.messageId || null,
          response_status: result.debug?.status || null,
          response_body: typeof result.debug?.response === "string" ? result.debug.response.substring(0, 2000) : null,
          request_payload: result.debug?.payload || null,
          error_message: result.error || null,
        })
        .eq("id", notificationId);
    }

    if (!result.success) {
      console.error("Meta send failed:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error, notification_id: notificationId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp decision notification sent successfully via Meta");

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId, notification_id: notificationId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);

    if (notificationId) {
      await supabase
        .from("whatsapp_notification_logs")
        .update({ error_message: error.message || "Erro interno" })
        .eq("id", notificationId);
    }

    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMetaTemplate, isMetaConfigured, buildParamsArray } from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sanitize = (str: string) => str.replace(/[<>"'`]/g, "").replace(/[\n\r\t]/g, " ").trim();

interface NotifyTransferRequest {
  condominium_id: string;
  condominium_name: string;
  new_owner_id: string;
  old_owner_id: string;
  old_owner_name: string;
  new_owner_name?: string;
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!isMetaConfigured()) {
      return new Response(
        JSON.stringify({ error: "Meta WhatsApp não configurado", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      condominium_id,
      condominium_name,
      new_owner_id,
      old_owner_id,
      old_owner_name,
      new_owner_name,
      notes,
    }: NotifyTransferRequest = await req.json();

    if (!condominium_id || !new_owner_id) {
      return new Response(
        JSON.stringify({ error: "condominium_id e new_owner_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get app URL
    const { data: whatsappConfig } = await supabase
      .from("whatsapp_config")
      .select("app_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const appBaseUrl = (whatsappConfig as any)?.app_url || "https://notificacondo.com.br";

    // Fetch profiles
    const { data: newOwner } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", new_owner_id)
      .single();

    const { data: oldOwner } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", old_owner_id)
      .single();

    const now = new Date();
    const dataTransferencia = now.toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const results: { newOwner?: { success: boolean; messageId?: string; error?: string }; oldOwner?: { success: boolean; messageId?: string; error?: string } } = {};

    // Send to NEW owner
    if (newOwner?.phone) {
      const { data: template } = await supabase
        .from("whatsapp_templates")
        .select("waba_template_name, waba_language, params_order")
        .eq("slug", "condominium_transfer")
        .eq("is_active", true)
        .maybeSingle();

      if (template?.waba_template_name && template?.params_order?.length) {
        const variables: Record<string, string> = {
          nome_novo_sindico: sanitize(newOwner.full_name),
          condominio: sanitize(condominium_name),
          nome_antigo_sindico: sanitize(old_owner_name || oldOwner?.full_name || "Síndico anterior"),
          data_transferencia: dataTransferencia,
          observacoes: sanitize(notes || "Sem observações"),
          link: `${appBaseUrl}/auth`,
        };

        const { values: bodyParams, names: bodyParamNames } = buildParamsArray(variables, template.params_order);

        const result = await sendMetaTemplate({
          phone: newOwner.phone,
          templateName: template.waba_template_name,
          language: template.waba_language || "pt_BR",
          bodyParams,
          bodyParamNames,
        });

        results.newOwner = { success: result.success, messageId: result.messageId, error: result.error };

        await supabase.from("whatsapp_notification_logs").insert({
          function_name: "notify-transfer",
          phone: newOwner.phone,
          template_name: template.waba_template_name,
          template_language: template.waba_language || "pt_BR",
          success: result.success,
          message_id: result.messageId || null,
          error_message: result.error || null,
          request_payload: { variables, bodyParams },
          response_status: result.debug?.status || null,
          condominium_id,
        });
      } else {
        results.newOwner = { success: false, error: "Template WABA 'condominium_transfer' não configurado" };
      }
    }

    // Send to OLD owner
    if (oldOwner?.phone) {
      const { data: template } = await supabase
        .from("whatsapp_templates")
        .select("waba_template_name, waba_language, params_order")
        .eq("slug", "condominium_transfer_old_owner")
        .eq("is_active", true)
        .maybeSingle();

      if (template?.waba_template_name && template?.params_order?.length) {
        const finalNewOwnerName = new_owner_name || newOwner?.full_name || "Novo síndico";
        const variables: Record<string, string> = {
          nome_antigo_sindico: sanitize(oldOwner.full_name),
          condominio: sanitize(condominium_name),
          nome_novo_sindico: sanitize(finalNewOwnerName),
          data_transferencia: dataTransferencia,
          observacoes: sanitize(notes || "Sem observações"),
        };

        const { values: bodyParams, names: bodyParamNames } = buildParamsArray(variables, template.params_order);

        const result = await sendMetaTemplate({
          phone: oldOwner.phone,
          templateName: template.waba_template_name,
          language: template.waba_language || "pt_BR",
          bodyParams,
          bodyParamNames,
        });

        results.oldOwner = { success: result.success, messageId: result.messageId, error: result.error };

        await supabase.from("whatsapp_notification_logs").insert({
          function_name: "notify-transfer",
          phone: oldOwner.phone,
          template_name: template.waba_template_name,
          template_language: template.waba_language || "pt_BR",
          success: result.success,
          message_id: result.messageId || null,
          error_message: result.error || null,
          request_payload: { variables, bodyParams },
          response_status: result.debug?.status || null,
          condominium_id,
        });
      } else {
        results.oldOwner = { success: false, error: "Template WABA 'condominium_transfer_old_owner' não configurado" };
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  sendMetaTemplate, 
  isMetaConfigured,
  formatPhoneForMeta,
} from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== AUTHENTICATION ==========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is super_admin
    const { data: superAdminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!superAdminRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Permissão negada" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== CHECK META CONFIG ==========
    if (!isMetaConfigured()) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Meta WhatsApp não configurado. Configure META_WHATSAPP_PHONE_ID e META_WHATSAPP_ACCESS_TOKEN nos Secrets." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== INPUT VALIDATION ==========
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "JSON inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { 
      phone, 
      templateName, 
      language = "pt_BR", 
      params = [],
      mediaUrl,
      mediaType = "image",
    } = body;

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!templateName) {
      return new Response(
        JSON.stringify({ success: false, error: "Nome do template é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Template Test] Sending template: ${templateName} to ${phone}`);
    console.log(`[Template Test] Language: ${language}, Params: ${JSON.stringify(params)}`);
    if (mediaUrl) {
      console.log(`[Template Test] Media: ${mediaType} - ${mediaUrl.substring(0, 100)}...`);
    }

    // Send template via Meta API directly
    const result = await sendMetaTemplate({
      phone,
      templateName,
      language,
      bodyParams: params,
      headerMediaUrl: mediaUrl || undefined,
      headerMediaType: mediaUrl ? mediaType : undefined,
    });

    // Log to whatsapp_notification_logs for debugging
    await supabase.from("whatsapp_notification_logs").insert({
      phone: formatPhoneForMeta(phone),
      template_name: templateName,
      params: { 
        language, 
        bodyParams: params,
        mediaUrl,
        mediaType,
      },
      success: result.success,
      message_id: result.messageId,
      error_message: result.error,
      request_payload: result.debug?.payload,
      response_body: result.debug?.response,
    });

    if (!result.success) {
      console.error("[Template Test] Failed:", result.error);
      
      // Provide helpful error messages for common Meta API errors
      let possibleCauses: string[] = [];
      
      if (result.errorCode === "132001") {
        possibleCauses = [
          "Template não encontrado ou não aprovado",
          `Nome do template incorreto (você digitou: "${templateName}")`,
          "Template ainda pendente de aprovação no Meta Business Manager",
        ];
      } else if (result.errorCode === "132000") {
        possibleCauses = [
          "Número de parâmetros diferente do configurado no template",
          `Você enviou ${params.length} parâmetros`,
          "Verifique a ordem e quantidade de variáveis no template",
        ];
      } else if (result.errorCode === "131047") {
        possibleCauses = [
          "Número de telefone não é válido no WhatsApp",
          "Verifique se o número está correto e ativo",
        ];
      } else if (result.error?.includes("language")) {
        possibleCauses = [
          `Código de idioma incorreto (você digitou: "${language}")`,
          "Use: pt_BR, en_US, es, etc.",
        ];
      } else {
        possibleCauses = [
          "Verifique as credenciais da Meta Cloud API",
          "Confirme que o template está aprovado",
          "Verifique os parâmetros do template",
        ];
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao enviar template "${templateName}".`,
          errorCode: result.errorCode,
          errorMessage: result.error,
          possibleCauses,
          debug: {
            status: result.debug?.status,
            endpoint: result.debug?.endpoint,
            templateName,
            language,
            paramsCount: params.length,
            hasMedia: !!mediaUrl,
            requestPayload: result.debug?.payload,
            response: result.debug?.response,
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Template Test] Success:", result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Template "${templateName}" enviado com sucesso via Meta Cloud API!`,
        message_id: result.messageId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Template Test] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno do servidor" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  phone: string;
  templateName?: string;
  language?: string;
  isClosed?: boolean;
  params?: string[];
  mediaUrl?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      phone,
      templateName = "hello_world",
      language = "en_US",
      isClosed = false,
      params = [],
      mediaUrl,
    }: RequestBody = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Número de telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch WhatsApp config
    const { data: config, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      console.error("[Template Test] Config error:", configError);
      return new Response(
        JSON.stringify({ success: false, error: "Configuração do WhatsApp não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number (Brazilian format)
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // Build endpoint
    const endpoint = `${config.api_url}/template`;

    // Build template object
    const templateObj: Record<string, unknown> = {
      name: templateName,
      language: {
        code: language,
      },
    };

    // Add components only if there are params or media
    if (params.length > 0 || mediaUrl) {
      const components: Array<Record<string, unknown>> = [];
      
      // Add header component for media
      if (mediaUrl) {
        components.push({
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: mediaUrl,
              },
            },
          ],
        });
      }
      
      // Add body component for text params
      if (params.length > 0) {
        components.push({
          type: "body",
          parameters: params.map((value) => ({
            type: "text",
            text: value,
          })),
        });
      }
      
      templateObj.components = components;
    }

    // Build request body
    const requestBody = {
      number: formattedPhone,
      isClosed,
      templateData: {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "template",
        template: templateObj,
      },
    };

    console.log("[Template Test] Endpoint:", endpoint);
    console.log("[Template Test] Template:", templateName);
    console.log("[Template Test] Phone:", formattedPhone);
    console.log("[Template Test] Params:", params);
    console.log("[Template Test] MediaUrl:", mediaUrl);
    console.log("[Template Test] Request body:", JSON.stringify(requestBody, null, 2));

    // Send request to Z-PRO API
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.api_key}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log("[Template Test] Response status:", response.status);
    console.log("[Template Test] Response body:", responseText);

    // Parse response
    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    const isSuccess = response.ok && result.success !== false && !result.error && !result.message?.includes("Missing");
    const messageId = result.messageId || result.key?.id || result.id || result.messages?.[0]?.id;

    // ========== SAVE WABA TEST LOG ==========
    try {
      await supabase.from("whatsapp_notification_logs").insert({
        function_name: "send-whatsapp-template-test",
        package_id: null,
        resident_id: null,
        phone: formattedPhone,
        template_name: templateName,
        template_language: language,
        request_payload: {
          templateParams: {
            phone: formattedPhone,
            templateName,
            language,
          },
          endpoint,
          isClosed,
        },
        response_status: response.status,
        response_body: responseText.substring(0, 2000),
        success: isSuccess,
        message_id: messageId || null,
        error_message: isSuccess ? null : (result.error || result.message || `HTTP ${response.status}`),
        debug_info: {
          requestBodySent: requestBody,
          isTestMessage: true,
        },
      });
      console.log("[Template Test] Log saved to whatsapp_notification_logs");
    } catch (logError) {
      console.error("[Template Test] Failed to save log:", logError);
    }

    if (isSuccess) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Template ${templateName} enviado com sucesso`,
          messageId,
          response: result 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Detect specific error types for better UX
      let userFriendlyError = result.error || result.message || `HTTP ${response.status}`;
      let possibleCauses: string[] = [];
      
      // Check for template not found / not approved errors (400 from Meta)
      const responseStr = JSON.stringify(result).toLowerCase();
      if (response.status === 400 || responseStr.includes("400") || responseStr.includes("err_bad_request")) {
        if (templateName !== "hello_world") {
          possibleCauses = [
            `Nome do template incorreto (você digitou: "${templateName}")`,
            `Código de idioma incorreto (você digitou: "${language}")`,
            "Template ainda não aprovado no Meta Business Manager",
            "Número de parâmetros diferente do configurado na Meta",
            "Template usa header/footer diferente do enviado",
          ];
          userFriendlyError = `Erro 400 da Meta ao enviar template "${templateName}".`;
        } else {
          possibleCauses = [
            "Token de acesso expirado ou inválido",
            "Instância não conectada ao Meta",
            "Credenciais incorretas no provedor",
          ];
          userFriendlyError = "Erro de conexão com a Meta.";
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: userFriendlyError,
          possibleCauses,
          debug: {
            status: response.status,
            endpoint,
            templateName,
            language,
            paramsCount: params.length,
            hasMedia: !!mediaUrl,
            requestBodySent: requestBody,
            response: result
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("[Template Test] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

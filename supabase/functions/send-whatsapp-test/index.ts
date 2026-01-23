import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WhatsAppProvider = "zpro" | "zapi" | "evolution" | "wppconnect";

interface ProviderSettings {
  apiUrl: string;
  apiKey: string;
  instanceId: string;
}

interface WhatsAppConfigRow {
  id: string;
  provider: string;
  api_url: string;
  api_key: string;
  instance_id: string;
  is_active: boolean;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
}

// ============================================
// Z-PRO Provider - Supports WABA and Legacy
// ============================================

function isZproWabaUrl(url: string): boolean {
  return url.includes("/v2/api/external/");
}

async function sendZproMessage(phone: string, message: string, config: ProviderSettings): Promise<SendResult> {
  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const phoneClean = phone.replace(/\D/g, "");
  
  console.log(`[Z-PRO] Sending to: ${phoneClean}`);
  console.log(`[Z-PRO] Base URL: ${baseUrl}`);
  
  try {
    if (isZproWabaUrl(baseUrl)) {
      // WABA (Official WhatsApp Business API) mode
      console.log("[Z-PRO] Using WABA mode (POST /SendMessageAPIText)");
      
      const endpoint = `${baseUrl}/SendMessageAPIText`;
      console.log(`[Z-PRO] Endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          number: phoneClean,
          body: message,
        }),
      });
      
      const responseText = await response.text();
      console.log(`[Z-PRO] Response status: ${response.status}`);
      console.log(`[Z-PRO] Response: ${responseText.substring(0, 300)}`);
      
      return parseZproResponse(response, responseText);
    } else {
      // Legacy /params/ mode
      console.log("[Z-PRO] Using Legacy mode (GET /params/)");
      
      let externalKey = config.instanceId || "";
      if (!externalKey || externalKey === "zpro-embedded") {
        externalKey = config.apiKey;
      }
      
      const params = new URLSearchParams({
        body: message,
        number: phoneClean,
        externalKey,
        bearertoken: config.apiKey,
        isClosed: "false",
      });
      
      const sendUrl = `${baseUrl}/params/?${params.toString()}`;
      console.log(`[Z-PRO] URL: ${sendUrl.substring(0, 150)}...`);
      
      const response = await fetch(sendUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      const responseText = await response.text();
      console.log(`[Z-PRO] Response status: ${response.status}`);
      console.log(`[Z-PRO] Response: ${responseText.substring(0, 300)}`);
      
      return parseZproResponse(response, responseText);
    }
  } catch (error: any) {
    console.error("[Z-PRO] Error:", error);
    return { success: false, error: `Erro de conexão: ${error.message}` };
  }
}

function parseZproResponse(response: Response, responseText: string): SendResult {
  // Check for HTML response (wrong endpoint)
  if (responseText.startsWith("<!DOCTYPE") || responseText.startsWith("<html")) {
    console.error("[Z-PRO] Received HTML - wrong endpoint");
    return { 
      success: false, 
      error: "Endpoint incorreto. Verifique a URL da API.",
      errorCode: "INVALID_ENDPOINT"
    };
  }
  
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    return { 
      success: false, 
      error: `Resposta inválida: ${responseText.substring(0, 100)}`,
      errorCode: "INVALID_RESPONSE"
    };
  }
  
  // Check for session error
  if (data.error === "ERR_API_REQUIRES_SESSION") {
    return { 
      success: false, 
      error: "Sessão do WhatsApp desconectada. Escaneie o QR Code no painel do provedor.",
      errorCode: "SESSION_DISCONNECTED"
    };
  }
  
  if (data.error) {
    return { success: false, error: data.error, errorCode: "API_ERROR" };
  }
  
  if (response.ok || response.status === 200 || response.status === 201) {
    const messageId = data.id || data.messageId || data.message_id || data.msgId || data.key?.id || data.wamid;
    
    if (messageId) {
      return { success: true, messageId: String(messageId) };
    }
    
    if (data.status === "success" || data.success === true || data.status === "PENDING" || data.sent === true) {
      return { success: true, messageId: `zpro_${Date.now()}` };
    }
    
    return { success: true, messageId: `zpro_${Date.now()}` };
  }
  
  return { success: false, error: data.message || `Erro ${response.status}`, errorCode: "HTTP_ERROR" };
}

// ============================================
// Other Providers
// ============================================

async function sendZapiMessage(phone: string, message: string, config: ProviderSettings): Promise<SendResult> {
  try {
    const response = await fetch(`${config.apiUrl}/instances/${config.instanceId}/token/${config.apiKey}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.replace(/\D/g, ""),
        message: message,
      }),
    });
    
    const data = await response.json();
    console.log("[Z-API] Response:", JSON.stringify(data).substring(0, 200));
    
    if (response.ok && data.zapiMessageId) {
      return { success: true, messageId: data.zapiMessageId };
    }
    return { success: false, error: data.message || "Erro ao enviar" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function sendEvolutionMessage(phone: string, message: string, config: ProviderSettings): Promise<SendResult> {
  try {
    const response = await fetch(`${config.apiUrl}/message/sendText/${config.instanceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.apiKey,
      },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ""),
        text: message,
      }),
    });
    
    const data = await response.json();
    console.log("[Evolution] Response:", JSON.stringify(data).substring(0, 200));
    
    if (response.ok && data.key?.id) {
      return { success: true, messageId: data.key.id };
    }
    return { success: false, error: data.message || "Erro ao enviar" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function sendWppconnectMessage(phone: string, message: string, config: ProviderSettings): Promise<SendResult> {
  try {
    const response = await fetch(`${config.apiUrl}/api/${config.instanceId}/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        phone: phone.replace(/\D/g, ""),
        message: message,
        isGroup: false,
      }),
    });
    
    const data = await response.json();
    console.log("[WPPConnect] Response:", JSON.stringify(data).substring(0, 200));
    
    if (response.ok && data.status === "success") {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data.message || "Erro ao enviar" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch WhatsApp config
    const { data: whatsappConfig, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error("Config error:", configError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar configuração" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!whatsappConfig) {
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, message } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Telefone obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedConfig = whatsappConfig as WhatsAppConfigRow;
    const provider = (typedConfig.provider || "zpro") as WhatsAppProvider;

    console.log(`[Main] Provider: ${provider}`);
    console.log(`[Main] API URL: ${typedConfig.api_url}`);

    const testMessage = message || `🔔 *Teste de Notificação*

Esta é uma mensagem de teste do sistema NotificaCondo.

Se você recebeu esta mensagem, a integração com WhatsApp está funcionando corretamente! ✅

_Enviado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}_`;

    const providerSettings: ProviderSettings = {
      apiUrl: typedConfig.api_url,
      apiKey: typedConfig.api_key,
      instanceId: typedConfig.instance_id,
    };

    let result: SendResult;

    switch (provider) {
      case "zpro":
        result = await sendZproMessage(phone, testMessage, providerSettings);
        break;
      case "zapi":
        result = await sendZapiMessage(phone, testMessage, providerSettings);
        break;
      case "evolution":
        result = await sendEvolutionMessage(phone, testMessage, providerSettings);
        break;
      case "wppconnect":
        result = await sendWppconnectMessage(phone, testMessage, providerSettings);
        break;
      default:
        result = { success: false, error: `Provedor desconhecido: ${provider}` };
    }

    if (result.success) {
      console.log(`[Main] Success! Message ID: ${result.messageId}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Mensagem enviada com sucesso!",
          message_id: result.messageId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error(`[Main] Failed: ${result.error}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          errorCode: result.errorCode,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: `Erro interno: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

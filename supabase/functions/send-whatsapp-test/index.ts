import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Multi-provider WhatsApp configuration
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
}

// Z-PRO Provider - Uses full URL and Bearer Token
async function sendZproMessage(phone: string, message: string, config: ProviderSettings): Promise<SendResult> {
  // Z-PRO API endpoint structure
  const baseUrl = config.apiUrl.replace(/\/$/, ""); // Remove trailing slash
  const sendUrl = `${baseUrl}/send-text`;
  
  console.log("Z-PRO sending to:", sendUrl);
  console.log("Phone:", phone.replace(/\D/g, ""));
  
  try {
    const response = await fetch(sendUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        phone: phone.replace(/\D/g, ""),
        message: message,
      }),
    });
    
    const responseText = await response.text();
    console.log("Z-PRO response status:", response.status);
    console.log("Z-PRO response body:", responseText.substring(0, 500));
    
    // Check if response is HTML (error page)
    if (responseText.startsWith("<!DOCTYPE") || responseText.startsWith("<html")) {
      console.error("Z-PRO returned HTML instead of JSON - endpoint might be incorrect");
      return { 
        success: false, 
        error: "API retornou página HTML. Verifique se a URL está correta." 
      };
    }
    
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response as JSON:", e);
      return { 
        success: false, 
        error: `Resposta inválida da API: ${responseText.substring(0, 100)}` 
      };
    }
    
    console.log("Z-PRO parsed response:", data);
    
    // Check for success indicators
    if (response.ok) {
      if (data.id || data.messageId || data.zapiMessageId || data.message_id) {
        return { success: true, messageId: data.id || data.messageId || data.zapiMessageId || data.message_id };
      }
      if (data.status === "success" || data.success === true) {
        return { success: true, messageId: data.id || "sent" };
      }
      // Even if no ID, if status is OK consider it success
      return { success: true, messageId: "sent" };
    }
    
    return { success: false, error: data.message || data.error || `Erro ${response.status}` };
  } catch (error: any) {
    console.error("Z-PRO fetch error:", error);
    return { success: false, error: `Erro de conexão: ${error.message}` };
  }
}

// Z-API Provider
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
    console.log("Z-API response:", data);
    
    if (response.ok && data.zapiMessageId) {
      return { success: true, messageId: data.zapiMessageId };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Evolution API Provider
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
    console.log("Evolution API response:", data);
    
    if (response.ok && data.key?.id) {
      return { success: true, messageId: data.key.id };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// WPPConnect Provider
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
    console.log("WPPConnect response:", data);
    
    if (response.ok && data.status === "success") {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

interface SendTestRequest {
  phone: string;
  message?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch WhatsApp config from database
    const { data: whatsappConfig, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error("Error fetching WhatsApp config:", configError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar configuração do WhatsApp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!whatsappConfig) {
      console.error("WhatsApp not configured in database");
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp não configurado. Configure no painel do Super Admin." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, message }: SendTestRequest = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Número de telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedConfig = whatsappConfig as WhatsAppConfigRow;
    const whatsappProvider = (typedConfig.provider || "zpro") as WhatsAppProvider;

    console.log(`Sending test message via ${whatsappProvider} to ${phone}`);
    console.log(`API URL: ${typedConfig.api_url}`);

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

    switch (whatsappProvider) {
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
        result = { success: false, error: `Provedor desconhecido: ${whatsappProvider}` };
    }

    if (result.success) {
      console.log("Test message sent successfully:", result.messageId);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Mensagem de teste enviada com sucesso!",
          message_id: result.messageId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error("Failed to send test message:", result.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || "Falha ao enviar mensagem de teste",
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

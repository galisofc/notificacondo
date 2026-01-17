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
  debug?: {
    endpoint?: string;
    status?: number;
    response?: string;
  };
}

// Z-PRO Provider - Send image via POST /url endpoint
async function sendZproImage(phone: string, imageUrl: string, caption: string, config: ProviderSettings): Promise<SendResult> {
  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const phoneClean = phone.replace(/\D/g, "");

  // Z-PRO Postman: BearerToken (auth header) + externalKey (body)
  const bearerToken = config.apiKey;
  const externalKey = config.instanceId || "";

  console.log("Z-PRO externalKey present:", Boolean(externalKey), "len:", externalKey?.length ?? 0);
  if (!externalKey || externalKey === "zpro-embedded") {
    return {
      success: false,
      error: "External Key não configurada (preencha o campo External Key no painel do WhatsApp).",
      debug: { endpoint: `${baseUrl}/url` },
    };
  }
  
  const targetUrl = `${baseUrl}/url`;
  console.log("Z-PRO image endpoint:", targetUrl);
  console.log("Phone:", phoneClean);
  console.log("Image URL:", imageUrl.substring(0, 100) + "...");
  
  try {
    if (!externalKey) {
      return {
        success: false,
        error: "External Key não configurada (preencha o campo External Key no painel).",
        debug: { endpoint: targetUrl },
      };
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        phone: phoneClean,
        url: imageUrl,
        caption: caption,
        externalKey,
      }),
    });
    
    const responseText = await response.text();
    console.log("Z-PRO response status:", response.status);
    console.log("Z-PRO response body:", responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse response as JSON:", e);
      return { 
        success: false, 
        error: `Resposta inválida da API: ${responseText.substring(0, 200)}`,
        debug: {
          endpoint: targetUrl,
          status: response.status,
          response: responseText.substring(0, 500),
        }
      };
    }
    
    console.log("Z-PRO parsed response:", data);
    
    if (response.ok) {
      if (data.id || data.messageId || data.zapiMessageId || data.message_id || data.key?.id) {
        return { 
          success: true, 
          messageId: data.id || data.messageId || data.zapiMessageId || data.message_id || data.key?.id,
          debug: { endpoint: targetUrl, status: response.status }
        };
      }
      if (data.status === "success" || data.success === true || data.status === "PENDING") {
        return { 
          success: true, 
          messageId: data.id || "sent",
          debug: { endpoint: targetUrl, status: response.status }
        };
      }
      return { 
        success: true, 
        messageId: "sent",
        debug: { endpoint: targetUrl, status: response.status }
      };
    }
    
    return { 
      success: false, 
      error: data.message || data.error || `Erro ${response.status}`,
      debug: {
        endpoint: targetUrl,
        status: response.status,
        response: responseText.substring(0, 500),
      }
    };
  } catch (error: any) {
    console.error("Z-PRO fetch error:", error);
    return { 
      success: false, 
      error: `Erro de conexão: ${error.message}`,
      debug: { endpoint: targetUrl }
    };
  }
}

// Z-API Provider
async function sendZapiImage(phone: string, imageUrl: string, caption: string, config: ProviderSettings): Promise<SendResult> {
  const phoneClean = phone.replace(/\D/g, "");
  const targetUrl = `${config.apiUrl}/instances/${config.instanceId}/token/${config.apiKey}/send-image`;
  
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phoneClean,
        image: imageUrl,
        caption: caption,
      }),
    });
    
    const data = await response.json();
    console.log("Z-API response:", data);
    
    if (response.ok && data.zapiMessageId) {
      return { success: true, messageId: data.zapiMessageId, debug: { endpoint: targetUrl, status: response.status } };
    }
    return { success: false, error: data.message || "Erro ao enviar imagem", debug: { endpoint: targetUrl, status: response.status } };
  } catch (error: any) {
    return { success: false, error: error.message, debug: { endpoint: targetUrl } };
  }
}

// Evolution API Provider
async function sendEvolutionImage(phone: string, imageUrl: string, caption: string, config: ProviderSettings): Promise<SendResult> {
  const phoneClean = phone.replace(/\D/g, "");
  const targetUrl = `${config.apiUrl}/message/sendMedia/${config.instanceId}`;
  
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.apiKey,
      },
      body: JSON.stringify({
        number: phoneClean,
        mediatype: "image",
        media: imageUrl,
        caption: caption,
      }),
    });
    
    const data = await response.json();
    console.log("Evolution API response:", data);
    
    if (response.ok && data.key?.id) {
      return { success: true, messageId: data.key.id, debug: { endpoint: targetUrl, status: response.status } };
    }
    return { success: false, error: data.message || "Erro ao enviar imagem", debug: { endpoint: targetUrl, status: response.status } };
  } catch (error: any) {
    return { success: false, error: error.message, debug: { endpoint: targetUrl } };
  }
}

// WPPConnect Provider
async function sendWppconnectImage(phone: string, imageUrl: string, caption: string, config: ProviderSettings): Promise<SendResult> {
  const phoneClean = phone.replace(/\D/g, "");
  const targetUrl = `${config.apiUrl}/api/${config.instanceId}/send-file-url`;
  
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        phone: phoneClean,
        url: imageUrl,
        caption: caption,
        isGroup: false,
      }),
    });
    
    const data = await response.json();
    console.log("WPPConnect response:", data);
    
    if (response.ok && data.status === "success") {
      return { success: true, messageId: data.id, debug: { endpoint: targetUrl, status: response.status } };
    }
    return { success: false, error: data.message || "Erro ao enviar imagem", debug: { endpoint: targetUrl, status: response.status } };
  } catch (error: any) {
    return { success: false, error: error.message, debug: { endpoint: targetUrl } };
  }
}

interface SendImageTestRequest {
  phone: string;
  image_url?: string;
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

    const { phone, image_url }: SendImageTestRequest = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Número de telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedConfig = whatsappConfig as WhatsAppConfigRow;
    const whatsappProvider = (typedConfig.provider || "zpro") as WhatsAppProvider;

    console.log(`Sending test image via ${whatsappProvider} to ${phone}`);
    console.log(`API URL: ${typedConfig.api_url}`);

    // Use a default test image if not provided
    const testImageUrl = image_url || "https://placehold.co/600x400/3B82F6/FFFFFF/png?text=📦+NotificaCondo";
    
    const testCaption = `🖼️ *Teste de Envio de Imagem*

Esta é uma imagem de teste do sistema NotificaCondo.

Se você recebeu esta imagem, o envio de fotos de encomendas está funcionando corretamente! ✅

_Enviado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}_`;

    const providerSettings: ProviderSettings = {
      apiUrl: typedConfig.api_url,
      apiKey: typedConfig.api_key,
      instanceId: typedConfig.instance_id,
    };

    let result: SendResult;

    switch (whatsappProvider) {
      case "zpro":
        result = await sendZproImage(phone, testImageUrl, testCaption, providerSettings);
        break;
      case "zapi":
        result = await sendZapiImage(phone, testImageUrl, testCaption, providerSettings);
        break;
      case "evolution":
        result = await sendEvolutionImage(phone, testImageUrl, testCaption, providerSettings);
        break;
      case "wppconnect":
        result = await sendWppconnectImage(phone, testImageUrl, testCaption, providerSettings);
        break;
      default:
        result = { success: false, error: `Provedor desconhecido: ${whatsappProvider}` };
    }

    if (result.success) {
      console.log("Test image sent successfully:", result.messageId);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Imagem de teste enviada com sucesso!",
          message_id: result.messageId,
          debug: result.debug,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error("Failed to send test image:", result.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || "Falha ao enviar imagem de teste",
          debug: result.debug,
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

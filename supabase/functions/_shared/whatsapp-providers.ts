/**
 * Shared WhatsApp Provider Utilities
 * Centralizes all WhatsApp API integrations for consistency
 */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export type WhatsAppProvider = "zpro" | "zapi" | "evolution" | "wppconnect";

export interface ProviderSettings {
  apiUrl: string;
  apiKey: string;
  instanceId: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
}

export interface WhatsAppConfigRow {
  id: string;
  provider: string;
  api_url: string;
  api_key: string;
  instance_id: string;
  is_active: boolean;
  app_url?: string;
}

/**
 * Z-PRO Provider - Uses GET /params/ endpoint for text messages
 * This is the standard endpoint for Z-PRO/AtenderChat API
 */
export async function sendZproMessage(
  phone: string, 
  message: string, 
  config: ProviderSettings,
  imageUrl?: string
): Promise<SendResult> {
  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const phoneClean = phone.replace(/\D/g, "");
  
  console.log(`[Z-PRO] Sending message to: ${phoneClean}`);
  console.log(`[Z-PRO] API URL: ${baseUrl}`);
  
  try {
    // Determine externalKey - fallback to apiKey if instanceId is empty or "zpro-embedded"
    let externalKey = config.instanceId || "";
    if (!externalKey || externalKey === "zpro-embedded") {
      externalKey = config.apiKey;
    }
    console.log(`[Z-PRO] externalKey: ${externalKey ? externalKey.substring(0, 10) + "..." : "(empty)"}`);
    
    if (imageUrl) {
      // For images, use POST /url endpoint
      console.log(`[Z-PRO] Sending image via /url endpoint`);
      const targetUrl = `${baseUrl}/url`;
      
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          mediaUrl: imageUrl,
          caption: message,
          number: phoneClean,
          externalKey,
          isClosed: false,
        }),
      });
      
      const responseText = await response.text();
      console.log(`[Z-PRO] Image response status: ${response.status}`);
      console.log(`[Z-PRO] Image response: ${responseText.substring(0, 300)}`);
      
      return parseZproResponse(response, responseText);
    } else {
      // Text only via GET /params/
      const params = new URLSearchParams({
        body: message,
        number: phoneClean,
        externalKey,
        bearertoken: config.apiKey,
        isClosed: "false",
      });
      
      const sendUrl = `${baseUrl}/params/?${params.toString()}`;
      console.log(`[Z-PRO] GET URL: ${sendUrl.substring(0, 150)}...`);
      
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
    console.error("[Z-PRO] Unexpected error:", error);
    return { success: false, error: `Erro de conexão: ${error.message}` };
  }
}

/**
 * Parse Z-PRO API response (works for both WABA and Legacy)
 */
function parseZproResponse(response: Response, responseText: string): SendResult {
  // Check for HTML response (usually indicates wrong endpoint)
  if (responseText.startsWith("<!DOCTYPE") || responseText.startsWith("<html")) {
    console.error("[Z-PRO] Received HTML response - likely wrong endpoint");
    return { 
      success: false, 
      error: "Endpoint incorreto. Verifique a URL da API configurada.",
      errorCode: "INVALID_ENDPOINT"
    };
  }
  
  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    console.error("[Z-PRO] Failed to parse JSON response");
    return { 
      success: false, 
      error: `Resposta inválida da API: ${responseText.substring(0, 100)}`,
      errorCode: "INVALID_RESPONSE"
    };
  }
  
  // Check for session disconnected error
  if (data.error === "ERR_API_REQUIRES_SESSION") {
    return { 
      success: false, 
      error: "Sessão do WhatsApp desconectada. Acesse o painel do provedor (AtenderChat/Z-PRO) e escaneie o QR Code para reconectar.",
      errorCode: "SESSION_DISCONNECTED"
    };
  }
  
  // Check for other common errors
  if (data.error) {
    return { 
      success: false, 
      error: data.error,
      errorCode: "API_ERROR"
    };
  }
  
  // Success cases
  if (response.ok || response.status === 200 || response.status === 201) {
    // Try to extract message ID from various response formats
    const messageId = 
      data.id || 
      data.messageId || 
      data.message_id ||
      data.msgId ||
      data.key?.id ||
      data.zapiMessageId ||
      data.wamid;
    
    if (messageId) {
      return { success: true, messageId: String(messageId) };
    }
    
    // Check for success indicators without message ID
    if (data.status === "success" || data.success === true || data.status === "PENDING" || data.sent === true) {
      const trackingId = `zpro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[Z-PRO] Success without message ID, using tracking: ${trackingId}`);
      return { success: true, messageId: trackingId };
    }
    
    // If status is OK, consider it success
    const trackingId = `zpro_${Date.now()}`;
    return { success: true, messageId: trackingId };
  }
  
  return { 
    success: false, 
    error: data.message || data.error || `Erro ${response.status}`,
    errorCode: "HTTP_ERROR"
  };
}

/**
 * Z-API Provider
 */
export async function sendZapiMessage(
  phone: string, 
  message: string, 
  config: ProviderSettings,
  imageUrl?: string
): Promise<SendResult> {
  try {
    const phoneClean = phone.replace(/\D/g, "");
    let endpoint: string;
    let body: any;
    
    if (imageUrl) {
      endpoint = `${config.apiUrl}/instances/${config.instanceId}/token/${config.apiKey}/send-image`;
      body = {
        phone: phoneClean,
        image: imageUrl,
        caption: message,
      };
    } else {
      endpoint = `${config.apiUrl}/instances/${config.instanceId}/token/${config.apiKey}/send-text`;
      body = {
        phone: phoneClean,
        message: message,
      };
    }
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    console.log("[Z-API] Response:", JSON.stringify(data).substring(0, 200));
    
    if (response.ok && data.zapiMessageId) {
      return { success: true, messageId: data.zapiMessageId };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  } catch (error: any) {
    console.error("[Z-API] Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Evolution API Provider
 */
export async function sendEvolutionMessage(
  phone: string, 
  message: string, 
  config: ProviderSettings,
  imageUrl?: string
): Promise<SendResult> {
  try {
    const phoneClean = phone.replace(/\D/g, "");
    let endpoint: string;
    let body: any;
    
    if (imageUrl) {
      endpoint = `${config.apiUrl}/message/sendMedia/${config.instanceId}`;
      body = {
        number: phoneClean,
        mediatype: "image",
        media: imageUrl,
        caption: message,
      };
    } else {
      endpoint = `${config.apiUrl}/message/sendText/${config.instanceId}`;
      body = {
        number: phoneClean,
        text: message,
      };
    }
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.apiKey,
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    console.log("[Evolution] Response:", JSON.stringify(data).substring(0, 200));
    
    if (response.ok && data.key?.id) {
      return { success: true, messageId: data.key.id };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  } catch (error: any) {
    console.error("[Evolution] Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * WPPConnect Provider
 */
export async function sendWppconnectMessage(
  phone: string, 
  message: string, 
  config: ProviderSettings,
  imageUrl?: string
): Promise<SendResult> {
  try {
    const phoneClean = phone.replace(/\D/g, "");
    let endpoint: string;
    let body: any;
    
    if (imageUrl) {
      endpoint = `${config.apiUrl}/api/${config.instanceId}/send-file-url`;
      body = {
        phone: phoneClean,
        url: imageUrl,
        caption: message,
        isGroup: false,
      };
    } else {
      endpoint = `${config.apiUrl}/api/${config.instanceId}/send-message`;
      body = {
        phone: phoneClean,
        message: message,
        isGroup: false,
      };
    }
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    console.log("[WPPConnect] Response:", JSON.stringify(data).substring(0, 200));
    
    if (response.ok && data.status === "success") {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  } catch (error: any) {
    console.error("[WPPConnect] Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send message using the appropriate provider
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string,
  provider: WhatsAppProvider,
  config: ProviderSettings,
  imageUrl?: string
): Promise<SendResult> {
  console.log(`[WhatsApp] Sending via ${provider} to ${phone.replace(/\D/g, "")}`);
  
  switch (provider) {
    case "zpro":
      return sendZproMessage(phone, message, config, imageUrl);
    case "zapi":
      return sendZapiMessage(phone, message, config, imageUrl);
    case "evolution":
      return sendEvolutionMessage(phone, message, config, imageUrl);
    case "wppconnect":
      return sendWppconnectMessage(phone, message, config, imageUrl);
    default:
      return { success: false, error: `Provedor desconhecido: ${provider}` };
  }
}

/**
 * Test Z-PRO connection
 * Returns connection status using GET /params/ endpoint
 */
export async function testZproConnection(config: ProviderSettings): Promise<SendResult> {
  const baseUrl = config.apiUrl.replace(/\/$/, "");
  
  console.log(`[Z-PRO] Testing connection to: ${baseUrl}`);
  
  try {
    // Use GET /params/ endpoint for testing
    let externalKey = config.instanceId || "";
    if (!externalKey || externalKey === "zpro-embedded") {
      externalKey = config.apiKey;
    }
    
    const params = new URLSearchParams({
      body: "ping",
      number: "5511999999999",
      externalKey,
      bearertoken: config.apiKey,
      isClosed: "false",
    });
    
    const testUrl = `${baseUrl}/params/?${params.toString()}`;
    console.log(`[Z-PRO] Test URL: ${testUrl.substring(0, 100)}...`);
    
    const response = await fetch(testUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    const responseText = await response.text();
    console.log(`[Z-PRO] Test response: ${response.status} - ${responseText.substring(0, 200)}`);
    
    return parseZproResponse(response, responseText);
  } catch (error: any) {
    console.error("[Z-PRO] Connection test error:", error);
    return { success: false, error: `Erro de conexão: ${error.message}` };
  }
}

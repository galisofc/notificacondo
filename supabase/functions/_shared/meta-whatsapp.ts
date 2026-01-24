/**
 * Meta WhatsApp Cloud API - Direct Integration
 * 
 * This module provides direct communication with Meta's official WhatsApp Cloud API
 * without any intermediary gateways (Z-PRO, Z-API, etc.)
 * 
 * Official Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const META_API_VERSION = "v20.0";
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// ============= Types =============

export interface MetaWhatsAppConfig {
  phoneNumberId: string;  // The Phone Number ID from Meta Business Manager
  accessToken: string;    // Permanent Access Token from Meta
}

export interface MetaSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  debug?: {
    endpoint?: string;
    status?: number;
    response?: string;
    payload?: unknown;
  };
}

export interface MetaTemplateParams {
  phone: string;
  templateName: string;
  language: string;
  bodyParams?: string[];
  headerMediaUrl?: string;
  headerMediaType?: "image" | "video" | "document";
  // Support for named parameters (some templates require explicit parameter names)
  bodyParamNames?: string[];
}

export interface MetaTextMessageParams {
  phone: string;
  message: string;
  previewUrl?: boolean;
}

export interface MetaImageMessageParams {
  phone: string;
  imageUrl: string;
  caption?: string;
}

// ============= Utilities =============

/**
 * Formats phone number to international format required by Meta
 * Meta requires: country code + number (e.g., 5511999999999)
 */
export function formatPhoneForMeta(phone: string): string {
  if (!phone) return "";
  
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, "");
  
  // Ensure it starts with 55 (Brazil)
  if (!cleaned.startsWith("55")) {
    cleaned = "55" + cleaned;
  }
  
  return cleaned;
}

/**
 * Get Meta WhatsApp config from environment variables
 */
export function getMetaConfig(): MetaWhatsAppConfig {
  const phoneNumberId = Deno.env.get("META_WHATSAPP_PHONE_ID");
  const accessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
  
  if (!phoneNumberId || !accessToken) {
    throw new Error("META_WHATSAPP_PHONE_ID and META_WHATSAPP_ACCESS_TOKEN must be configured");
  }
  
  return { phoneNumberId, accessToken };
}

/**
 * Check if Meta WhatsApp is configured
 */
export function isMetaConfigured(): boolean {
  const phoneNumberId = Deno.env.get("META_WHATSAPP_PHONE_ID");
  const accessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
  return Boolean(phoneNumberId && accessToken);
}

// ============= Message Sending Functions =============

/**
 * Send a template message via Meta WhatsApp Cloud API
 * 
 * @example
 * await sendMetaTemplate({
 *   phone: "5511999999999",
 *   templateName: "hello_world",
 *   language: "pt_BR",
 *   bodyParams: ["João", "Bloco A", "101"],
 *   headerMediaUrl: "https://example.com/image.jpg",
 *   headerMediaType: "image"
 * });
 */
export async function sendMetaTemplate(
  params: MetaTemplateParams,
  config?: MetaWhatsAppConfig
): Promise<MetaSendResult> {
  const cfg = config || getMetaConfig();
  const formattedPhone = formatPhoneForMeta(params.phone);
  const endpoint = `${META_API_BASE_URL}/${cfg.phoneNumberId}/messages`;
  
  // Build template components
  const components: Array<Record<string, unknown>> = [];
  
  // Add header component if media is present
  if (params.headerMediaUrl) {
    const mediaType = params.headerMediaType || "image";
    components.push({
      type: "header",
      parameters: [
        {
          type: mediaType,
          [mediaType]: {
            link: params.headerMediaUrl,
          },
        },
      ],
    });
  }
  
  // Add body component with text parameters
  // IMPORTANT: Meta API rejects empty text values - must use placeholder "-" for empty/null values
  // Use simple positional format: { type: "text", text: "value" }
  if (params.bodyParams && params.bodyParams.length > 0) {
    const validParams = params.bodyParams.map((value) => {
      // Convert to string and trim
      const strValue = String(value ?? "").trim();
      // Use "-" as placeholder if empty (Meta rejects empty strings)
      return {
        type: "text",
        text: strValue || "-",
      };
    });
    
    components.push({
      type: "body",
      parameters: validParams,
    });
  }
  
  // Build the full request payload
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: params.templateName,
      language: {
        code: params.language,
      },
    },
  };
  
  // Add components only if there are any
  if (components.length > 0) {
    (payload.template as Record<string, unknown>).components = components;
  }
  
  console.log(`[META] Sending template "${params.templateName}" to ${params.phone}`);
  console.log(`[META] Endpoint: ${endpoint}`);
  console.log(`[META] Payload: ${JSON.stringify(payload).substring(0, 500)}...`);
  
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    
    const responseText = await response.text();
    console.log(`[META] Response status: ${response.status}`);
    console.log(`[META] Response body: ${responseText.substring(0, 500)}`);
    
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }
    
    if (!response.ok) {
      // Parse Meta error response
      const metaError = responseData?.error;
      const errorMessage = metaError?.message || responseData?.message || `HTTP ${response.status}`;
      const errorCode = metaError?.code?.toString() || response.status.toString();
      
      return {
        success: false,
        error: errorMessage,
        errorCode,
        debug: {
          endpoint,
          status: response.status,
          response: responseText.substring(0, 500),
          payload,
        },
      };
    }
    
    // Extract message ID from Meta response
    const messageId = responseData?.messages?.[0]?.id;
    
    return {
      success: true,
      messageId,
      debug: {
        endpoint,
        status: response.status,
      },
    };
  } catch (error) {
    console.error(`[META] Error sending template:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      debug: {
        endpoint,
        payload,
      },
    };
  }
}

/**
 * Send a free-text message via Meta WhatsApp Cloud API
 * Note: Only works for conversations within the 24-hour window
 */
export async function sendMetaText(
  params: MetaTextMessageParams,
  config?: MetaWhatsAppConfig
): Promise<MetaSendResult> {
  const cfg = config || getMetaConfig();
  const formattedPhone = formatPhoneForMeta(params.phone);
  const endpoint = `${META_API_BASE_URL}/${cfg.phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "text",
    text: {
      preview_url: params.previewUrl ?? false,
      body: params.message,
    },
  };
  
  console.log(`[META] Sending text message to ${params.phone}`);
  console.log(`[META] Endpoint: ${endpoint}`);
  
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    
    const responseText = await response.text();
    console.log(`[META] Response status: ${response.status}`);
    console.log(`[META] Response body: ${responseText.substring(0, 500)}`);
    
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }
    
    if (!response.ok) {
      const metaError = responseData?.error;
      return {
        success: false,
        error: metaError?.message || `HTTP ${response.status}`,
        errorCode: metaError?.code?.toString(),
        debug: {
          endpoint,
          status: response.status,
          response: responseText.substring(0, 500),
          payload,
        },
      };
    }
    
    return {
      success: true,
      messageId: responseData?.messages?.[0]?.id,
      debug: {
        endpoint,
        status: response.status,
      },
    };
  } catch (error) {
    console.error(`[META] Error sending text:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      debug: { endpoint, payload },
    };
  }
}

/**
 * Send an image message via Meta WhatsApp Cloud API
 * Note: Only works for conversations within the 24-hour window
 */
export async function sendMetaImage(
  params: MetaImageMessageParams,
  config?: MetaWhatsAppConfig
): Promise<MetaSendResult> {
  const cfg = config || getMetaConfig();
  const formattedPhone = formatPhoneForMeta(params.phone);
  const endpoint = `${META_API_BASE_URL}/${cfg.phoneNumberId}/messages`;
  
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "image",
    image: {
      link: params.imageUrl,
    },
  };
  
  if (params.caption) {
    (payload.image as Record<string, unknown>).caption = params.caption;
  }
  
  console.log(`[META] Sending image to ${params.phone}`);
  console.log(`[META] Image URL: ${params.imageUrl.substring(0, 100)}...`);
  
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    
    const responseText = await response.text();
    console.log(`[META] Response status: ${response.status}`);
    console.log(`[META] Response body: ${responseText.substring(0, 500)}`);
    
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }
    
    if (!response.ok) {
      const metaError = responseData?.error;
      return {
        success: false,
        error: metaError?.message || `HTTP ${response.status}`,
        errorCode: metaError?.code?.toString(),
        debug: {
          endpoint,
          status: response.status,
          response: responseText.substring(0, 500),
          payload,
        },
      };
    }
    
    return {
      success: true,
      messageId: responseData?.messages?.[0]?.id,
      debug: {
        endpoint,
        status: response.status,
      },
    };
  } catch (error) {
    console.error(`[META] Error sending image:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      debug: { endpoint, payload },
    };
  }
}

// ============= Utility Functions =============

/**
 * Builds the params array from a variables object following the params_order
 * 
 * @param variables - Object with variable names and values (e.g., { nome: "João", bloco: "A" })
 * @param paramsOrder - Array with the order of variables (e.g., ["nome", "bloco", "apartamento"])
 * @returns Object with values array and names array
 */
export function buildParamsArray(
  variables: Record<string, string | undefined>,
  paramsOrder: string[]
): { values: string[]; names: string[] } {
  const values = paramsOrder.map(varName => {
    const value = variables[varName];
    // Use "-" as placeholder if empty (Meta API rejects empty strings)
    const strValue = String(value ?? "").trim();
    return strValue || "-";
  });
  
  return {
    values,
    names: paramsOrder,
  };
}

/**
 * Test connection to Meta WhatsApp API
 * Uses the "get phone number" endpoint to verify credentials
 */
export async function testMetaConnection(config?: MetaWhatsAppConfig): Promise<MetaSendResult> {
  const cfg = config || getMetaConfig();
  const endpoint = `${META_API_BASE_URL}/${cfg.phoneNumberId}`;
  
  console.log(`[META] Testing connection to ${endpoint}`);
  
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${cfg.accessToken}`,
      },
    });
    
    const responseText = await response.text();
    console.log(`[META] Test response status: ${response.status}`);
    console.log(`[META] Test response: ${responseText.substring(0, 300)}`);
    
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }
    
    if (!response.ok) {
      const metaError = responseData?.error;
      return {
        success: false,
        error: metaError?.message || `HTTP ${response.status}`,
        errorCode: metaError?.code?.toString(),
        debug: {
          endpoint,
          status: response.status,
          response: responseText.substring(0, 300),
        },
      };
    }
    
    return {
      success: true,
      debug: {
        endpoint,
        status: response.status,
        response: JSON.stringify({
          verified_name: responseData?.verified_name,
          display_phone_number: responseData?.display_phone_number,
          quality_rating: responseData?.quality_rating,
        }),
      },
    };
  } catch (error) {
    console.error(`[META] Connection test error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      debug: { endpoint },
    };
  }
}

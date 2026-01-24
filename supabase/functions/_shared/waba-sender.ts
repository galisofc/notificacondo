/**
 * WABA Template Sender - Shared utility for sending WhatsApp messages via WABA templates
 * Uses the /template endpoint for Meta-approved templates (Z-PRO / Atende Aí Chat)
 */

export interface WabaConfig {
  apiUrl: string;
  apiKey: string;
  instanceId: string;
}

export interface WabaSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  debug?: {
    endpoint?: string;
    status?: number;
    response?: string;
    payload?: unknown;
  };
}

export interface WabaTemplateParams {
  phone: string;
  templateName: string;
  language: string;
  params: string[];
  mediaUrl?: string;  // URL for header image/video/document
  mediaType?: "image" | "video" | "document";
  hasFooter?: boolean;  // Whether the template has a static footer (no params)
}

/**
 * Formats phone number to Brazilian format (5511999999999)
 */
export function formatPhoneForWaba(phone: string): string {
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
 * Builds the components array for WABA template in Meta Cloud API format
 * Format: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages#template-object
 * 
 * Structure expected by Meta/WhatsApp:
 * - Header (optional): { type: "header", parameters: [{ type: "image", image: { link: "url" } }] }
 * - Body: { type: "body", parameters: [{ type: "text", text: "value" }, ...] }
 */
function buildTemplateComponents(
  params: string[],
  mediaUrl?: string,
  mediaType?: string,
  hasFooter?: boolean
): Array<Record<string, unknown>> {
  const components: Array<Record<string, unknown>> = [];

  // Add header component if media is present (image/video/document)
  // CRITICAL: For image/video/document headers, ONLY include the media object.
  // Adding ANY other field (like "text": "") breaks Meta API with error 400.
  if (mediaUrl) {
    const mediaTypeKey = mediaType || "image";
    
    // Build the parameter object with ONLY type and the media object
    // Do NOT add "text" field - Meta rejects it even if empty
    const headerParameter: Record<string, unknown> = {
      type: mediaTypeKey,
    };
    headerParameter[mediaTypeKey] = {
      link: mediaUrl,
    };
    
    components.push({
      type: "header",
      parameters: [headerParameter],
    });
  }

  // Add body component with text parameters
  // Each parameter is an object: { type: "text", text: "value" }
  if (params.length > 0) {
    components.push({
      type: "body",
      parameters: params.map((value) => ({
        type: "text",
        text: String(value || ""),
      })),
    });
  }

  // NOTE: Static footers do NOT need to be included in components array
  // Per Meta API: only dynamic components (with variables) need to be sent
  // The footer is defined in the template itself and renders automatically
  // Sending { type: "footer", parameters: [] } causes Error 400!

  return components;
}

/**
 * Sends a WABA template message via Z-PRO /template endpoint
 * Uses the templateData structure required by Atende Aí Chat API
 * 
 * @param template - Template parameters (phone, templateName, language, params)
 * @param config - WhatsApp API configuration (apiUrl, apiKey, instanceId)
 * @returns WabaSendResult with success status and optional messageId or error
 */
export async function sendWabaTemplate(
  template: WabaTemplateParams,
  config: WabaConfig
): Promise<WabaSendResult> {
  const { phone, templateName, language, params, mediaUrl, mediaType } = template;
  const { apiUrl, apiKey } = config;

  const formattedPhone = formatPhoneForWaba(phone);
  
  // Use /template endpoint (same as successful test)
  const endpoint = `${apiUrl}/template`;
  
  // Build request body in Z-PRO format (matching the successful hello_world test)
  // Z-PRO uses "templateParams" object, NOT the complex Meta "templateData" format
  const templateParams: Record<string, unknown> = {
    phone: formattedPhone,
    language: language,
    templateName: templateName,
  };

  // Add params array if there are body variables
  // Z-PRO expects: params: ["value1", "value2", ...]
  if (params.length > 0) {
    templateParams.params = params;
  }

  // Add header image if present
  // Z-PRO format for image header
  if (mediaUrl) {
    templateParams.header = {
      type: mediaType || "image",
      link: mediaUrl,
    };
  }

  const requestBody: Record<string, unknown> = {
    number: formattedPhone,
    isClosed: false,
    templateParams: templateParams,
  };

  console.log(`[WABA] Sending template "${templateName}" to ${phone}`);
  console.log(`[WABA] Endpoint: ${endpoint}`);
  console.log(`[WABA] Params count: ${params.length}`);
  console.log(`[WABA] Template params: ${JSON.stringify(templateParams).substring(0, 300)}...`);
  console.log(`[WABA] FULL PAYLOAD: ${JSON.stringify(requestBody)}`);
  if (mediaUrl) {
    console.log(`[WABA] Has media header: ${mediaType || "image"}`);
  }

  try {
    const doRequest = async (body: Record<string, unknown>) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });
      const responseText = await response.text();
      return { response, responseText };
    };

    // First attempt: with all components (including header image when provided)
    let { response, responseText } = await doRequest(requestBody);

    console.log(`[WABA] Response status: ${response.status}`);
    console.log(`[WABA] Response body: ${responseText.substring(0, 500)}`);

    // Try to parse as JSON
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    // Check for known Z-PRO errors
    if (responseText.includes("ERR_API_REQUIRES_SESSION")) {
      return {
        success: false,
        error: "SESSION_DISCONNECTED",
        debug: {
          endpoint,
          status: response.status,
          response: responseText.substring(0, 200),
          payload: requestBody,
        }
      };
    }

    // Check for missing fields error
    if (responseText.includes("Missing required fields") || responseText.includes("Missing")) {
      return {
        success: false,
        error: responseData?.message || "Missing required fields in template",
        debug: {
          endpoint,
          status: response.status,
          response: responseText.substring(0, 200),
          payload: requestBody,
        }
      };
    }

    // If the request failed, return error immediately
    // NOTE: Previously we had retry logic that removed the header, but this breaks
    // templates that REQUIRE a header image (like encomenda_management_5).
    // If you need retry-without-header for templates WITHOUT header, add a flag to WabaTemplateParams.

    if (!response.ok) {
      return {
        success: false,
        error: responseData?.message || responseData?.error || `HTTP ${response.status}`,
        debug: {
          endpoint,
          status: response.status,
          response: responseText.substring(0, 200),
          payload: requestBody,
        }
      };
    }

    // Extract message ID from response (Z-PRO format)
    const messageId = responseData?.messageId || 
                      responseData?.key?.id || 
                      responseData?.id || 
                      responseData?.data?.key?.id ||
                      responseData?.messages?.[0]?.id;

    return {
      success: true,
      messageId,
      debug: {
        endpoint,
        status: response.status
      }
    };

  } catch (error) {
    console.error(`[WABA] Error sending template:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      debug: {
        endpoint,
        payload: requestBody,
      }
    };
  }
}

/**
 * Builds the params array from a variables object following the params_order
 * 
 * @param variables - Object with variable names and values (e.g., { nome: "João", bloco: "A" })
 * @param paramsOrder - Array with the order of variables (e.g., ["nome", "bloco", "apartamento"])
 * @returns Array of string values in the correct order
 */
export function buildParamsArray(
  variables: Record<string, string | undefined>,
  paramsOrder: string[]
): string[] {
  return paramsOrder.map(varName => {
    const value = variables[varName];
    // Return empty string if undefined/null to maintain position
    return value ?? "";
  });
}

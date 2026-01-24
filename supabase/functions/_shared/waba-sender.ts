/**
 * WABA Template Sender - Shared utility for sending WhatsApp messages via WABA templates
 * Uses the /templateBody endpoint for Meta-approved templates
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
 * Required by Z-PRO /templateBody endpoint
 */
function buildTemplateComponents(
  params: string[],
  mediaUrl?: string,
  mediaType?: string
): Array<Record<string, unknown>> {
  const components: Array<Record<string, unknown>> = [];

  // Add header component if media is present
  if (mediaUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: mediaType || "image",
          [mediaType || "image"]: {
            link: mediaUrl,
          },
        },
      ],
    });
  }

  // Add body component with text parameters
  if (params.length > 0) {
    components.push({
      type: "body",
      parameters: params.map((value) => ({
        type: "text",
        text: value,
      })),
    });
  }

  return components;
}

/**
 * Sends a WABA template message via Z-PRO /templateBody endpoint
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
  const { apiUrl, apiKey, instanceId } = config;

  // Determine externalKey (fallback logic for zpro-embedded or null instanceId)
  const externalKey = (!instanceId || instanceId === "zpro-embedded") ? apiKey : instanceId;

  const endpoint = `${apiUrl}/templateBody`;
  
  // Build components array in Meta Cloud API format
  const components = buildTemplateComponents(params, mediaUrl, mediaType);

  // Build request body with proper Meta WABA structure
  const requestBody: Record<string, unknown> = {
    number: formatPhoneForWaba(phone),
    externalKey,
    templateName,
    language,
    components,  // Meta Cloud API format with typed parameters
  };

  console.log(`[WABA] Sending template "${templateName}" to ${phone}`);
  console.log(`[WABA] Endpoint: ${endpoint}`);
  console.log(`[WABA] Params count: ${params.length}`);
  console.log(`[WABA] Components: ${JSON.stringify(components).substring(0, 300)}...`);
  if (mediaUrl) {
    console.log(`[WABA] Has media header: ${mediaType || "image"}`);
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
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
                      responseData?.data?.key?.id;

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

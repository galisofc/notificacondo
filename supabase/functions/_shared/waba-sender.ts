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
  mediaType?: string
): Array<Record<string, unknown>> {
  const components: Array<Record<string, unknown>> = [];

  // Add header component if media is present (image/video/document)
  if (mediaUrl) {
    const type = mediaType || "image";
    components.push({
      type: "header",
      parameters: [
        {
          type: type,
          [type]: {
            link: mediaUrl,
          },
        },
      ],
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
  const { apiUrl, apiKey, instanceId } = config;

  const formattedPhone = formatPhoneForWaba(phone);
  
  // Use /templateBody endpoint (per Postman / Atende Aí Chat docs)
  const endpoint = `${apiUrl}/templateBody`;
  
  // Build components array in Meta Cloud API format
  const components = buildTemplateComponents(params, mediaUrl, mediaType);

  // Build request body with templateData structure (required by Z-PRO)
  // Determine externalKey (fallback logic for zpro-embedded or null instanceId)
  const externalKey = (!instanceId || instanceId === "zpro-embedded") ? apiKey : instanceId;

  // Build the templateData following exact Meta Cloud API format
  // Reference: User-provided correct payload structure
  const buildRequestBody = (componentsToSend: Array<Record<string, unknown>>) => {
    // The inner template object follows Meta Cloud API format exactly
    const templateObject: Record<string, unknown> = {
      name: templateName,
      language: {
        code: language,
      },
    };

    // Only add components if there are any (header and/or body)
    if (componentsToSend.length > 0) {
      templateObject.components = componentsToSend;
    }

    return {
      number: formattedPhone,
      externalKey,
      isClosed: false,
      templateData: {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "template",
        template: templateObject,
      },
    };
  };

  const requestBody: Record<string, unknown> = buildRequestBody(components);

  console.log(`[WABA] Sending template "${templateName}" to ${phone}`);
  console.log(`[WABA] Endpoint: ${endpoint}`);
  console.log(`[WABA] Params count: ${params.length}`);
  console.log(`[WABA] Components: ${JSON.stringify(components).substring(0, 300)}...`);
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

    // Some setups reject templates if we send a header image but the template doesn't have a header.
    // Z-PRO sometimes returns 500 while embedding a Meta 400 inside the message (AxiosError).
    // Retry once without header component on:
    // - direct 400
    // - 500 containing "status code 400"
    const indicatesMeta400 = response.status === 500 && responseText.includes("status code 400");

    if (!response.ok && mediaUrl && (response.status === 400 || indicatesMeta400)) {
      const componentsWithoutHeader = components.filter((c) => c.type !== "header");
      const retryBody = buildRequestBody(componentsWithoutHeader);
      console.log(`[WABA] Error received (${response.status}${indicatesMeta400 ? "/meta400" : ""}). Retrying without header media...`);

      const retry = await doRequest(retryBody);
      response = retry.response;
      responseText = retry.responseText;
      console.log(`[WABA] Retry status: ${response.status}`);
      console.log(`[WABA] Retry body: ${responseText.substring(0, 500)}`);

      // Re-parse after retry
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      if (!response.ok) {
        return {
          success: false,
          error: responseData?.message || responseData?.error || `HTTP ${response.status}`,
          debug: {
            endpoint,
            status: response.status,
            response: responseText.substring(0, 200),
            payload: retryBody,
          }
        };
      }
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

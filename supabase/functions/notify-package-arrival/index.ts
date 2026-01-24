import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWabaTemplate, buildParamsArray, formatPhoneForWaba, type WabaConfig, type WabaSendResult } from "../_shared/waba-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitize strings for use in messages
const sanitize = (str: string) => str.replace(/[<>"'`]/g, "").trim();

// Multi-provider WhatsApp configuration
type WhatsAppProvider = "zpro" | "zapi" | "evolution" | "wppconnect";

interface ProviderConfig {
  sendMessage: (phone: string, message: string, config: ProviderSettings, imageUrl?: string) => Promise<{ success: boolean; messageId?: string; error?: string }>;
}

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
  app_url?: string;
  use_waba_templates?: boolean;
}

interface WhatsAppTemplateRow {
  id: string;
  slug: string;
  content: string;
  is_active: boolean;
  waba_template_name?: string;
  waba_language?: string;
  params_order?: string[];
}

// Z-PRO Provider - Uses query parameters via GET for text, POST for images
const zproProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings, imageUrl?: string) {
    const baseUrl = config.apiUrl.replace(/\/$/, "");
    const phoneClean = phone.replace(/\D/g, "");
    
    try {
      let response;
      
      if (imageUrl) {
        // Send image with caption via POST /url endpoint
        console.log("Z-PRO sending image to:", phoneClean);
        console.log("Image URL:", imageUrl.substring(0, 100) + "...");
        const targetUrl = `${baseUrl}/url`;
        console.log("Z-PRO image endpoint:", targetUrl);

        // If instance_id is empty or placeholder, fallback to api_key
        let externalKey = config.instanceId || "";
        if (!externalKey || externalKey === "zpro-embedded") {
          externalKey = config.apiKey;
        }

        response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            mediaUrl: imageUrl,
            body: message,
            number: phoneClean,
            externalKey,
            isClosed: false,
          }),
        });
      } else {
        // Send text only via GET (existing behavior)
        const externalKey = config.instanceId || "";
        const params = new URLSearchParams({
          body: message,
          number: phoneClean,
          externalKey,
          bearertoken: config.apiKey,
          isClosed: "false",
        });
        
        const sendUrl = `${baseUrl}/params/?${params.toString()}`;
        console.log("Z-PRO sending text to:", sendUrl.substring(0, 150) + "...");
        
        response = await fetch(sendUrl, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
      }
      
      const responseText = await response.text();
      console.log("Z-PRO response status:", response.status);
      console.log("Z-PRO response:", responseText.substring(0, 200));
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        return { success: false, error: `Resposta inválida: ${responseText.substring(0, 100)}` };
      }
      
      if (response.ok) {
        const extractedMessageId = data.id || data.messageId || data.key?.id || data.msgId || data.message_id;
        
        if (extractedMessageId && extractedMessageId !== "sent") {
          return { success: true, messageId: String(extractedMessageId) };
        }
        
        if (data.status === "success" || data.status === "PENDING" || response.status === 200) {
          const trackingId = `zpro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          return { success: true, messageId: trackingId };
        }
        
        return { success: true, messageId: `zpro_${Date.now()}` };
      }
      
      return { success: false, error: data.message || data.error || `Erro ${response.status}` };
    } catch (error: any) {
      return { success: false, error: `Erro de conexão: ${error.message}` };
    }
  },
};

// Z-API Provider
const zapiProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings, imageUrl?: string) {
    const phoneClean = phone.replace(/\D/g, "");
    
    let response;
    if (imageUrl) {
      response = await fetch(`${config.apiUrl}/instances/${config.instanceId}/token/${config.apiKey}/send-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneClean,
          image: imageUrl,
          caption: message,
        }),
      });
    } else {
      response = await fetch(`${config.apiUrl}/instances/${config.instanceId}/token/${config.apiKey}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneClean,
          message: message,
        }),
      });
    }
    
    const data = await response.json();
    if (response.ok && data.zapiMessageId) {
      return { success: true, messageId: data.zapiMessageId };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  },
};

// Evolution API Provider
const evolutionProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings, imageUrl?: string) {
    const phoneClean = phone.replace(/\D/g, "");
    
    let response;
    if (imageUrl) {
      response = await fetch(`${config.apiUrl}/message/sendMedia/${config.instanceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": config.apiKey,
        },
        body: JSON.stringify({
          number: phoneClean,
          mediatype: "image",
          media: imageUrl,
          caption: message,
        }),
      });
    } else {
      response = await fetch(`${config.apiUrl}/message/sendText/${config.instanceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": config.apiKey,
        },
        body: JSON.stringify({
          number: phoneClean,
          text: message,
        }),
      });
    }
    
    const data = await response.json();
    if (response.ok && data.key?.id) {
      return { success: true, messageId: data.key.id };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  },
};

// WPPConnect Provider
const wppconnectProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings, imageUrl?: string) {
    const phoneClean = phone.replace(/\D/g, "");
    
    let response;
    if (imageUrl) {
      response = await fetch(`${config.apiUrl}/api/${config.instanceId}/send-file-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          phone: phoneClean,
          url: imageUrl,
          caption: message,
          isGroup: false,
        }),
      });
    } else {
      response = await fetch(`${config.apiUrl}/api/${config.instanceId}/send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          phone: phoneClean,
          message: message,
          isGroup: false,
        }),
      });
    }
    
    const data = await response.json();
    if (response.ok && data.status === "success") {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  },
};

const providers: Record<WhatsAppProvider, ProviderConfig> = {
  zpro: zproProvider,
  zapi: zapiProvider,
  evolution: evolutionProvider,
  wppconnect: wppconnectProvider,
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
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    // ========== INPUT VALIDATION ==========
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "JSON inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { package_id, apartment_id, pickup_code, photo_url } = body;

    if (!package_id || !apartment_id || !pickup_code) {
      return new Response(
        JSON.stringify({ error: "Dados incompletos: package_id, apartment_id e pickup_code são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Notifying package arrival: ${package_id} for apartment ${apartment_id}`);

    // ========== AUTHORIZATION ==========
    const { data: apartment, error: aptError } = await supabase
      .from("apartments")
      .select(`
        id,
        number,
        blocks!inner (
          id,
          name,
          condominiums!inner (
            id,
            name,
            owner_id
          )
        )
      `)
      .eq("id", apartment_id)
      .single();

    if (aptError || !apartment) {
      console.error("Apartment not found:", aptError);
      return new Response(
        JSON.stringify({ error: "Apartamento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const blocks = apartment.blocks as any;
    const condoId = blocks.condominiums.id;
    const condoName = blocks.condominiums.name;
    const blockName = blocks.name;
    const aptNumber = apartment.number;

    // Check authorization (porteiro linked to condo, sindico owner, or super_admin)
    const { data: userCondoLink } = await supabase
      .from("user_condominiums")
      .select("id")
      .eq("user_id", user.id)
      .eq("condominium_id", condoId)
      .maybeSingle();

    const isOwner = blocks.condominiums.owner_id === user.id;
    
    const { data: superAdminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!userCondoLink && !isOwner && !superAdminRole) {
      console.error(`User ${user.id} not authorized for condominium ${condoId}`);
      return new Response(
        JSON.stringify({ error: "Sem permissão para notificar neste condomínio" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== FETCH PACKAGE DETAILS ==========
    const { data: packageData, error: pkgError } = await supabase
      .from("packages")
      .select(`
        id,
        tracking_code,
        received_by,
        package_type_id,
        package_types (
          id,
          name
        )
      `)
      .eq("id", package_id)
      .single();

    if (pkgError) {
      console.error("Error fetching package:", pkgError);
    }

    const packageTypeName = (packageData?.package_types as any)?.name || "Não informado";
    const trackingCode = packageData?.tracking_code || "Não informado";

    // Fetch porter name who registered the package
    let porterName = "Portaria";
    if (packageData?.received_by) {
      const { data: porterProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", packageData.received_by)
        .maybeSingle();
      
      if (porterProfile?.full_name) {
        porterName = porterProfile.full_name;
      }
    }

    console.log(`Package type: ${packageTypeName}, Tracking: ${trackingCode}, Porter: ${porterName}`);

    // ========== FETCH RESIDENTS ==========
    const { data: residents, error: resError } = await supabase
      .from("residents")
      .select("id, full_name, phone, email")
      .eq("apartment_id", apartment_id);

    if (resError) {
      console.error("Error fetching residents:", resError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar moradores" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!residents || residents.length === 0) {
      console.log("No residents found for apartment:", apartment_id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhum morador cadastrado para este apartamento",
          notifications_sent: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter residents with phone numbers
    const residentsWithPhone = residents.filter(r => r.phone);
    
    if (residentsWithPhone.length === 0) {
      console.log("No residents with phone numbers found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhum morador com telefone cadastrado",
          notifications_sent: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== FETCH WHATSAPP CONFIG ==========
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
        JSON.stringify({ error: "Erro ao buscar configuração do WhatsApp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!whatsappConfig) {
      console.log("WhatsApp not configured");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "WhatsApp não configurado. Encomenda registrada sem notificação.",
          notifications_sent: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedConfig = whatsappConfig as WhatsAppConfigRow;
    const whatsappProvider = (typedConfig.provider || "zpro") as WhatsAppProvider;
    const provider = providers[whatsappProvider];
    const useWabaTemplates = typedConfig.use_waba_templates === true;

    console.log(`Using WhatsApp provider: ${whatsappProvider}, WABA mode: ${useWabaTemplates}`);

    // ========== FETCH TEMPLATE ==========
    let templateContent: string | null = null;
    let wabaTemplateName: string | null = null;
    let wabaLanguage: string = "pt_BR";
    let paramsOrder: string[] = [];
    
    // Check for custom condominium template first
    const { data: customTemplate } = await supabase
      .from("condominium_whatsapp_templates")
      .select("content")
      .eq("condominium_id", condoId)
      .eq("template_slug", "package_arrival")
      .eq("is_active", true)
      .maybeSingle();

    if (customTemplate?.content && !useWabaTemplates) {
      // Custom templates only work in non-WABA mode (free text)
      templateContent = customTemplate.content;
      console.log("Using custom condominium template (free text mode)");
    } else {
      // Get default template with WABA fields
      const { data: defaultTemplate } = await supabase
        .from("whatsapp_templates")
        .select("content, waba_template_name, waba_language, params_order")
        .eq("slug", "package_arrival")
        .eq("is_active", true)
        .maybeSingle();
      
      if (defaultTemplate) {
        templateContent = defaultTemplate.content;
        wabaTemplateName = (defaultTemplate as WhatsAppTemplateRow).waba_template_name || null;
        wabaLanguage = (defaultTemplate as WhatsAppTemplateRow).waba_language || "pt_BR";
        paramsOrder = (defaultTemplate as WhatsAppTemplateRow).params_order || [];
        console.log(`Template loaded: WABA name=${wabaTemplateName}, params_order=${paramsOrder.length} items`);
      }
    }

    // Default message template (fallback for free text mode)
    const defaultMessage = `📦 *Nova Encomenda!*

🏢 *{condominio}*

Olá, *{nome}*!

Você tem uma encomenda aguardando na portaria.

🏠 *Destino:* BLOCO {bloco}, APTO {apartamento}
📋 *Tipo:* {tipo_encomenda}
📍 *Rastreio:* {codigo_rastreio}
🧑‍💼 *Recebido por:* {porteiro}
🔑 *Código de retirada:* {numeropedido}

Apresente este código na portaria para retirar sua encomenda.

_Mensagem automática - NotificaCondo_`;

    // ========== SEND NOTIFICATIONS ==========
    const results: Array<{ resident_id: string; success: boolean; error?: string; messageId?: string }> = [];

    for (const resident of residentsWithPhone) {
      console.log(`Processing notification for ${resident.full_name} (${resident.phone})`);

      try {
        let result: { success: boolean; messageId?: string; error?: string };

        // Validate WABA template - skip WABA mode if template is a test template or not properly configured
        const isValidWabaTemplate = wabaTemplateName && 
          wabaTemplateName !== "hello_world" && 
          wabaTemplateName !== "sample_template" &&
          !wabaTemplateName.startsWith("test_") &&
          paramsOrder.length > 0;

        // Check if WABA mode is enabled and template is properly configured
        if (useWabaTemplates && isValidWabaTemplate && whatsappProvider === "zpro") {
          // ========== WABA TEMPLATE MODE ==========
          console.log(`Sending WABA template "${wabaTemplateName}" to ${resident.phone}`);
          
          // Build variables object for this resident
          const variables: Record<string, string> = {
            nome: sanitize(resident.full_name),
            condominio: sanitize(condoName),
            bloco: sanitize(blockName),
            apartamento: sanitize(aptNumber),
            numeropedido: pickup_code,
            tipo_encomenda: sanitize(packageTypeName),
            codigo_rastreio: sanitize(trackingCode),
            porteiro: sanitize(porterName),
          };

          // Build params array in the correct order
          const params = buildParamsArray(variables, paramsOrder);
          console.log(`WABA params: [${params.join(", ")}]`);

          // Note: The Meta template "encomenda_management_5" does NOT have a header image.
          // Do NOT send mediaUrl here - it will cause a 400 error from Meta.
          const wabaResult = await sendWabaTemplate(
            {
              phone: resident.phone!,
              templateName: wabaTemplateName!,
              language: wabaLanguage,
              params,
              // mediaUrl omitted - template has no image header configured in Meta
            },
            {
              apiUrl: typedConfig.api_url,
              apiKey: typedConfig.api_key,
              instanceId: typedConfig.instance_id,
            }
          );

          if (wabaResult.success) {
            result = {
              success: true,
              messageId: wabaResult.messageId,
            };
          } else {
            console.log(`[WABA] Failed (${wabaResult.error}). Falling back to free text mode for delivery.`);

            // ========== FALLBACK TO FREE TEXT ==========
            let message = templateContent || defaultMessage;
            message = message
              .replace(/{nome}/g, sanitize(resident.full_name))
              .replace(/{condominio}/g, sanitize(condoName))
              .replace(/{bloco}/g, sanitize(blockName))
              .replace(/{apartamento}/g, sanitize(aptNumber))
              .replace(/{numeropedido}/g, pickup_code)
              .replace(/{tipo_encomenda}/g, sanitize(packageTypeName))
              .replace(/{codigo_rastreio}/g, sanitize(trackingCode))
              .replace(/{porteiro}/g, sanitize(porterName));

            // Keep photo in legacy mode (captioned image) when available
            const legacy = await provider.sendMessage(
              resident.phone!,
              message,
              {
                apiUrl: typedConfig.api_url,
                apiKey: typedConfig.api_key,
                instanceId: typedConfig.instance_id,
              },
              photo_url || undefined
            );

            result = {
              success: legacy.success,
              messageId: legacy.messageId,
              error: legacy.success ? undefined : (legacy.error || wabaResult.error),
            };
          }
        } else {
          // Log reason for falling back to legacy mode
          if (useWabaTemplates && !isValidWabaTemplate) {
            console.log(`WABA mode enabled but template not properly configured (template: ${wabaTemplateName}, params: ${paramsOrder.length}). Falling back to free text mode.`);
          }
          // ========== FREE TEXT MODE (legacy) ==========
          let message = templateContent || defaultMessage;
          message = message
            .replace(/{nome}/g, sanitize(resident.full_name))
            .replace(/{condominio}/g, sanitize(condoName))
            .replace(/{bloco}/g, sanitize(blockName))
            .replace(/{apartamento}/g, sanitize(aptNumber))
            .replace(/{numeropedido}/g, pickup_code)
            .replace(/{tipo_encomenda}/g, sanitize(packageTypeName))
            .replace(/{codigo_rastreio}/g, sanitize(trackingCode))
            .replace(/{porteiro}/g, sanitize(porterName));

          console.log(`Sending free text message to ${resident.full_name}`);
          if (photo_url) {
            console.log(`Including package photo: ${photo_url.substring(0, 80)}...`);
          }

          result = await provider.sendMessage(
            resident.phone!, 
            message, 
            {
              apiUrl: typedConfig.api_url,
              apiKey: typedConfig.api_key,
              instanceId: typedConfig.instance_id,
            },
            photo_url || undefined
          );
        }

        results.push({
          resident_id: resident.id,
          success: result.success,
          messageId: result.messageId,
          error: result.error,
        });

        if (result.success) {
          console.log(`Notification sent successfully to ${resident.full_name} (ID: ${result.messageId})`);
        } else {
          console.error(`Failed to notify ${resident.full_name}:`, result.error);
        }
      } catch (error: any) {
        console.error(`Error sending to ${resident.full_name}:`, error);
        results.push({
          resident_id: resident.id,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Notifications complete: ${successCount} sent, ${failCount} failed`);

    // Update package notification status in database
    if (successCount > 0) {
      const { error: updateError } = await supabase
        .from("packages")
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
          notification_count: successCount,
        })
        .eq("id", package_id);

      if (updateError) {
        console.error("Error updating package notification status:", updateError);
      } else {
        console.log(`Package ${package_id} notification status updated`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notificações enviadas: ${successCount} de ${results.length}`,
        notifications_sent: successCount,
        notifications_failed: failCount,
        waba_mode: useWabaTemplates,
        details: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

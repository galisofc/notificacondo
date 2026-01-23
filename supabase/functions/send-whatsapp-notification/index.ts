import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const SendNotificationSchema = z.object({
  occurrence_id: z.string().uuid("occurrence_id deve ser um UUID válido"),
  resident_id: z.string().uuid("resident_id deve ser um UUID válido"),
  message_template: z.string().max(2000, "Mensagem não pode exceder 2000 caracteres").optional(),
});

// Sanitize strings for use in messages
const sanitize = (str: string) => str.replace(/[<>"'`]/g, "").trim();

// Multi-provider WhatsApp configuration
type WhatsAppProvider = "zpro" | "zapi" | "evolution" | "wppconnect";

interface ProviderConfig {
  sendMessage: (phone: string, message: string, config: ProviderSettings) => Promise<{ success: boolean; messageId?: string; error?: string }>;
}

interface ProviderSettings {
  apiUrl: string;
  apiKey: string;
  instanceId: string;
  useOfficialApi?: boolean;
}

interface WhatsAppConfigRow {
  id: string;
  provider: string;
  api_url: string;
  api_key: string;
  instance_id: string;
  is_active: boolean;
  app_url?: string;
  use_official_api?: boolean;
}

// Z-PRO Provider - Supports both unofficial (/params) and official WABA (SendMessageAPIText) endpoints
const zproProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
    const baseUrl = config.apiUrl.replace(/\/$/, "");
    const phoneClean = phone.replace(/\D/g, "");
    
    // If instanceId is empty or placeholder, fallback to apiKey
    let externalKey = config.instanceId || "";
    if (!externalKey || externalKey === "zpro-embedded") {
      externalKey = config.apiKey;
    }
    
    try {
      let response;
      
      // Check if using official WABA API endpoints
      if (config.useOfficialApi) {
        console.log("Z-PRO using OFFICIAL WABA API");
        
        // For WABA, we use instanceId as the channel identifier in the URL
        // and apiKey as the externalkey header for authentication
        const urlParts = baseUrl.match(/^(https?:\/\/[^\/]+)/);
        const baseDomain = urlParts ? urlParts[1] : baseUrl;
        const channelId = config.instanceId || "";
        const targetUrl = `${baseDomain}/v2/api/${channelId}/SendMessageAPIText`;
        console.log("Z-PRO WABA sending text to:", phoneClean);
        console.log("Z-PRO WABA endpoint:", targetUrl);
        console.log("Z-PRO WABA channelId:", channelId);
        
        response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "externalkey": config.apiKey,
          },
          body: JSON.stringify({
            number: phoneClean,
            text: message,
          }),
        });
      } else {
        // Unofficial API (legacy behavior)
        const params = new URLSearchParams({
          body: message,
          number: phoneClean,
          externalKey,
          bearertoken: config.apiKey,
          isClosed: "false"
        });
        
        const sendUrl = `${baseUrl}/params/?${params.toString()}`;
        console.log("Z-PRO sending to:", sendUrl.substring(0, 150) + "...");
        
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
          console.log(`Z-PRO: No message ID in response, using tracking ID: ${trackingId}`);
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
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
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
  },
};

// Evolution API Provider
const evolutionProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
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
  },
};

// WPPConnect Provider
const wppconnectProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
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

    const parsed = SendNotificationSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Validation error:", parsed.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Dados inválidos", 
          details: parsed.error.errors.map(e => e.message) 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { occurrence_id, resident_id, message_template } = parsed.data;

    // ========== AUTHORIZATION ==========
    // Verify user has permission (owns the condominium or is super_admin)
    const { data: occurrence, error: occCheckError } = await supabase
      .from("occurrences")
      .select("condominium_id")
      .eq("id", occurrence_id)
      .single();

    if (occCheckError || !occurrence) {
      console.error("Occurrence not found for auth check:", occCheckError);
      return new Response(
        JSON.stringify({ error: "Ocorrência não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: condo } = await supabase
      .from("condominiums")
      .select("owner_id")
      .eq("id", occurrence.condominium_id)
      .single();

    if (!condo || condo.owner_id !== user.id) {
      // Check if super_admin
      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!superAdminRole) {
        console.error(`User ${user.id} is not owner of condominium and not super_admin`);
        return new Response(
          JSON.stringify({ error: "Sem permissão para enviar notificações neste condomínio" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Authorization passed for user ${user.id}`);

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
        JSON.stringify({ error: "Erro ao buscar configuração do WhatsApp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!whatsappConfig) {
      console.error("WhatsApp not configured in database");
      return new Response(
        JSON.stringify({ error: "WhatsApp não configurado. Configure no painel do Super Admin em Configurações > WhatsApp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedConfig = whatsappConfig as WhatsAppConfigRow;
    const whatsappApiUrl = typedConfig.api_url;
    const whatsappApiKey = typedConfig.api_key;
    const whatsappInstanceId = typedConfig.instance_id;
    const whatsappProvider = (typedConfig.provider || "zpro") as WhatsAppProvider;
    const appBaseUrl = typedConfig.app_url || "https://notificacondo.com.br";

    console.log(`Using WhatsApp provider: ${whatsappProvider}`);
    console.log(`API URL: ${whatsappApiUrl.substring(0, 50)}...`);
    console.log(`App URL: ${appBaseUrl}`);

    // Fetch resident and occurrence details
    const { data: resident, error: residentError } = await supabase
      .from("residents")
      .select(`
        id,
        full_name,
        phone,
        email,
        apartments!inner (
          number,
          blocks!inner (
            name,
            condominiums!inner (
              id,
              name
            )
          )
        )
      `)
      .eq("id", resident_id)
      .single();

    if (residentError || !resident) {
      console.error("Resident not found:", residentError);
      return new Response(
        JSON.stringify({ error: "Morador não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!resident.phone) {
      return new Response(
        JSON.stringify({ error: "Morador não possui telefone cadastrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: occurrenceData, error: occError } = await supabase
      .from("occurrences")
      .select("id, title, type, status")
      .eq("id", occurrence_id)
      .single();

    if (occError || !occurrenceData) {
      console.error("Occurrence not found:", occError);
      return new Response(
        JSON.stringify({ error: "Ocorrência não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate secure token for the link
    const secureToken = crypto.randomUUID();
    const secureLink = `${appBaseUrl}/acesso/${secureToken}`;

    const apt = resident.apartments as any;
    const condoName = apt.blocks.condominiums.name;
    const condoId = apt.blocks.condominiums.id;

    // Type label mapping
    const typeLabels: Record<string, string> = {
      advertencia: "Advertência",
      notificacao: "Notificação",
      multa: "Multa",
    };

    // Fetch template - first check for custom condominium template
    let templateContent: string | null = null;
    
    const { data: customTemplate } = await supabase
      .from("condominium_whatsapp_templates")
      .select("content")
      .eq("condominium_id", condoId)
      .eq("template_slug", "notification_occurrence")
      .eq("is_active", true)
      .maybeSingle();

    if (customTemplate?.content) {
      templateContent = customTemplate.content;
      console.log("Using custom condominium template");
    } else {
      // Fall back to default template
      const { data: defaultTemplate } = await supabase
        .from("whatsapp_templates")
        .select("content")
        .eq("slug", "notification_occurrence")
        .eq("is_active", true)
        .maybeSingle();
      
      if (defaultTemplate?.content) {
        templateContent = defaultTemplate.content;
        console.log("Using default system template");
      }
    }

    // Build message with sanitization
    const defaultMessage = `🏢 *${sanitize(condoName)}*

Olá, *${sanitize(resident.full_name)}*!

Você recebeu uma *${typeLabels[occurrenceData.type] || occurrenceData.type}*:
📋 *${sanitize(occurrenceData.title)}*

Acesse o link abaixo para ver os detalhes e apresentar sua defesa:
👉 ${secureLink}

Este link é pessoal e intransferível.`;

    let message: string;
    if (message_template) {
      message = sanitize(message_template)
        .replace("{nome}", sanitize(resident.full_name))
        .replace("{tipo}", typeLabels[occurrenceData.type] || occurrenceData.type)
        .replace("{titulo}", sanitize(occurrenceData.title))
        .replace("{condominio}", sanitize(condoName))
        .replace("{link}", secureLink);
    } else if (templateContent) {
      message = templateContent
        .replace("{nome}", sanitize(resident.full_name))
        .replace("{tipo}", typeLabels[occurrenceData.type] || occurrenceData.type)
        .replace("{titulo}", sanitize(occurrenceData.title))
        .replace("{condominio}", sanitize(condoName))
        .replace("{link}", secureLink);
    } else {
      message = defaultMessage;
    }

    // Save notification record
    const { data: notification, error: notifError } = await supabase
      .from("notifications_sent")
      .insert({
        occurrence_id,
        resident_id,
        message_content: message,
        sent_via: `whatsapp_${whatsappProvider}`,
        secure_link: secureLink,
        secure_link_token: secureToken,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (notifError) {
      console.error("Failed to save notification:", notifError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar notificação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send WhatsApp message
    console.log(`Sending WhatsApp message to: ${resident.phone}`);
    const provider = providers[whatsappProvider];
    const result = await provider.sendMessage(resident.phone, message, {
      apiUrl: whatsappApiUrl,
      apiKey: whatsappApiKey,
      instanceId: whatsappInstanceId,
      useOfficialApi: (typedConfig as any).use_official_api || false,
    });

    // Update notification with result
    await supabase
      .from("notifications_sent")
      .update({
        zpro_message_id: result.messageId,
        zpro_status: result.success ? "sent" : "failed",
      })
      .eq("id", notification.id);

    if (!result.success) {
      console.error("WhatsApp send failed:", result.error);
      return new Response(
        JSON.stringify({ 
          error: "Falha ao enviar WhatsApp", 
          details: result.error,
          notification_id: notification.id 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp sent successfully:", result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message_id: result.messageId,
        notification_id: notification.id,
        secure_link: secureLink,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

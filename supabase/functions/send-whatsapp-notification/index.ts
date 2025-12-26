import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Multi-provider WhatsApp configuration
type WhatsAppProvider = "zpro" | "zapi" | "evolution" | "wppconnect";

interface ProviderConfig {
  sendMessage: (phone: string, message: string, config: ProviderSettings) => Promise<{ success: boolean; messageId?: string; error?: string }>;
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
}

// Z-PRO Provider - Uses full URL and Bearer Token
const zproProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
    // Z-PRO uses the full URL directly, with Bearer token authentication
    // The URL already contains the session ID
    const sendUrl = config.apiUrl.endsWith("/send-text") 
      ? config.apiUrl 
      : `${config.apiUrl}/send-text`;
    
    console.log("Z-PRO sending to:", sendUrl);
    
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
    
    const data = await response.json();
    console.log("Z-PRO response:", data);
    
    if (response.ok && (data.id || data.messageId || data.zapiMessageId)) {
      return { success: true, messageId: data.id || data.messageId || data.zapiMessageId };
    }
    
    if (response.ok && data.status === "success") {
      return { success: true, messageId: data.id || "sent" };
    }
    
    return { success: false, error: data.message || data.error || "Erro ao enviar mensagem" };
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

interface SendNotificationRequest {
  occurrence_id: string;
  resident_id: string;
  message_template?: string;
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

    console.log(`Using WhatsApp provider: ${whatsappProvider}`);
    console.log(`API URL: ${whatsappApiUrl.substring(0, 50)}...`);

    const { occurrence_id, resident_id, message_template }: SendNotificationRequest = await req.json();

    if (!occurrence_id || !resident_id) {
      return new Response(
        JSON.stringify({ error: "occurrence_id e resident_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const { data: occurrence, error: occError } = await supabase
      .from("occurrences")
      .select("id, title, type, status")
      .eq("id", occurrence_id)
      .single();

    if (occError || !occurrence) {
      console.error("Occurrence not found:", occError);
      return new Response(
        JSON.stringify({ error: "Ocorrência não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate secure token for the link
    const secureToken = crypto.randomUUID();
    const baseUrl = Deno.env.get("APP_URL") || "https://iyeljkdrypcxvljebqtn.lovableproject.com";
    const secureLink = `${baseUrl}/resident/access?token=${secureToken}`;

    const apt = resident.apartments as any;
    const condoName = apt.blocks.condominiums.name;

    // Type label mapping
    const typeLabels: Record<string, string> = {
      advertencia: "Advertência",
      notificacao: "Notificação",
      multa: "Multa",
    };

    // Build message
    const defaultMessage = `🏢 *${condoName}*

Olá, *${resident.full_name}*!

Você recebeu uma *${typeLabels[occurrence.type] || occurrence.type}*:
📋 *${occurrence.title}*

Acesse o link abaixo para ver os detalhes e apresentar sua defesa:
👉 ${secureLink}

Este link é pessoal e intransferível.`;

    const message = message_template 
      ? message_template
          .replace("{nome}", resident.full_name)
          .replace("{tipo}", typeLabels[occurrence.type] || occurrence.type)
          .replace("{titulo}", occurrence.title)
          .replace("{condominio}", condoName)
          .replace("{link}", secureLink)
      : defaultMessage;

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
    });

    // Update notification with result
    await supabase
      .from("notifications_sent")
      .update({
        zpro_message_id: result.messageId,
        zpro_status: result.success ? "sent" : "failed",
        delivered_at: result.success ? new Date().toISOString() : null,
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

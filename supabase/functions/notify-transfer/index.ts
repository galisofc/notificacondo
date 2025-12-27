import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  app_url?: string;
}

// Z-PRO Provider
const zproProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
    const baseUrl = config.apiUrl.replace(/\/$/, "");
    const phoneClean = phone.replace(/\D/g, "");
    
    const params = new URLSearchParams({
      body: message,
      number: phoneClean,
      externalKey: config.apiKey,
      bearertoken: config.apiKey,
      isClosed: "false"
    });
    
    const sendUrl = `${baseUrl}/params/?${params.toString()}`;
    console.log("Z-PRO sending to:", sendUrl.substring(0, 150) + "...");
    
    try {
      const response = await fetch(sendUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      const responseText = await response.text();
      console.log("Z-PRO response status:", response.status);
      
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

interface NotifyTransferRequest {
  condominium_id: string;
  condominium_name: string;
  new_owner_id: string;
  old_owner_id: string;
  old_owner_name: string;
  new_owner_name?: string;
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      condominium_id, 
      condominium_name, 
      new_owner_id,
      old_owner_id,
      old_owner_name,
      new_owner_name,
      notes 
    }: NotifyTransferRequest = await req.json();

    console.log("Notify transfer request:", { condominium_id, new_owner_id, old_owner_id });

    if (!condominium_id || !new_owner_id) {
      return new Response(
        JSON.stringify({ error: "condominium_id e new_owner_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch WhatsApp config
    const { data: whatsappConfig, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !whatsappConfig) {
      console.error("WhatsApp not configured:", configError);
      return new Response(
        JSON.stringify({ error: "WhatsApp não configurado", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedConfig = whatsappConfig as WhatsAppConfigRow;
    const whatsappProvider = (typedConfig.provider || "zpro") as WhatsAppProvider;
    const appBaseUrl = typedConfig.app_url || "https://notificacondo.com.br";

    // Get new owner profile
    const { data: newOwner, error: newOwnerError } = await supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("user_id", new_owner_id)
      .single();

    // Get old owner profile
    const { data: oldOwner, error: oldOwnerError } = await supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("user_id", old_owner_id)
      .single();

    const now = new Date();
    const dataTransferencia = now.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const observacoesText = notes ? `\n• Observações: ${notes}` : "";
    const loginLink = `${appBaseUrl}/auth`;

    const results: { newOwner?: { success: boolean; messageId?: string }; oldOwner?: { success: boolean; messageId?: string } } = {};

    // Fetch templates
    const { data: newOwnerTemplate } = await supabase
      .from("whatsapp_templates")
      .select("content")
      .eq("slug", "condominium_transfer")
      .eq("is_active", true)
      .single();

    const { data: oldOwnerTemplate } = await supabase
      .from("whatsapp_templates")
      .select("content")
      .eq("slug", "condominium_transfer_old_owner")
      .eq("is_active", true)
      .single();

    const provider = providers[whatsappProvider];

    // Send notification to NEW owner
    if (newOwner && newOwner.phone) {
      const newOwnerMessage = newOwnerTemplate?.content
        ? newOwnerTemplate.content
            .replace("{nome_novo_sindico}", newOwner.full_name)
            .replace("{condominio}", condominium_name)
            .replace("{nome_antigo_sindico}", old_owner_name || oldOwner?.full_name || "Síndico anterior")
            .replace("{data_transferencia}", dataTransferencia)
            .replace("{observacoes}", observacoesText)
            .replace("{link}", loginLink)
        : `🔄 *TRANSFERÊNCIA DE CONDOMÍNIO*

Olá, *${newOwner.full_name}*!

O condomínio *${condominium_name}* foi transferido para sua gestão.

📋 *Detalhes da transferência:*
• Síndico anterior: ${old_owner_name || oldOwner?.full_name || "Síndico anterior"}
• Data: ${dataTransferencia}${observacoesText}

Acesse o sistema para gerenciar seu novo condomínio:
👉 ${loginLink}

Bem-vindo(a) à gestão do condomínio!`;

      console.log(`Sending transfer notification to new owner: ${newOwner.phone}`);
      const newOwnerResult = await provider.sendMessage(newOwner.phone, newOwnerMessage, {
        apiUrl: typedConfig.api_url,
        apiKey: typedConfig.api_key,
        instanceId: typedConfig.instance_id,
      });
      results.newOwner = newOwnerResult;
      console.log("New owner notification result:", newOwnerResult);
    } else {
      console.log("New owner has no phone, skipping notification");
    }

    // Send notification to OLD owner
    if (oldOwner && oldOwner.phone) {
      const finalNewOwnerName = new_owner_name || newOwner?.full_name || "Novo síndico";
      
      const oldOwnerMessage = oldOwnerTemplate?.content
        ? oldOwnerTemplate.content
            .replace("{nome_antigo_sindico}", oldOwner.full_name)
            .replace("{condominio}", condominium_name)
            .replace("{nome_novo_sindico}", finalNewOwnerName)
            .replace("{data_transferencia}", dataTransferencia)
            .replace("{observacoes}", observacoesText)
        : `🔄 *TRANSFERÊNCIA DE CONDOMÍNIO*

Olá, *${oldOwner.full_name}*!

O condomínio *${condominium_name}* foi transferido da sua gestão.

📋 *Detalhes da transferência:*
• Novo síndico: ${finalNewOwnerName}
• Data: ${dataTransferencia}${observacoesText}

Agradecemos pelo seu trabalho na gestão do condomínio!

Em caso de dúvidas, entre em contato com o suporte.`;

      console.log(`Sending transfer notification to old owner: ${oldOwner.phone}`);
      const oldOwnerResult = await provider.sendMessage(oldOwner.phone, oldOwnerMessage, {
        apiUrl: typedConfig.api_url,
        apiKey: typedConfig.api_key,
        instanceId: typedConfig.instance_id,
      });
      results.oldOwner = oldOwnerResult;
      console.log("Old owner notification result:", oldOwnerResult);
    } else {
      console.log("Old owner has no phone, skipping notification");
    }

    console.log("Transfer notifications completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

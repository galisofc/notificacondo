import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  app_url?: string;
}

// Z-PRO Provider
async function sendZproMessage(phone: string, message: string, config: ProviderSettings) {
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
    
    if (response.ok) {
      return { success: true };
    }
    
    return { success: false, error: `Erro ${response.status}` };
  } catch (error: any) {
    return { success: false, error: `Erro de conexão: ${error.message}` };
  }
}

// Z-API Provider
async function sendZapiMessage(phone: string, message: string, config: ProviderSettings) {
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
    return { success: true };
  }
  return { success: false, error: data.message || "Erro ao enviar mensagem" };
}

// Evolution API Provider
async function sendEvolutionMessage(phone: string, message: string, config: ProviderSettings) {
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
    return { success: true };
  }
  return { success: false, error: data.message || "Erro ao enviar mensagem" };
}

// WPPConnect Provider
async function sendWppconnectMessage(phone: string, message: string, config: ProviderSettings) {
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
    return { success: true };
  }
  return { success: false, error: data.message || "Erro ao enviar mensagem" };
}

async function sendWhatsAppMessage(phone: string, message: string, provider: WhatsAppProvider, config: ProviderSettings) {
  switch (provider) {
    case "zpro":
      return sendZproMessage(phone, message, config);
    case "zapi":
      return sendZapiMessage(phone, message, config);
    case "evolution":
      return sendEvolutionMessage(phone, message, config);
    case "wppconnect":
      return sendWppconnectMessage(phone, message, config);
    default:
      return { success: false, error: "Provider não suportado" };
  }
}

interface NotifyResidentRequest {
  occurrence_id: string;
  decision: "arquivada" | "advertido" | "multado";
  justification: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { occurrence_id, decision, justification }: NotifyResidentRequest = await req.json();
    console.log("Notify resident decision:", { occurrence_id, decision });

    if (!occurrence_id || !decision) {
      return new Response(
        JSON.stringify({ error: "occurrence_id e decision são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch occurrence with resident info
    const { data: occurrence, error: occError } = await supabase
      .from("occurrences")
      .select(`
        id,
        title,
        type,
        residents!inner (
          id,
          full_name,
          phone,
          email,
          apartments!inner (
            number,
            blocks!inner (
              name,
              condominiums!inner (
                name
              )
            )
          )
        )
      `)
      .eq("id", occurrence_id)
      .single();

    if (occError || !occurrence) {
      console.error("Occurrence not found:", occError);
      return new Response(
        JSON.stringify({ error: "Ocorrência não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resident = occurrence.residents as any;
    
    if (!resident?.phone) {
      console.log("Resident has no phone registered, skipping WhatsApp notification");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Morador sem telefone cadastrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      console.log("WhatsApp not configured, skipping notification");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "WhatsApp não configurado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedConfig = whatsappConfig as WhatsAppConfigRow;
    const whatsappProvider = (typedConfig.provider || "zpro") as WhatsAppProvider;
    const appBaseUrl = typedConfig.app_url || "https://notificacondo.com.br";

    console.log(`Using WhatsApp provider: ${whatsappProvider}`);

    const condoName = resident.apartments.blocks.condominiums.name;

    // Decision labels and emojis
    const decisionInfo: Record<string, { label: string; emoji: string; description: string }> = {
      arquivada: {
        label: "ARQUIVADA",
        emoji: "✅",
        description: "Sua defesa foi aceita e a ocorrência foi arquivada. Nenhuma penalidade será aplicada.",
      },
      advertido: {
        label: "ADVERTÊNCIA APLICADA",
        emoji: "⚠️",
        description: "Após análise da sua defesa, foi decidido aplicar uma advertência formal.",
      },
      multado: {
        label: "MULTA APLICADA",
        emoji: "🚨",
        description: "Após análise da sua defesa, foi decidido aplicar uma multa. Verifique os detalhes no sistema.",
      },
    };

    const info = decisionInfo[decision];

    // Build message
    const message = `${info.emoji} *DECISÃO: ${info.label}*

🏢 *${condoName}*

Olá, *${resident.full_name}*!

Sua defesa referente à ocorrência "${occurrence.title}" foi analisada.

📋 *Decisão:* ${info.label}

${info.description}

${justification ? `💬 *Justificativa:*\n${justification}` : ""}

Acesse o sistema para mais detalhes:
👉 ${appBaseUrl}/resident/occurrences/${occurrence_id}`;

    console.log(`Sending WhatsApp to resident: ${resident.phone}`);

    // Send WhatsApp message
    const result = await sendWhatsAppMessage(resident.phone, message, whatsappProvider, {
      apiUrl: typedConfig.api_url,
      apiKey: typedConfig.api_key,
      instanceId: typedConfig.instance_id,
    });

    if (!result.success) {
      console.error("WhatsApp send failed:", result.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Falha ao enviar WhatsApp para morador", 
          details: result.error 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("WhatsApp sent to resident successfully");

    return new Response(
      JSON.stringify({ success: true }),
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

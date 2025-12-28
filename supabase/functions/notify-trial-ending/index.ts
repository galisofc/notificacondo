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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting trial ending notification check...");

    // Calculate the date 2 days from now
    const now = new Date();
    const twoDaysFromNow = new Date(now);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    
    // Get the start and end of that day
    const targetDateStart = new Date(twoDaysFromNow);
    targetDateStart.setHours(0, 0, 0, 0);
    
    const targetDateEnd = new Date(twoDaysFromNow);
    targetDateEnd.setHours(23, 59, 59, 999);

    console.log(`Looking for trials ending between ${targetDateStart.toISOString()} and ${targetDateEnd.toISOString()}`);

    // Fetch subscriptions with trials ending in 2 days
    const { data: subscriptions, error: subError } = await supabase
      .from("subscriptions")
      .select(`
        id,
        plan,
        trial_ends_at,
        condominium:condominiums!inner(
          id,
          name,
          owner_id
        )
      `)
      .eq("is_trial", true)
      .gte("trial_ends_at", targetDateStart.toISOString())
      .lte("trial_ends_at", targetDateEnd.toISOString());

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions with trials ending in 2 days`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No trials ending in 2 days", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        JSON.stringify({ success: false, error: "WhatsApp não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const whatsappProvider = (whatsappConfig.provider || "zpro") as WhatsAppProvider;
    const provider = providers[whatsappProvider];
    const appBaseUrl = whatsappConfig.app_url || "https://notificacondo.com.br";

    const results = {
      notified: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const sub of subscriptions) {
      try {
        const condo = sub.condominium as any;
        
        // Fetch the sindico's profile to get phone
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, phone, email")
          .eq("user_id", condo.owner_id)
          .single();

        if (profileError || !profile) {
          console.error(`Profile not found for owner ${condo.owner_id}`);
          results.errors.push(`Profile not found for ${condo.name}`);
          results.failed++;
          continue;
        }

        if (!profile.phone) {
          console.log(`Sindico of ${condo.name} has no phone, skipping WhatsApp notification`);
          results.errors.push(`No phone for ${condo.name}`);
          results.failed++;
          continue;
        }

        // Format trial end date
        const trialEndDate = new Date(sub.trial_ends_at!);
        const formattedDate = trialEndDate.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

        // Build the notification message
        const message = `🏢 *NotificaCondo*

Olá, *${profile.full_name}*!

⏰ Seu período de teste gratuito para o condomínio *${condo.name}* termina em *2 dias* (${formattedDate}).

Para continuar usando todos os recursos da plataforma sem interrupção, acesse seu painel e escolha o plano ideal:

👉 ${appBaseUrl}/sindico/subscriptions

📋 *Recursos disponíveis:*
✅ Notificações via WhatsApp
✅ Registro de ciência com data/hora
✅ Gestão de ocorrências e defesas
✅ Conformidade LGPD

Não perca o acesso! Garanta seu plano agora.

Atenciosamente,
Equipe NotificaCondo`;

        console.log(`Sending trial ending notification to ${profile.phone} for ${condo.name}`);

        const result = await provider.sendMessage(profile.phone, message, {
          apiUrl: whatsappConfig.api_url,
          apiKey: whatsappConfig.api_key,
          instanceId: whatsappConfig.instance_id,
        });

        if (result.success) {
          console.log(`Successfully notified ${profile.full_name} about trial ending`);
          results.notified++;
        } else {
          console.error(`Failed to notify ${profile.full_name}:`, result.error);
          results.errors.push(`${condo.name}: ${result.error}`);
          results.failed++;
        }
      } catch (error: any) {
        console.error(`Error processing subscription ${sub.id}:`, error);
        results.errors.push(`Subscription ${sub.id}: ${error.message}`);
        results.failed++;
      }
    }

    console.log("Trial notification results:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Trial ending notifications processed",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
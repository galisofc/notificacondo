import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendWhatsAppMessage,
  type ProviderSettings,
  type WhatsAppProvider,
  type WhatsAppConfigRow,
} from "../_shared/whatsapp-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch WhatsApp config
    const { data: whatsappConfig, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error("Config error:", configError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar configuração" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!whatsappConfig) {
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, message } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Telefone obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedConfig = whatsappConfig as WhatsAppConfigRow;
    const provider = (typedConfig.provider || "zpro") as WhatsAppProvider;

    console.log(`[Main] Provider: ${provider}`);
    console.log(`[Main] API URL: ${typedConfig.api_url}`);

    const testMessage = message || `🔔 *Teste de Notificação*

Esta é uma mensagem de teste do sistema NotificaCondo.

Se você recebeu esta mensagem, a integração com WhatsApp está funcionando corretamente! ✅

_Enviado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}_`;

    const providerSettings: ProviderSettings = {
      apiUrl: typedConfig.api_url,
      apiKey: typedConfig.api_key,
      instanceId: typedConfig.instance_id,
    };

    const result = await sendWhatsAppMessage(phone, testMessage, provider, providerSettings);

    if (result.success) {
      console.log(`[Main] Success! Message ID: ${result.messageId}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Mensagem enviada com sucesso!",
          message_id: result.messageId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error(`[Main] Failed: ${result.error}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          errorCode: result.errorCode,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: `Erro interno: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

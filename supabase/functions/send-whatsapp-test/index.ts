import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { 
  sendMetaText, 
  isMetaConfigured,
} from "../_shared/meta-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========== CHECK META CONFIG ==========
    if (!isMetaConfigured()) {
      console.error("Meta WhatsApp not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Meta WhatsApp não configurado. Configure META_WHATSAPP_PHONE_ID e META_WHATSAPP_ACCESS_TOKEN nos Secrets." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== INPUT VALIDATION ==========
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "JSON inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, message } = body;

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const testMessage = message || `✅ *Teste NotificaCondo*

Esta é uma mensagem de teste enviada via Meta WhatsApp Cloud API.

📅 Data/Hora: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}

Se você recebeu esta mensagem, a integração está funcionando corretamente!`;

    console.log(`Sending test message to: ${phone}`);

    // Send test message via Meta API
    const result = await sendMetaText({
      phone,
      message: testMessage,
    });

    if (!result.success) {
      console.error("Test message failed:", result.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error,
          errorCode: result.errorCode,
          debug: result.debug,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Test message sent successfully:", result.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Mensagem de teste enviada com sucesso via Meta Cloud API!",
        message_id: result.messageId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno do servidor" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log("[MercadoPago Test] Starting connection test...");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get MercadoPago config
    const { data: config, error: configError } = await supabase
      .from("mercadopago_config")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (configError || !config) {
      console.log("[MercadoPago Test] No active config found");
      return new Response(
        JSON.stringify({
          success: false,
          error: "config_not_found",
          message: "Nenhuma configuração ativa do Mercado Pago encontrada",
          tests: {
            config: { status: "error", message: "Configuração não encontrada" },
            api: { status: "skipped", message: "Teste pulado - sem configuração" },
            webhook: { status: "skipped", message: "Teste pulado - sem configuração" },
          },
          duration_ms: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[MercadoPago Test] Config found, testing API connection...");

    const tests = {
      config: { status: "success" as string, message: "Configuração encontrada e ativa" },
      api: { status: "pending" as string, message: "" },
      webhook: { status: "pending" as string, message: "", url: "" },
    };

    // Test API connection by getting user info
    const accessToken = config.access_token_encrypted;
    const apiBase = config.is_sandbox 
      ? "https://api.mercadopago.com" 
      : "https://api.mercadopago.com";

    try {
      const apiStartTime = Date.now();
      const userResponse = await fetch(`${apiBase}/users/me`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const apiDuration = Date.now() - apiStartTime;

      if (userResponse.ok) {
        const userData = await userResponse.json();
        tests.api = {
          status: "success",
          message: `Conectado como: ${userData.nickname || userData.email} (ID: ${userData.id}) - ${apiDuration}ms`,
        };
        console.log("[MercadoPago Test] API connection successful:", userData.id);
      } else {
        const errorData = await userResponse.json();
        tests.api = {
          status: "error",
          message: `Erro ${userResponse.status}: ${errorData.message || JSON.stringify(errorData)}`,
        };
        console.log("[MercadoPago Test] API connection failed:", errorData);
      }
    } catch (apiError: any) {
      tests.api = {
        status: "error",
        message: `Falha na conexão: ${apiError.message}`,
      };
      console.error("[MercadoPago Test] API connection error:", apiError);
    }

    // Test webhook endpoint
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
    tests.webhook.url = webhookUrl;

    try {
      const webhookStartTime = Date.now();
      const webhookResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "test",
          data: { id: `test_connection_${Date.now()}` },
          action: "test.connection",
        }),
      });

      const webhookDuration = Date.now() - webhookStartTime;
      const webhookData = await webhookResponse.json();

      if (webhookResponse.ok && webhookData.received) {
        tests.webhook.status = "success";
        tests.webhook.message = `Endpoint acessível e respondendo - ${webhookDuration}ms`;
        console.log("[MercadoPago Test] Webhook test successful");
      } else {
        tests.webhook.status = "error";
        tests.webhook.message = `Resposta inesperada: ${JSON.stringify(webhookData)}`;
        console.log("[MercadoPago Test] Webhook test failed:", webhookData);
      }
    } catch (webhookError: any) {
      tests.webhook.status = "error";
      tests.webhook.message = `Falha na conexão: ${webhookError.message}`;
      console.error("[MercadoPago Test] Webhook test error:", webhookError);
    }

    // Determine overall status
    const allSuccess = Object.values(tests).every((t) => t.status === "success");
    const hasError = Object.values(tests).some((t) => t.status === "error");

    const response = {
      success: allSuccess,
      overall_status: allSuccess ? "healthy" : hasError ? "unhealthy" : "partial",
      tests,
      config_info: {
        is_sandbox: config.is_sandbox,
        has_public_key: !!config.public_key,
        has_webhook_secret: !!config.webhook_secret,
        has_notification_url: !!config.notification_url,
      },
      duration_ms: Date.now() - startTime,
      tested_at: new Date().toISOString(),
    };

    console.log("[MercadoPago Test] Test complete:", response.overall_status);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[MercadoPago Test] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "unexpected_error",
        message: error.message,
        duration_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

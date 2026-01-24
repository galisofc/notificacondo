import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  testMetaConnection, 
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== AUTHENTICATION ==========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is super_admin
    const { data: superAdminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!superAdminRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Permissão negada: apenas super admins podem testar a conexão" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== CHECK META CONFIG ==========
    if (!isMetaConfigured()) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Meta WhatsApp não configurado",
          message: "Configure as variáveis META_WHATSAPP_PHONE_ID e META_WHATSAPP_ACCESS_TOKEN nos Secrets do Supabase.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Testing Meta WhatsApp Cloud API connection...");

    // Test connection to Meta API
    const result = await testMetaConnection();

    if (!result.success) {
      console.error("Connection test failed:", result.error);
      
      // Provide user-friendly error messages
      let userMessage = result.error || "Falha na conexão";
      
      if (result.errorCode === "190") {
        userMessage = "Access Token inválido ou expirado. Gere um novo token no Meta Business Manager.";
      } else if (result.errorCode === "100") {
        userMessage = "Phone Number ID inválido. Verifique o ID no Meta Business Manager.";
      } else if (result.error?.includes("OAuthException")) {
        userMessage = "Erro de autenticação OAuth. Verifique suas credenciais.";
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: userMessage,
          errorCode: result.errorCode,
          debug: result.debug,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the phone info from debug response
    let phoneInfo: any = {};
    try {
      phoneInfo = JSON.parse(result.debug?.response || "{}");
    } catch {
      phoneInfo = {};
    }

    console.log("Connection test successful:", phoneInfo);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Conexão com Meta WhatsApp Cloud API estabelecida com sucesso!",
        phone_info: phoneInfo,
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

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Authentication
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
        JSON.stringify({ success: false, error: "Permissão negada" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Meta credentials
    const accessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
    const businessAccountId = Deno.env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID");

    if (!accessToken || !businessAccountId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Credenciais da Meta não configuradas",
          message: "Configure META_WHATSAPP_ACCESS_TOKEN e META_WHATSAPP_BUSINESS_ACCOUNT_ID nos Secrets"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[List WABA Templates] Fetching templates from Meta...");

    // Fetch templates from Meta API
    const metaUrl = `https://graph.facebook.com/v20.0/${businessAccountId}/message_templates?limit=100`;
    
    const response = await fetch(metaUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    const responseText = await response.text();
    console.log(`[List WABA Templates] Response status: ${response.status}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data?.error?.message || "Erro ao listar templates",
          debug: { status: response.status, response: data }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process templates
    const templates = (data.data || []).map((template: any) => ({
      id: template.id,
      name: template.name,
      status: template.status,
      category: template.category,
      language: template.language,
      quality_score: template.quality_score?.score,
      components: template.components,
      rejected_reason: template.rejected_reason,
    }));

    console.log(`[List WABA Templates] Found ${templates.length} templates`);

    return new Response(
      JSON.stringify({
        success: true,
        templates,
        count: templates.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[List WABA Templates] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno do servidor" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
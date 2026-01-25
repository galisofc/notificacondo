import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    // Auth check
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check super_admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Meta credentials
    const accessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
    const businessAccountId = Deno.env.get("META_WHATSAPP_BUSINESS_ACCOUNT_ID");

    if (!accessToken) {
      return new Response(JSON.stringify({ 
        error: "META_WHATSAPP_ACCESS_TOKEN não configurado",
        configured: false,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!businessAccountId) {
      return new Response(JSON.stringify({ 
        error: "META_WHATSAPP_BUSINESS_ACCOUNT_ID não configurado. Adicione o ID da conta business nas secrets.",
        configured: false,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { templateName } = await req.json();

    // Fetch all templates from Meta API
    const endpoint = `https://graph.facebook.com/v20.0/${businessAccountId}/message_templates`;
    console.log(`[Template Status] Fetching templates from: ${endpoint}`);

    const response = await fetch(`${endpoint}?access_token=${accessToken}&limit=100`);
    const responseText = await response.text();
    
    console.log(`[Template Status] Response status: ${response.status}`);
    console.log(`[Template Status] Response: ${responseText.substring(0, 500)}`);

    if (!response.ok) {
      const errorData = JSON.parse(responseText);
      return new Response(JSON.stringify({
        success: false,
        error: errorData.error?.message || "Erro ao consultar templates",
        errorCode: errorData.error?.code,
        debug: {
          endpoint,
          status: response.status,
          response: responseText,
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = JSON.parse(responseText);
    const templates = data.data || [];

    // Find the specific template if requested
    if (templateName) {
      const template = templates.find((t: any) => t.name === templateName);
      
      if (!template) {
        return new Response(JSON.stringify({
          success: true,
          found: false,
          templateName,
          message: `Template "${templateName}" não encontrado na conta.`,
          availableTemplates: templates.map((t: any) => ({
            name: t.name,
            status: t.status,
            language: t.language,
          })),
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        found: true,
        template: {
          name: template.name,
          status: template.status,
          language: template.language,
          category: template.category,
          components: template.components,
          qualityScore: template.quality_score,
          rejectedReason: template.rejected_reason,
        },
        isApproved: template.status === "APPROVED",
        statusMessage: getStatusMessage(template.status),
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return all templates
    return new Response(JSON.stringify({
      success: true,
      templates: templates.map((t: any) => ({
        name: t.name,
        status: t.status,
        language: t.language,
        category: t.category,
        qualityScore: t.quality_score,
      })),
      totalCount: templates.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Template Status] Error:", errorMessage);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getStatusMessage(status: string): string {
  switch (status) {
    case "APPROVED":
      return "✅ Template aprovado e pronto para uso";
    case "PENDING":
      return "⏳ Template aguardando aprovação da Meta";
    case "REJECTED":
      return "❌ Template rejeitado - verifique o motivo no Meta Business Manager";
    case "PAUSED":
      return "⚠️ Template pausado devido a problemas de qualidade";
    case "DISABLED":
      return "🚫 Template desabilitado";
    default:
      return `Status: ${status}`;
  }
}

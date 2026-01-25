import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateTemplateRequest {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  components: {
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
    text?: string;
    example?: {
      header_text?: string[];
      body_text?: string[][];
      header_handle?: string[];
    };
    buttons?: {
      type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
      text: string;
      url?: string;
      phone_number?: string;
    }[];
  }[];
}

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

    const body: CreateTemplateRequest = await req.json();
    
    if (!body.name || !body.category || !body.components) {
      return new Response(
        JSON.stringify({ success: false, error: "Campos obrigatórios: name, category, components" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate template name (only lowercase letters, numbers, underscores)
    const namePattern = /^[a-z0-9_]+$/;
    if (!namePattern.test(body.name)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Nome inválido. Use apenas letras minúsculas, números e underscores."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Create WABA Template] Creating template: ${body.name}`);

    // Create template via Meta API
    const metaUrl = `https://graph.facebook.com/v20.0/${businessAccountId}/message_templates`;
    
    const response = await fetch(metaUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: body.name,
        category: body.category,
        language: body.language || "pt_BR",
        components: body.components,
      }),
    });

    const responseText = await response.text();
    console.log(`[Create WABA Template] Response: ${response.status} - ${responseText}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!response.ok) {
      const errorCode = data?.error?.code;
      const errorMessage = data?.error?.message || "Erro ao criar template";
      
      let friendlyMessage = errorMessage;
      
      // Map common Meta API errors
      if (errorCode === 100) {
        if (errorMessage.includes("already exists")) {
          friendlyMessage = "Já existe um template com este nome. Use um nome diferente.";
        } else if (errorMessage.includes("Invalid parameter")) {
          friendlyMessage = "Parâmetro inválido. Verifique os campos do template.";
        }
      } else if (errorCode === 190) {
        friendlyMessage = "Token de acesso inválido ou expirado.";
      } else if (errorCode === 368) {
        friendlyMessage = "Limite de criação de templates atingido. Tente novamente mais tarde.";
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: friendlyMessage,
          errorCode,
          debug: { status: response.status, response: data }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Create WABA Template] Template created successfully: ${data.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Template criado e enviado para aprovação da Meta!",
        template: {
          id: data.id,
          status: data.status || "PENDING",
          name: body.name,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Create WABA Template] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno do servidor" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
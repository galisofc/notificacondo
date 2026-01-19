import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const TestConnectionSchema = z.object({
  provider: z.enum(["zpro", "zapi", "evolution", "wppconnect"]).optional(),
  api_url: z.string().url("URL inválida").max(500).optional(),
  api_key: z.string().min(5).max(500).optional(),
  instance_id: z.string().max(100).optional(),
}).optional();

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
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== AUTHORIZATION: Only super_admin can test WhatsApp ==========
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      console.error(`User ${user.id} is not super_admin`);
      return new Response(
        JSON.stringify({ success: false, error: "Acesso negado. Apenas Super Admins podem testar a conexão" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Super admin ${user.id} testing WhatsApp connection`);

    // ========== INPUT VALIDATION ==========
    let body = null;
    try {
      body = await req.json().catch(() => null);
    } catch {
      body = null;
    }

    if (body) {
      const parsed = TestConnectionSchema.safeParse(body);
      if (!parsed.success) {
        console.error("Validation error:", parsed.error.errors);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Dados inválidos", 
            details: parsed.error.errors.map(e => e.message) 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      body = parsed.data;
    }

    let provider: string;
    let api_url: string;
    let api_key: string;
    let instance_id: string;

    if (body?.provider && body?.api_url && body?.api_key) {
      ({ provider, api_url, api_key } = body as any);
      instance_id = body.instance_id ?? "";
      console.log(`Testing connection using request body provider=${provider}`);
    } else {
      // Fetch WhatsApp config from database
      const { data: whatsappConfig, error: configError } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (configError) {
        console.error("Error fetching WhatsApp config:", configError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar configuração" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!whatsappConfig) {
        return new Response(
          JSON.stringify({ success: false, error: "Configuração não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      ({ provider, api_url, api_key, instance_id } = whatsappConfig as any);
      console.log(`Testing ${provider} connection (db config)...`);
    }


    let testUrl = "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    switch (provider) {
      case "zpro": {
        const baseUrl = api_url.replace(/\/$/, "");
        // If instance_id is empty or placeholder, fallback to api_key
        let externalKey = instance_id || "";
        if (!externalKey || externalKey === "zpro-embedded") {
          externalKey = api_key;
        }
        const params = new URLSearchParams({
          body: "ping",
          number: "5511999999999",
          externalKey,
          bearertoken: api_key,
          isClosed: "false",
        });
        testUrl = `${baseUrl}/params/?${params.toString()}`;
        break;
      }
      case "zapi":
        testUrl = `${api_url}/instances/${instance_id}/token/${api_key}/status`;
        break;
      case "evolution":
        testUrl = `${api_url}/instance/connectionState/${instance_id}`;
        headers["apikey"] = api_key;
        break;
      case "wppconnect":
        testUrl = `${api_url}/api/${instance_id}/status`;
        headers["Authorization"] = `Bearer ${api_key}`;
        break;
      default:
        testUrl = `${api_url}/status`;
    }

    console.log(`Testing URL: ${testUrl.substring(0, 60)}...`);

    try {
      const response = await fetch(testUrl, {
        method: "GET",
        headers,
      });

      console.log(`Response status: ${response.status}`);
      const responseText = await response.text();
      console.log(`Response: ${responseText.substring(0, 200)}`);
      
      // For Z-PRO, we need stricter validation
      if (provider === "zpro") {
        if (response.status === 401 || response.status === 403) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Credenciais inválidas (token incorreto)",
              status: response.status
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (response.status === 404) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Endpoint não encontrado (URL incorreta)",
              status: response.status
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (response.status >= 500) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Erro no servidor do provedor",
              status: response.status
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        if (response.status === 200 || response.status === 201 || response.status === 400) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Credenciais válidas",
              status: response.status
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Resposta inesperada: ${response.status}`,
            status: response.status
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For other providers, check for success status
      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Conexão estabelecida",
              data
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Conexão estabelecida"
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Falha na conexão: ${response.status}`,
            details: responseText
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (fetchError: any) {
      console.error("Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro de conexão: ${fetchError.message}`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

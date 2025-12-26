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

    const { provider, api_url, api_key, instance_id } = whatsappConfig;
    console.log(`Testing ${provider} connection...`);

    let testUrl = "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    switch (provider) {
      case "zpro":
        // Z-PRO: Use the params endpoint to verify connection
        // The API uses query parameters, so we just need to check if it responds
        const baseUrl = api_url.replace(/\/$/, "");
        testUrl = `${baseUrl}/params/?externalKey=${encodeURIComponent(api_key)}&bearertoken=${encodeURIComponent(api_key)}`;
        break;
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
      
      // For Z-PRO, many status codes are acceptable (the API may not have a GET endpoint)
      if (provider === "zpro") {
        // If we don't get 401/403, credentials are likely valid
        if (response.status !== 401 && response.status !== 403) {
          const responseText = await response.text();
          console.log(`Response: ${responseText.substring(0, 200)}`);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Credenciais válidas",
              status: response.status
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Credenciais inválidas",
              status: response.status
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // For other providers, check for success status
      if (response.ok) {
        const data = await response.json();
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Conexão estabelecida",
            data
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Falha na conexão: ${response.status}`,
            details: errorText
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (fetchError: any) {
      console.error("Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro de rede: ${fetchError.message}`
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

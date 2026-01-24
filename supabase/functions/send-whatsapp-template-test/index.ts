import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  phone: string;
  templateName?: string;
  language?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, templateName = "hello_world", language = "en_US" }: RequestBody = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Número de telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch WhatsApp config
    const { data: config, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      console.error("[Template Test] Config error:", configError);
      return new Response(
        JSON.stringify({ success: false, error: "Configuração do WhatsApp não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number (Brazilian format)
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // Build endpoint
    const endpoint = `${config.api_url}/templateBody`;
    
    // Build request body - Meta/WABA standard format with "to" field
    // The Z-PRO/Atende Aí Chat API may require the nested "template" structure
    const requestBody = {
      to: formattedPhone,
      number: formattedPhone, // Include both for compatibility
      type: "template",
      template: {
        name: templateName,
        language: {
          code: language
        },
        components: [] // hello_world has no dynamic components
      }
    };

    console.log("[Template Test] Endpoint:", endpoint);
    console.log("[Template Test] Template:", templateName);
    console.log("[Template Test] Phone:", formattedPhone);
    console.log("[Template Test] Request body:", JSON.stringify(requestBody, null, 2));

    // Send request to Z-PRO API
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.api_key}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log("[Template Test] Response status:", response.status);
    console.log("[Template Test] Response body:", responseText);

    // Parse response
    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    if (response.ok && result.success !== false && !result.error) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Template ${templateName} enviado com sucesso`,
          messageId: result.messageId || result.key?.id || result.id || result.messages?.[0]?.id,
          response: result 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error || result.message || `HTTP ${response.status}`,
          debug: {
            status: response.status,
            endpoint,
            templateName,
            response: result
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("[Template Test] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

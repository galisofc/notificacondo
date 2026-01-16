import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitize strings for use in messages
const sanitize = (str: string) => str.replace(/[<>"'`]/g, "").trim();

// Multi-provider WhatsApp configuration
type WhatsAppProvider = "zpro" | "zapi" | "evolution" | "wppconnect";

interface ProviderConfig {
  sendMessage: (phone: string, message: string, config: ProviderSettings) => Promise<{ success: boolean; messageId?: string; error?: string }>;
}

interface ProviderSettings {
  apiUrl: string;
  apiKey: string;
  instanceId: string;
}

interface WhatsAppConfigRow {
  id: string;
  provider: string;
  api_url: string;
  api_key: string;
  instance_id: string;
  is_active: boolean;
  app_url?: string;
}

// Z-PRO Provider - Uses query parameters via GET
const zproProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
    const baseUrl = config.apiUrl.replace(/\/$/, "");
    const phoneClean = phone.replace(/\D/g, "");
    
    const params = new URLSearchParams({
      body: message,
      number: phoneClean,
      externalKey: config.apiKey,
      bearertoken: config.apiKey,
      isClosed: "false"
    });
    
    const sendUrl = `${baseUrl}/params/?${params.toString()}`;
    console.log("Z-PRO sending to:", sendUrl.substring(0, 150) + "...");
    
    try {
      const response = await fetch(sendUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      const responseText = await response.text();
      console.log("Z-PRO response status:", response.status);
      console.log("Z-PRO response:", responseText.substring(0, 200));
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        return { success: false, error: `Resposta inválida: ${responseText.substring(0, 100)}` };
      }
      
      if (response.ok) {
        const extractedMessageId = data.id || data.messageId || data.key?.id || data.msgId || data.message_id;
        
        if (extractedMessageId && extractedMessageId !== "sent") {
          return { success: true, messageId: String(extractedMessageId) };
        }
        
        if (data.status === "success" || data.status === "PENDING" || response.status === 200) {
          const trackingId = `zpro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          return { success: true, messageId: trackingId };
        }
        
        return { success: true, messageId: `zpro_${Date.now()}` };
      }
      
      return { success: false, error: data.message || data.error || `Erro ${response.status}` };
    } catch (error: any) {
      return { success: false, error: `Erro de conexão: ${error.message}` };
    }
  },
};

// Z-API Provider
const zapiProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
    const response = await fetch(`${config.apiUrl}/instances/${config.instanceId}/token/${config.apiKey}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.replace(/\D/g, ""),
        message: message,
      }),
    });
    
    const data = await response.json();
    if (response.ok && data.zapiMessageId) {
      return { success: true, messageId: data.zapiMessageId };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  },
};

// Evolution API Provider
const evolutionProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
    const response = await fetch(`${config.apiUrl}/message/sendText/${config.instanceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.apiKey,
      },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ""),
        text: message,
      }),
    });
    
    const data = await response.json();
    if (response.ok && data.key?.id) {
      return { success: true, messageId: data.key.id };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  },
};

// WPPConnect Provider
const wppconnectProvider: ProviderConfig = {
  async sendMessage(phone: string, message: string, config: ProviderSettings) {
    const response = await fetch(`${config.apiUrl}/api/${config.instanceId}/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        phone: phone.replace(/\D/g, ""),
        message: message,
        isGroup: false,
      }),
    });
    
    const data = await response.json();
    if (response.ok && data.status === "success") {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data.message || "Erro ao enviar mensagem" };
  },
};

const providers: Record<WhatsAppProvider, ProviderConfig> = {
  zpro: zproProvider,
  zapi: zapiProvider,
  evolution: evolutionProvider,
  wppconnect: wppconnectProvider,
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
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    // ========== INPUT VALIDATION ==========
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "JSON inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { package_id, apartment_id, pickup_code, photo_url } = body;

    if (!package_id || !apartment_id || !pickup_code) {
      return new Response(
        JSON.stringify({ error: "Dados incompletos: package_id, apartment_id e pickup_code são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Notifying package arrival: ${package_id} for apartment ${apartment_id}`);

    // ========== AUTHORIZATION ==========
    // Check if user is porteiro linked to the condominium or is sindico/super_admin
    const { data: apartment, error: aptError } = await supabase
      .from("apartments")
      .select(`
        id,
        number,
        blocks!inner (
          id,
          name,
          condominiums!inner (
            id,
            name,
            owner_id
          )
        )
      `)
      .eq("id", apartment_id)
      .single();

    if (aptError || !apartment) {
      console.error("Apartment not found:", aptError);
      return new Response(
        JSON.stringify({ error: "Apartamento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const blocks = apartment.blocks as any;
    const condoId = blocks.condominiums.id;
    const condoName = blocks.condominiums.name;
    const blockName = blocks.name;
    const aptNumber = apartment.number;

    // Check authorization (porteiro linked to condo, sindico owner, or super_admin)
    const { data: userCondoLink } = await supabase
      .from("user_condominiums")
      .select("id")
      .eq("user_id", user.id)
      .eq("condominium_id", condoId)
      .maybeSingle();

    const isOwner = blocks.condominiums.owner_id === user.id;
    
    const { data: superAdminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!userCondoLink && !isOwner && !superAdminRole) {
      console.error(`User ${user.id} not authorized for condominium ${condoId}`);
      return new Response(
        JSON.stringify({ error: "Sem permissão para notificar neste condomínio" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== FETCH PACKAGE DETAILS ==========
    const { data: packageData, error: pkgError } = await supabase
      .from("packages")
      .select(`
        id,
        tracking_code,
        package_type_id,
        package_types (
          id,
          name
        )
      `)
      .eq("id", package_id)
      .single();

    if (pkgError) {
      console.error("Error fetching package:", pkgError);
    }

    const packageTypeName = (packageData?.package_types as any)?.name || "Não informado";
    const trackingCode = packageData?.tracking_code || "Não informado";

    console.log(`Package type: ${packageTypeName}, Tracking: ${trackingCode}`);

    // ========== FETCH RESIDENTS ==========
    const { data: residents, error: resError } = await supabase
      .from("residents")
      .select("id, full_name, phone, email")
      .eq("apartment_id", apartment_id);

    if (resError) {
      console.error("Error fetching residents:", resError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar moradores" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!residents || residents.length === 0) {
      console.log("No residents found for apartment:", apartment_id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhum morador cadastrado para este apartamento",
          notifications_sent: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter residents with phone numbers
    const residentsWithPhone = residents.filter(r => r.phone);
    
    if (residentsWithPhone.length === 0) {
      console.log("No residents with phone numbers found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhum morador com telefone cadastrado",
          notifications_sent: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== FETCH WHATSAPP CONFIG ==========
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
        JSON.stringify({ error: "Erro ao buscar configuração do WhatsApp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!whatsappConfig) {
      console.log("WhatsApp not configured");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "WhatsApp não configurado. Encomenda registrada sem notificação.",
          notifications_sent: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typedConfig = whatsappConfig as WhatsAppConfigRow;
    const whatsappProvider = (typedConfig.provider || "zpro") as WhatsAppProvider;
    const provider = providers[whatsappProvider];

    console.log(`Using WhatsApp provider: ${whatsappProvider}`);

    // ========== FETCH TEMPLATE ==========
    let templateContent: string | null = null;
    
    // Check for custom condominium template
    const { data: customTemplate } = await supabase
      .from("condominium_whatsapp_templates")
      .select("content")
      .eq("condominium_id", condoId)
      .eq("template_slug", "package_arrival")
      .eq("is_active", true)
      .maybeSingle();

    if (customTemplate?.content) {
      templateContent = customTemplate.content;
      console.log("Using custom condominium template");
    } else {
      // Fall back to default template
      const { data: defaultTemplate } = await supabase
        .from("whatsapp_templates")
        .select("content")
        .eq("slug", "package_arrival")
        .eq("is_active", true)
        .maybeSingle();
      
      if (defaultTemplate?.content) {
        templateContent = defaultTemplate.content;
        console.log("Using default system template");
      }
    }

    // Default message template (with package type and tracking)
    const defaultMessage = `📦 *Nova Encomenda!*

🏢 *{condominio}*

Olá, *{nome}*!

Você tem uma encomenda aguardando na portaria.

📋 *Tipo:* {tipo_encomenda}
📍 *Rastreio:* {codigo_rastreio}
🏠 *Destino:* BLOCO {bloco}, APTO {apartamento}
🔑 *Código de retirada:* {codigo}

Apresente este código na portaria para retirar sua encomenda.

_Mensagem automática - NotificaCondo_`;

    // ========== SEND NOTIFICATIONS ==========
    const results: Array<{ resident_id: string; success: boolean; error?: string }> = [];

    for (const resident of residentsWithPhone) {
      // Build message with all variables including package type and tracking
      let message = templateContent || defaultMessage;
      message = message
        .replace(/{nome}/g, sanitize(resident.full_name))
        .replace(/{condominio}/g, sanitize(condoName))
        .replace(/{bloco}/g, sanitize(blockName))
        .replace(/{apartamento}/g, sanitize(aptNumber))
        .replace(/{codigo}/g, pickup_code)
        .replace(/{tipo_encomenda}/g, sanitize(packageTypeName))
        .replace(/{codigo_rastreio}/g, sanitize(trackingCode));

      console.log(`Sending notification to ${resident.full_name} (${resident.phone})`);

      try {
        const result = await provider.sendMessage(resident.phone!, message, {
          apiUrl: typedConfig.api_url,
          apiKey: typedConfig.api_key,
          instanceId: typedConfig.instance_id,
        });

        results.push({
          resident_id: resident.id,
          success: result.success,
          error: result.error,
        });

        if (result.success) {
          console.log(`Notification sent successfully to ${resident.full_name}`);
        } else {
          console.error(`Failed to notify ${resident.full_name}:`, result.error);
        }
      } catch (error: any) {
        console.error(`Error sending to ${resident.full_name}:`, error);
        results.push({
          resident_id: resident.id,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Notifications complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notificações enviadas: ${successCount} de ${results.length}`,
        notifications_sent: successCount,
        notifications_failed: failCount,
        details: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

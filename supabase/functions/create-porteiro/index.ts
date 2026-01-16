import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Z-PRO Provider
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

// Generate a readable password
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function findAuthUserByEmail(
  supabase: any,
  emailLower: string,
): Promise<{ id: string; email?: string | null } | null> {
  // admin.listUsers is paginated; if we only fetch page 1 we can miss older users.
  // We'll scan pages with a safe cap.
  const perPage = 200;
  const maxPages = 50; // up to 10k users

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("Error listing auth users:", error);
      return null;
    }

    const users = data?.users ?? [];
    const found = users.find((u: any) => (u.email ?? "").toLowerCase() === emailLower);
    if (found) return found;

    if (users.length < perPage) break; // last page reached
  }

  return null;
}


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

    const { full_name, email, phone, condominium_id } = body;

    if (!full_name || !email || !condominium_id) {
      return new Response(
        JSON.stringify({ error: "Nome, e-mail e condomínio são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== AUTHORIZATION ==========
    // Verify user is owner of the condominium
    const { data: condo, error: condoError } = await supabase
      .from("condominiums")
      .select("id, name, owner_id")
      .eq("id", condominium_id)
      .single();

    if (condoError || !condo) {
      console.error("Condominium not found:", condoError);
      return new Response(
        JSON.stringify({ error: "Condomínio não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (condo.owner_id !== user.id) {
      // Check if super_admin
      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!superAdminRole) {
        console.error(`User ${user.id} is not owner of condominium`);
        return new Response(
          JSON.stringify({ error: "Sem permissão para adicionar porteiros neste condomínio" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Authorization passed for user ${user.id} on condominium ${condo.name}`);

    // ========== CHECK IF USER EXISTS ==========
    const emailLower = email.toLowerCase().trim();
    
    // First check in profiles table
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", emailLower)
      .maybeSingle();

    // Also check directly in auth users (in case profile doesn't exist)
    const existingAuthUser = await findAuthUserByEmail(supabase, emailLower);


    let userId: string;
    let password: string | null = null;
    let isNewUser = false;

    // Determine if user exists (either in profiles or in auth)
    if (existingProfile) {
      userId = existingProfile.user_id;
      console.log(`User already exists in profiles with id: ${userId}`);
    } else if (existingAuthUser) {
      userId = existingAuthUser.id;
      console.log(`User already exists in auth with id: ${userId}`);
    } else {
      // User doesn't exist anywhere - create new user
      userId = ""; // Will be set after creation
    }

    // Handle existing user (from profile or auth)
    if (existingProfile || existingAuthUser) {
      // Check if user is a sindico or super_admin - cannot be registered as porter
      const { data: existingRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const roles = (existingRoles || []).map((r: { role: string }) => r.role);

      if (roles.includes("sindico") || roles.includes("super_admin")) {
        console.log(`User ${userId} is a sindico/super_admin, cannot be registered as porter`);
        return new Response(
          JSON.stringify({ error: "Este e-mail pertence a um síndico ou administrador e não pode ser cadastrado como porteiro" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already a porter for this condominium
      const { data: existingLink } = await supabase
        .from("user_condominiums")
        .select("id")
        .eq("user_id", userId)
        .eq("condominium_id", condominium_id)
        .maybeSingle();

      if (existingLink) {
        return new Response(
          JSON.stringify({ error: "Este usuário já é porteiro deste condomínio" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if has porteiro role, add if not
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "porteiro")
        .maybeSingle();

      if (!existingRole) {
        await supabase.from("user_roles").insert({
          user_id: userId,
          role: "porteiro",
        });
        console.log(`Added porteiro role to existing user ${userId}`);
      }

      // Create profile if it doesn't exist (user was in auth but not profiles)
      if (!existingProfile && existingAuthUser) {
        const { error: profileError } = await supabase.from("profiles").insert({
          user_id: userId,
          email: emailLower,
          full_name: full_name,
          phone: phone || null,
        });
        if (profileError) {
          console.log("Profile already exists or error:", profileError.message);
        } else {
          console.log(`Created profile for existing auth user ${userId}`);
        }
      }
    } else {
      // Create new user
      password = generatePassword();
      isNewUser = true;

      console.log(`Creating new user for: ${emailLower}`);

      const { data: authData, error: createError } = await supabase.auth.admin.createUser({
        email: emailLower,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name,
        },
      });

      if (createError || !authData.user) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: createError?.message || "Erro ao criar usuário" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = authData.user.id;
      console.log(`Created new user with id: ${userId}`);

      // Update profile with phone if provided
      const profileData: Record<string, string> = { full_name };
      if (phone) {
        profileData.phone = phone;
      }

      await supabase
        .from("profiles")
        .update(profileData)
        .eq("user_id", userId);

      // Add porteiro role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: "porteiro",
      });

      if (roleError) {
        console.error("Error adding role:", roleError);
      }
    }

    // ========== LINK PORTER TO CONDOMINIUM ==========
    const { error: linkError } = await supabase.from("user_condominiums").insert({
      user_id: userId,
      condominium_id: condominium_id,
    });

    if (linkError) {
      console.error("Error linking porter to condominium:", linkError);
      return new Response(
        JSON.stringify({ error: "Erro ao vincular porteiro ao condomínio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Linked user ${userId} to condominium ${condominium_id}`);

    // ========== SEND WHATSAPP IF NEW USER WITH PHONE ==========
    let whatsappSent = false;
    let whatsappError: string | null = null;

    if (isNewUser && phone && password) {
      console.log("Attempting to send WhatsApp with credentials...");

      // Fetch WhatsApp config from database
      const { data: whatsappConfig } = await supabase
        .from("whatsapp_config")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (whatsappConfig) {
        const whatsappProvider = (whatsappConfig.provider || "zpro") as WhatsAppProvider;
        const appUrl = whatsappConfig.app_url || "https://notificacondo.lovable.app";

        const message = `🏢 *${condo.name}*

Olá, *${full_name}*! 👋

Você foi cadastrado como *Porteiro* no sistema NotificaCondo.

📱 *Seus dados de acesso:*
📧 E-mail: ${emailLower}
🔑 Senha: *${password}*

Acesse o sistema pelo link:
👉 ${appUrl}/auth

⚠️ *Importante:* Recomendamos que você altere sua senha no primeiro acesso.

Em caso de dúvidas, entre em contato com o síndico do seu condomínio.`;

        const provider = providers[whatsappProvider];
        const result = await provider.sendMessage(phone, message, {
          apiUrl: whatsappConfig.api_url,
          apiKey: whatsappConfig.api_key,
          instanceId: whatsappConfig.instance_id,
        });

        if (result.success) {
          whatsappSent = true;
          console.log("WhatsApp sent successfully:", result.messageId);
        } else {
          whatsappError = result.error || "Erro desconhecido";
          console.error("WhatsApp failed:", whatsappError);
        }
      } else {
        console.log("WhatsApp not configured, skipping notification");
        whatsappError = "WhatsApp não configurado no sistema";
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        is_new_user: isNewUser,
        whatsapp_sent: whatsappSent,
        whatsapp_error: whatsappError,
        message: isNewUser 
          ? whatsappSent 
            ? "Porteiro cadastrado! Credenciais enviadas via WhatsApp."
            : phone 
              ? "Porteiro cadastrado! Não foi possível enviar WhatsApp."
              : "Porteiro cadastrado! Informe as credenciais manualmente."
          : "Porteiro vinculado ao condomínio com sucesso!",
        // Only return password if WhatsApp failed and it's a new user
        password: isNewUser && !whatsappSent ? password : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find sindico profile by email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, phone")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (profileError) {
      console.error("Error finding profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar perfil" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile || !profile.phone) {
      // Return success even if not found to prevent enumeration attacks
      console.log("Profile not found or no phone for email:", email);
      return new Response(
        JSON.stringify({ success: true, message: "Se o email estiver cadastrado, você receberá o link." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is sindico
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.user_id)
      .eq("role", "sindico")
      .maybeSingle();

    if (roleError) {
      console.error("Error checking role:", roleError);
    }

    if (!userRole) {
      // Return success to prevent enumeration
      console.log("User is not a sindico:", profile.user_id);
      return new Response(
        JSON.stringify({ success: true, message: "Se o número estiver cadastrado, você receberá o link." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp config
    const { data: whatsappConfig, error: configError } = await supabase
      .from("whatsapp_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !whatsappConfig) {
      console.error("WhatsApp config not found:", configError);
      return new Response(
        JSON.stringify({ error: "Configuração de WhatsApp não encontrada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a random temporary password
    const generatePassword = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let password = '';
      for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const newPassword = generatePassword();

    // Update user password using Supabase Auth Admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar nova senha" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone number from profile
    const phoneDigits = profile.phone.replace(/\D/g, '');
    const formattedPhone = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;

    // Send WhatsApp message with the new password
    const message = `🔐 *NotificaCondo - Nova Senha*\n\nOlá, ${profile.full_name}!\n\nSua nova senha temporária é:\n\n*${newPassword}*\n\n⚠️ Por segurança, altere sua senha após o primeiro acesso.\n\nAcesse: https://notificacondo.lovable.app/auth`;

    const { api_url, api_key, instance_id, provider } = whatsappConfig;
    const baseUrl = api_url.replace(/\/$/, "");

    // Apply externalKey fallback logic
    let externalKey = instance_id || "";
    if (!externalKey || externalKey === "zpro-embedded") {
      externalKey = api_key;
    }

    console.log("Sending WhatsApp message to:", formattedPhone);
    console.log("Using provider:", provider || "zpro");

    let whatsappResponse: Response;

    if (provider === "zpro" || !provider) {
      // Z-PRO uses /params/ endpoint with query parameters
      const params = new URLSearchParams({
        body: message,
        number: formattedPhone,
        externalKey: externalKey,
        bearertoken: api_key,
        isClosed: "false"
      });

      const whatsappUrl = `${baseUrl}/params/?${params.toString()}`;
      console.log("Z-PRO URL:", whatsappUrl.substring(0, 100) + "...");

      whatsappResponse = await fetch(whatsappUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
    } else {
      // Other providers (fallback)
      whatsappResponse = await fetch(`${baseUrl}/send-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${api_key}`,
        },
        body: JSON.stringify({
          phone: formattedPhone,
          message: message,
        }),
      });
    }

    const responseText = await whatsappResponse.text();
    console.log("WhatsApp API response status:", whatsappResponse.status);
    console.log("WhatsApp API response:", responseText.substring(0, 200));

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    // For Z-PRO, status 200 means success even without explicit success field
    if (!whatsappResponse.ok) {
      console.error("WhatsApp API error:", responseData);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar mensagem via WhatsApp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Password recovery link sent successfully to:", formattedPhone);

    return new Response(
      JSON.stringify({ success: true, message: "Link de recuperação enviado com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in send-password-recovery:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
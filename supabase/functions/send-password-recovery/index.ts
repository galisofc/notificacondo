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
    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Número de telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find sindico profile by phone
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, phone")
      .eq("phone", phone)
      .maybeSingle();

    if (profileError) {
      console.error("Error finding profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar perfil" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile) {
      // Return success even if not found to prevent enumeration attacks
      console.log("Profile not found for phone:", phone);
      return new Response(
        JSON.stringify({ success: true, message: "Se o número estiver cadastrado, você receberá o link." }),
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

    // Generate password reset link using Supabase Auth
    const appUrl = whatsappConfig.app_url || "https://notificacondo.lovable.app";
    
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
      options: {
        redirectTo: `${appUrl}/auth?recovery=true`,
      },
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de recuperação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resetLink = resetData.properties?.action_link;
    if (!resetLink) {
      console.error("Reset link not generated");
      return new Response(
        JSON.stringify({ error: "Link de recuperação não gerado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send WhatsApp message
    const message = `🔐 *NotificaCondo - Recuperação de Senha*\n\nOlá, ${profile.full_name}!\n\nVocê solicitou a recuperação de senha da sua conta.\n\nClique no link abaixo para criar uma nova senha:\n${resetLink}\n\n⚠️ Este link é válido por 1 hora.\n\nSe você não solicitou esta recuperação, ignore esta mensagem.`;

    const { api_url, api_key, instance_id } = whatsappConfig;

    // Apply externalKey fallback logic
    let externalKey = instance_id || "";
    if (!externalKey || externalKey === "zpro-embedded") {
      externalKey = api_key;
    }

    const params = new URLSearchParams({
      phone: phone,
      message: message,
      externalKey: externalKey,
    });

    const whatsappUrl = `${api_url}/send-text?${params.toString()}`;

    console.log("Sending WhatsApp message to:", phone);

    const whatsappResponse = await fetch(whatsappUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${api_key}`,
      },
    });

    const responseText = await whatsappResponse.text();
    console.log("WhatsApp API response:", responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!whatsappResponse.ok) {
      console.error("WhatsApp API error:", responseData);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar mensagem via WhatsApp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Password recovery link sent successfully to:", phone);

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
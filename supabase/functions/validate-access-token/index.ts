import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateTokenRequest {
  token: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token }: ValidateTokenRequest = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find notification with this token
    const { data: notification, error: notifError } = await supabase
      .from("notifications_sent")
      .select(`
        id,
        resident_id,
        occurrence_id,
        read_at,
        acknowledged_at,
        residents!inner (
          id,
          full_name,
          email,
          phone,
          user_id,
          apartment_id,
          apartments!inner (
            number,
            blocks!inner (
              name,
              condominiums!inner (
                id,
                name
              )
            )
          )
        )
      `)
      .eq("secure_link_token", token)
      .maybeSingle();

    if (notifError || !notification) {
      console.error("Token lookup error:", notifError);
      return new Response(
        JSON.stringify({ error: "Link inválido ou expirado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch app URL from whatsapp_config
    const { data: whatsappConfig } = await supabase
      .from("whatsapp_config")
      .select("app_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const appBaseUrl = (whatsappConfig as any)?.app_url || req.headers.get("origin") || "https://notificacondo.com.br";

    const resident = notification.residents as any;
    const apt = resident.apartments;

    // Update notification as read
    await supabase
      .from("notifications_sent")
      .update({
        read_at: new Date().toISOString(),
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
        user_agent: req.headers.get("user-agent"),
      })
      .eq("id", notification.id);

    // Check if resident already has a user_id linked
    let userId = resident.user_id;
    let isNewUser = false;

    if (!userId) {
      // Create a new auth user for this resident
      const tempPassword = crypto.randomUUID();
      const email = resident.email || `resident_${resident.id}@temp.condomaster.app`;

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: resident.full_name,
          resident_id: resident.id,
        },
      });

      if (authError) {
        // If user already exists with this email, try to get them
        if (authError.message.includes("already been registered")) {
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find(u => u.email === email);
          if (existingUser) {
            userId = existingUser.id;
          }
        } else {
          console.error("Auth creation error:", authError);
          return new Response(
            JSON.stringify({ error: "Erro ao criar acesso" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        userId = authData.user.id;
        isNewUser = true;
      }

      // Link resident to auth user
      await supabase
        .from("residents")
        .update({ user_id: userId })
        .eq("id", resident.id);
    }

    // Always ensure user role exists for morador (even for existing users)
    if (userId) {
      await supabase
        .from("user_roles")
        .upsert({
          user_id: userId,
          role: "morador",
        }, { onConflict: "user_id" });
    }

    // Generate a magic link for the user - redirect directly to the occurrence details
    const redirectPath = `/resident/occurrences/${notification.occurrence_id}`;
    
    console.log(`Generating magic link with redirect to: ${appBaseUrl}${redirectPath}`);
    
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: resident.email || `resident_${resident.id}@temp.condomaster.app`,
      options: {
        redirectTo: `${appBaseUrl}${redirectPath}`,
      },
    });

    if (linkError) {
      console.error("Magic link error:", linkError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de acesso" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        magicLink: linkData.properties?.action_link,
        resident: {
          id: resident.id,
          full_name: resident.full_name,
          apartment_number: apt.number,
          block_name: apt.blocks.name,
          condominium_name: apt.blocks.condominiums.name,
        },
        occurrence_id: notification.occurrence_id,
        isNewUser,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

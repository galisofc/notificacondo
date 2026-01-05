import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const ValidateTokenSchema = z.object({
  token: z.string().uuid("Token deve ser um UUID válido"),
});

// Token expiration: 7 days
const TOKEN_EXPIRATION_DAYS = 7;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const parsed = ValidateTokenSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Validation error:", parsed.error.errors);
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { token } = parsed.data;

    // Log access attempt for security monitoring
    console.log(`Token validation attempt from IP: ${req.headers.get("x-forwarded-for") || "unknown"}`);

    // Find notification with this token
    const { data: notification, error: notifError } = await supabase
      .from("notifications_sent")
      .select(`
        id,
        resident_id,
        occurrence_id,
        read_at,
        acknowledged_at,
        sent_at,
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

    const clientIpForLog = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const clientUserAgentForLog = req.headers.get("user-agent") || "unknown";

    if (notifError || !notification) {
      console.error("Token lookup error:", notifError);
      
      // Log failed access attempt (invalid token)
      await supabase
        .from("magic_link_access_logs")
        .insert({
          token_id: token, // Use the token UUID directly
          ip_address: clientIpForLog,
          user_agent: clientUserAgentForLog,
          success: false,
          is_new_user: false,
          error_message: "Token inválido ou não encontrado",
        });

      return new Response(
        JSON.stringify({ error: "Link inválido ou expirado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== TOKEN EXPIRATION CHECK ==========
    const sentAt = new Date(notification.sent_at);
    const expirationDate = new Date(sentAt.getTime() + TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();

    if (now > expirationDate) {
      console.log(`Token expired. Sent at: ${sentAt.toISOString()}, Expired at: ${expirationDate.toISOString()}`);
      
      // Log failed access attempt (expired token)
      await supabase
        .from("magic_link_access_logs")
        .insert({
          token_id: notification.id,
          resident_id: (notification.residents as any)?.id,
          occurrence_id: notification.occurrence_id,
          ip_address: clientIpForLog,
          user_agent: clientUserAgentForLog,
          success: false,
          is_new_user: false,
          error_message: "Token expirado",
        });

      return new Response(
        JSON.stringify({ error: "Link expirado. Solicite um novo link ao síndico." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const clientUserAgent = req.headers.get("user-agent") || "unknown";

    // Update notification as read
    await supabase
      .from("notifications_sent")
      .update({
        read_at: new Date().toISOString(),
        ip_address: clientIp,
        user_agent: clientUserAgent,
      })
      .eq("id", notification.id);

    // Check if resident already has a user_id linked
    let userId = resident.user_id;
    let isNewUser = false;

    if (!userId) {
      // Create a new auth user for this resident
      const tempPassword = crypto.randomUUID();
      // Use resident email if available, otherwise create a safe temp email
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

    // Always ensure user role is "morador" (even for existing users)
    if (userId) {
      console.log(`Setting user role to morador for user: ${userId}`);
      
      // Delete any existing role first (to override sindico role from trigger)
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      
      // Insert morador role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "morador",
        });
      
      if (roleError) {
        console.error("Error setting user role:", roleError);
      } else {
        console.log("User role set to morador successfully");
      }
    }

    // Generate a magic link for the user - use callback page to handle auth properly
    // Include the desired post-login path as a query param to make redirects robust (no localStorage reliance)
    const nextPath = `/resident/occurrences/${notification.occurrence_id}`;
    const callbackUrl = `${appBaseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    console.log(`Generating magic link with callback: ${callbackUrl}`);
    console.log(`Target occurrence: ${nextPath}`);
    
    const residentEmail = resident.email || `resident_${resident.id}@temp.condomaster.app`;
    
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: residentEmail,
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (linkError) {
      console.error("Magic link error:", linkError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar link de acesso" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const redirectUrl = `${appBaseUrl}/resident/occurrences/${notification.occurrence_id}`;

    // Log magic link access for audit
    await supabase
      .from("magic_link_access_logs")
      .insert({
        token_id: notification.id,
        resident_id: resident.id,
        occurrence_id: notification.occurrence_id,
        user_id: userId,
        ip_address: clientIp,
        user_agent: clientUserAgent,
        success: true,
        is_new_user: isNewUser,
        redirect_url: redirectUrl,
      });

    console.log(`Magic link access logged for resident ${resident.id}, occurrence ${notification.occurrence_id}`);

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

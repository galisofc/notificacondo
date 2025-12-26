import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateSindicoRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  plan: "start" | "essencial" | "profissional" | "enterprise";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the requesting user is a super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autorizado");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      throw new Error("Não autorizado");
    }

    // Check if requesting user is super_admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "super_admin")
      .single();

    if (!roleData) {
      throw new Error("Acesso negado. Apenas Super Admins podem criar síndicos.");
    }

    const body: CreateSindicoRequest = await req.json();
    const { email, password, full_name, phone, plan } = body;

    if (!email || !password || !full_name || !plan) {
      throw new Error("Campos obrigatórios: email, password, full_name, plan");
    }

    // Create the user in auth.users
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (createUserError) {
      throw new Error(`Erro ao criar usuário: ${createUserError.message}`);
    }

    const userId = newUser.user.id;

    // Update profile (trigger already created it, so we update with additional info)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name,
        phone: phone || null,
      })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Profile update error:", profileError);
      // Don't rollback, profile was created by trigger with basic info
    }

    // User role is already created as 'sindico' by the trigger, no action needed

    // Get plan limits based on plan type
    const planLimits = {
      start: { notifications_limit: 10, warnings_limit: 10, fines_limit: 0 },
      essencial: { notifications_limit: 50, warnings_limit: 50, fines_limit: 25 },
      profissional: { notifications_limit: 200, warnings_limit: 200, fines_limit: 100 },
      enterprise: { notifications_limit: 999999, warnings_limit: 999999, fines_limit: 999999 },
    };

    const limits = planLimits[plan] || planLimits.start;

    // Update subscription with correct plan (trigger creates with 'start' plan)
    const { error: subscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        plan,
        active: true,
        notifications_limit: limits.notifications_limit,
        warnings_limit: limits.warnings_limit,
        fines_limit: limits.fines_limit,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("user_id", userId);

    if (subscriptionError) {
      console.error("Subscription update error:", subscriptionError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Síndico criado com sucesso",
        user_id: userId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Create sindico error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro interno do servidor",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

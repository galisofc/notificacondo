import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateSuperAdminRequest {
  email: string;
  password: string;
  full_name: string;
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

    const body: CreateSuperAdminRequest = await req.json();
    const { email, password, full_name } = body;

    if (!email || !password || !full_name) {
      throw new Error("Campos obrigatórios: email, password, full_name");
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

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: userId,
        email,
        full_name,
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Erro ao criar perfil: ${profileError.message}`);
    }

    // Create user_role as super_admin
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "super_admin",
      });

    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Erro ao atribuir role: ${roleError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Super Admin criado com sucesso",
        user_id: userId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Create super admin error:", error);
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

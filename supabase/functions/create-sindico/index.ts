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
  cpf: string;
  phone?: string;
  plan?: "start" | "essencial" | "profissional" | "enterprise";
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
    const { email, password, full_name, cpf, phone } = body;

    if (!email || !password || !full_name || !cpf) {
      throw new Error("Campos obrigatórios: email, password, full_name, cpf");
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
        cpf: cpf.replace(/\D/g, ""), // Store only digits
        phone: phone || null,
      })
      .eq("user_id", userId);

    if (profileError) {
      console.error("Profile update error:", profileError);
      // Don't rollback, profile was created by trigger with basic info
    }

    // Note: Subscription will be created when the sindico creates a condominium (via trigger)
    // No need to create subscription here anymore

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

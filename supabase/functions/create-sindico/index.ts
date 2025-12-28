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

    // Definir o ID do usuário que está fazendo a ação para auditoria
    console.log("Setting user context for audit:", requestingUser.id);

    const body: CreateSindicoRequest = await req.json();
    const { email, password, full_name, cpf, phone } = body;

    if (!email || !password || !full_name || !cpf) {
      throw new Error("Campos obrigatórios: email, password, full_name, cpf");
    }

    // Clean CPF (remove non-digits)
    const cleanCpf = cpf.replace(/\D/g, "");

    // Check if CPF already exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("cpf", cleanCpf)
      .maybeSingle();

    if (existingProfile) {
      throw new Error("CPF já cadastrado no sistema. Verifique os dados informados.");
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

    console.log("User created with ID:", userId);
    console.log("CPF to save:", cleanCpf);

    // Wait a bit for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update profile (trigger already created it, so we update with additional info)
    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name,
        cpf: cleanCpf,
        phone: phone || null,
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (profileError) {
      console.error("Profile update error:", profileError);
      // Try upsert as fallback
      const { error: upsertError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          user_id: userId,
          email,
          full_name,
          cpf: cleanCpf,
          phone: phone || null,
        }, { onConflict: 'user_id' });
      
      if (upsertError) {
        console.error("Profile upsert error:", upsertError);
      }
    } else {
      console.log("Profile updated successfully:", updatedProfile);
    }

    // Registrar log de auditoria manualmente com o ID do super admin que criou
    await supabaseAdmin
      .from("audit_logs")
      .insert({
        table_name: "user_roles",
        action: "INSERT",
        record_id: userId,
        new_data: { 
          action: "create_sindico",
          created_user_id: userId,
          created_user_email: email,
          created_user_name: full_name
        },
        user_id: requestingUser.id
      });

    console.log("Audit log created with user_id:", requestingUser.id);

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

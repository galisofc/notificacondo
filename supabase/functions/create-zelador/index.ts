import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  const perPage = 200;
  const maxPages = 50;

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("Error listing auth users:", error);
      return null;
    }

    const users = data?.users ?? [];
    const found = users.find((u: any) => (u.email ?? "").toLowerCase() === emailLower);
    if (found) return found;

    if (users.length < perPage) break;
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

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Authorization: must be owner of the condominium or super_admin
    const { data: condo, error: condoError } = await supabase
      .from("condominiums")
      .select("id, name, owner_id")
      .eq("id", condominium_id)
      .single();

    if (condoError || !condo) {
      return new Response(
        JSON.stringify({ error: "Condomínio não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (condo.owner_id !== user.id) {
      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!superAdminRole) {
        return new Response(
          JSON.stringify({ error: "Sem permissão para adicionar zeladores neste condomínio" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const emailLower = email.toLowerCase().trim();

    // Check existing user
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", emailLower)
      .maybeSingle();

    const existingAuthUser = await findAuthUserByEmail(supabase, emailLower);

    let userId: string;
    let password: string | null = null;
    let isNewUser = false;

    if (existingProfile) {
      userId = existingProfile.user_id;
    } else if (existingAuthUser) {
      userId = existingAuthUser.id;
    } else {
      userId = "";
    }

    if (existingProfile || existingAuthUser) {
      // Check for conflicting roles
      const { data: existingRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const roles = (existingRoles || []).map((r: { role: string }) => r.role);

      if (roles.includes("sindico") || roles.includes("super_admin") || roles.includes("porteiro")) {
        return new Response(
          JSON.stringify({ error: "Este e-mail pertence a um usuário com perfil incompatível e não pode ser cadastrado como zelador" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already linked to this condominium
      const { data: existingLink } = await supabase
        .from("user_condominiums")
        .select("id")
        .eq("user_id", userId)
        .eq("condominium_id", condominium_id)
        .maybeSingle();

      if (existingLink) {
        return new Response(
          JSON.stringify({ error: "Este usuário já é zelador deste condomínio" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add zelador role if not present
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "zelador")
        .maybeSingle();

      if (!existingRole) {
        await supabase.from("user_roles").upsert(
          { user_id: userId, role: "zelador" },
          { onConflict: "user_id,role" }
        );
      }

      // Create profile if missing
      if (!existingProfile && existingAuthUser) {
        await supabase.from("profiles").insert({
          user_id: userId,
          email: emailLower,
          full_name,
          phone: phone || null,
        });
      }
    } else {
      // Create new user
      password = generatePassword();
      isNewUser = true;

      const { data: authData, error: createError } = await supabase.auth.admin.createUser({
        email: emailLower,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          role: "zelador",
          skip_role_assignment: "true",
        },
      });

      if (createError || !authData.user) {
        return new Response(
          JSON.stringify({ error: createError?.message || "Erro ao criar usuário" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = authData.user.id;

      const profileData: Record<string, string> = { full_name };
      if (phone) profileData.phone = phone;

      await supabase.from("profiles").update(profileData).eq("user_id", userId);

      await supabase.from("user_roles").upsert(
        { user_id: userId, role: "zelador" },
        { onConflict: "user_id,role" }
      );
    }

    // Link to condominium
    const { error: linkError } = await supabase.from("user_condominiums").insert({
      user_id: userId,
      condominium_id,
    });

    if (linkError) {
      return new Response(
        JSON.stringify({ error: "Erro ao vincular zelador ao condomínio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        is_new_user: isNewUser,
        password: isNewUser ? password : undefined,
        message: isNewUser ? "Zelador criado com sucesso" : "Zelador vinculado ao condomínio",
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

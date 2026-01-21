import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    const { porter_user_id, full_name, email, phone } = body;

    if (!porter_user_id || !full_name) {
      return new Response(
        JSON.stringify({ error: "ID do porteiro e nome são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== AUTHORIZATION ==========
    // Get porter's condominiums
    const { data: porterCondos, error: porterCondosError } = await supabase
      .from("user_condominiums")
      .select("condominium_id")
      .eq("user_id", porter_user_id);

    if (porterCondosError || !porterCondos?.length) {
      console.error("Porter condominiums not found:", porterCondosError);
      return new Response(
        JSON.stringify({ error: "Porteiro não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const porterCondoIds = porterCondos.map(c => c.condominium_id);

    // Check if user owns at least one of the porter's condominiums or is super_admin
    const { data: ownedCondos } = await supabase
      .from("condominiums")
      .select("id")
      .in("id", porterCondoIds)
      .eq("owner_id", user.id);

    let isAuthorized = (ownedCondos && ownedCondos.length > 0);

    if (!isAuthorized) {
      // Check if super_admin
      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      isAuthorized = !!superAdminRole;
    }

    if (!isAuthorized) {
      console.error(`User ${user.id} is not authorized to update this porter`);
      return new Response(
        JSON.stringify({ error: "Sem permissão para editar este porteiro" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authorization passed for user ${user.id}`);

    // ========== CHECK EMAIL AVAILABILITY (if changing) ==========
    const emailLower = email?.toLowerCase().trim();

    if (emailLower) {
      // Get porter's current email
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", porter_user_id)
        .single();

      const currentEmail = currentProfile?.email?.toLowerCase();

      if (emailLower !== currentEmail) {
        console.log(`Email change requested: ${currentEmail} -> ${emailLower}`);

        // Check if new email is already used
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("email", emailLower)
          .neq("user_id", porter_user_id)
          .maybeSingle();

        if (existingProfile) {
          return new Response(
            JSON.stringify({ error: "Este e-mail já está em uso por outro usuário" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if new email belongs to sindico or super_admin
        const { data: conflictingRoles } = await supabase
          .from("profiles")
          .select(`
            user_id,
            user_roles!inner(role)
          `)
          .eq("email", emailLower);

        if (conflictingRoles && conflictingRoles.length > 0) {
          const hasConflict = conflictingRoles.some((p: any) => 
            p.user_roles?.some((r: any) => r.role === "sindico" || r.role === "super_admin")
          );
          
          if (hasConflict) {
            return new Response(
              JSON.stringify({ error: "Este e-mail pertence a um síndico ou administrador" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        // Update email in Auth (this is why we need the edge function)
        const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
          porter_user_id,
          { email: emailLower }
        );

        if (authUpdateError) {
          console.error("Error updating auth email:", authUpdateError);
          return new Response(
            JSON.stringify({ error: "Erro ao atualizar e-mail de autenticação" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Auth email updated for user ${porter_user_id}`);
      }
    }

    // ========== UPDATE PROFILE ==========
    const updateData: Record<string, string | null> = {
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
    };

    if (emailLower) {
      updateData.email = emailLower;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("user_id", porter_user_id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar perfil" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Profile updated for user ${porter_user_id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Porteiro atualizado com sucesso"
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

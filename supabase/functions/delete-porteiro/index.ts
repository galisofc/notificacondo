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

    const { user_condominium_id, porter_user_id } = body;

    if (!user_condominium_id || !porter_user_id) {
      return new Response(
        JSON.stringify({ error: "user_condominium_id e porter_user_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Request to delete porter ${porter_user_id} from user_condominium ${user_condominium_id}`);

    // ========== AUTHORIZATION ==========
    // Get the user_condominium record to verify ownership
    const { data: userCondo, error: userCondoError } = await supabase
      .from("user_condominiums")
      .select("id, user_id, condominium_id")
      .eq("id", user_condominium_id)
      .single();

    if (userCondoError || !userCondo) {
      console.error("User condominium not found:", userCondoError);
      return new Response(
        JSON.stringify({ error: "Vínculo não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the requesting user owns the condominium
    const { data: condo, error: condoError } = await supabase
      .from("condominiums")
      .select("id, name, owner_id")
      .eq("id", userCondo.condominium_id)
      .single();

    if (condoError || !condo) {
      console.error("Condominium not found:", condoError);
      return new Response(
        JSON.stringify({ error: "Condomínio não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (condo.owner_id !== user.id) {
      // Check if super_admin
      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!superAdminRole) {
        console.error(`User ${user.id} is not owner of condominium`);
        return new Response(
          JSON.stringify({ error: "Sem permissão para remover porteiros deste condomínio" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`Authorization passed for user ${user.id} on condominium ${condo.name}`);

    // ========== DELETE USER_CONDOMINIUM ==========
    const { error: deleteCondoError } = await supabase
      .from("user_condominiums")
      .delete()
      .eq("id", user_condominium_id);

    if (deleteCondoError) {
      console.error("Error deleting user_condominium:", deleteCondoError);
      return new Response(
        JSON.stringify({ error: "Erro ao desvincular porteiro do condomínio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Deleted user_condominium ${user_condominium_id}`);

    // ========== CHECK IF PORTER HAS OTHER CONDOMINIUMS ==========
    const { data: otherCondos } = await supabase
      .from("user_condominiums")
      .select("id")
      .eq("user_id", porter_user_id);

    if (otherCondos && otherCondos.length > 0) {
      console.log(`Porter ${porter_user_id} still has ${otherCondos.length} other condominium(s), keeping user`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Porteiro removido do condomínio",
          user_deleted: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Porter ${porter_user_id} has no other condominiums, proceeding with full deletion`);

    // ========== DELETE PORTEIRO ROLE ==========
    const { error: deleteRoleError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", porter_user_id)
      .eq("role", "porteiro");

    if (deleteRoleError) {
      console.error("Error deleting porteiro role:", deleteRoleError);
      // Continue anyway, not critical
    } else {
      console.log(`Deleted porteiro role for user ${porter_user_id}`);
    }

    // ========== DELETE PROFILE ==========
    const { error: deleteProfileError } = await supabase
      .from("profiles")
      .delete()
      .eq("user_id", porter_user_id);

    if (deleteProfileError) {
      console.error("Error deleting profile:", deleteProfileError);
      // Continue anyway, not critical
    } else {
      console.log(`Deleted profile for user ${porter_user_id}`);
    }

    // ========== DELETE AUTH USER ==========
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(porter_user_id);

    if (deleteAuthError) {
      console.error("Error deleting auth user:", deleteAuthError);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Porteiro removido, mas houve erro ao excluir conta de acesso",
          user_deleted: false,
          error_detail: deleteAuthError.message,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Deleted auth user ${porter_user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Porteiro excluído completamente do sistema",
        user_deleted: true,
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

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

    const { user_condominium_id, zelador_user_id } = body;

    if (!user_condominium_id || !zelador_user_id) {
      return new Response(
        JSON.stringify({ error: "user_condominium_id e zelador_user_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user_condominium record
    const { data: userCondo, error: userCondoError } = await supabase
      .from("user_condominiums")
      .select("id, user_id, condominium_id")
      .eq("id", user_condominium_id)
      .single();

    if (userCondoError || !userCondo) {
      return new Response(
        JSON.stringify({ error: "Vínculo não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth: must be owner or super_admin
    const { data: condo } = await supabase
      .from("condominiums")
      .select("id, name, owner_id")
      .eq("id", userCondo.condominium_id)
      .single();

    if (!condo) {
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
          JSON.stringify({ error: "Sem permissão para remover zeladores deste condomínio" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Delete user_condominium link
    await supabase.from("user_condominiums").delete().eq("id", user_condominium_id);

    // Check if zelador has other condominiums
    const { data: otherCondos } = await supabase
      .from("user_condominiums")
      .select("id")
      .eq("user_id", zelador_user_id);

    if (otherCondos && otherCondos.length > 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Zelador removido do condomínio", user_deleted: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No more condominiums - full cleanup
    await supabase.from("user_roles").delete().eq("user_id", zelador_user_id).eq("role", "zelador");
    await supabase.from("profiles").delete().eq("user_id", zelador_user_id);
    
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(zelador_user_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: deleteAuthError ? "Zelador removido, mas houve erro ao excluir conta" : "Zelador excluído completamente",
        user_deleted: !deleteAuthError,
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

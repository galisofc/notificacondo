import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get authorization header to verify the requester is a super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is super_admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "super_admin")
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Apenas super admins podem excluir síndicos" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Definir o ID do usuário que está fazendo a ação para auditoria
    console.log("Setting user context for audit:", requestingUser.id);

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "ID do usuário é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the sindico has condominiums
    const { data: condominiums } = await supabaseAdmin
      .from("condominiums")
      .select("id")
      .eq("owner_id", user_id);

    if (condominiums && condominiums.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Este síndico possui condomínios vinculados. Remova os condomínios antes de excluir o síndico." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar informações do síndico antes de excluir para o log
    const { data: sindicoProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user_id)
      .maybeSingle();

    // Delete user role
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", user_id);

    // Delete profile
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", user_id);

    // Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return new Response(
        JSON.stringify({ success: false, error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Registrar log de auditoria manualmente com o ID do super admin que excluiu
    await supabaseAdmin
      .from("audit_logs")
      .insert({
        table_name: "user_roles",
        action: "DELETE",
        record_id: user_id,
        old_data: { 
          action: "delete_sindico",
          deleted_user_id: user_id,
          deleted_user_email: sindicoProfile?.email || "unknown",
          deleted_user_name: sindicoProfile?.full_name || "unknown"
        },
        user_id: requestingUser.id
      });

    console.log("Audit log created with user_id:", requestingUser.id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

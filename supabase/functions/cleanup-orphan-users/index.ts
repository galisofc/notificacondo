import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrphanUser {
  id: string;
  email: string | null;
  created_at: string;
  has_profile: boolean;
  has_role: boolean;
  has_condominium: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    
    // Check for service key header for internal/admin calls
    const serviceKeyHeader = req.headers.get("x-service-key");
    const isServiceCall = serviceKeyHeader === supabaseServiceKey;

    if (!isServiceCall) {
      // Get authorization header for user calls
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify the user
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Token inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user is sindico or super_admin
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roles = userRoles?.map(r => r.role) || [];
      const isAuthorized = roles.includes("super_admin") || roles.includes("sindico");

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({ error: "Acesso negado. Apenas síndicos e super admins podem executar esta ação." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[cleanup-orphan-users] Authorized user call from: ${user.id}`);
    } else {
      console.log("[cleanup-orphan-users] Service key call - authorized");
    }
    const action = body.action || "list"; // "list" or "delete"
    const userIdsToDelete = body.user_ids || []; // Array of user IDs to delete

    console.log(`[cleanup-orphan-users] Action: ${action}`);

    if (action === "delete" && userIdsToDelete.length > 0) {
      // Delete specific orphan users
      const deleted: string[] = [];
      const errors: { id: string; error: string }[] = [];

      for (const userId of userIdsToDelete) {
        try {
          // Double-check this is actually an orphan before deleting
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          const { data: role } = await supabase
            .from("user_roles")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          const { data: condoLink } = await supabase
            .from("user_condominiums")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          // Only delete if truly orphan (no profile AND no role AND no condominium)
          if (!profile && !role && !condoLink) {
            const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
            
            if (deleteError) {
              console.error(`Error deleting user ${userId}:`, deleteError);
              errors.push({ id: userId, error: deleteError.message });
            } else {
              console.log(`Successfully deleted orphan user: ${userId}`);
              deleted.push(userId);
            }
          } else {
            errors.push({ id: userId, error: "Usuário não é órfão (tem perfil, role ou vínculo com condomínio)" });
          }
        } catch (err: any) {
          console.error(`Error processing user ${userId}:`, err);
          errors.push({ id: userId, error: err.message });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          deleted,
          errors,
          message: `${deleted.length} usuário(s) órfão(s) removido(s)`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default action: list orphan users
    console.log("[cleanup-orphan-users] Scanning for orphan users...");

    // Get all auth users (paginated)
    const allAuthUsers: any[] = [];
    const perPage = 200;
    let page = 1;
    const maxPages = 50;

    while (page <= maxPages) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error("Error listing auth users:", error);
        break;
      }
      
      const users = data?.users ?? [];
      allAuthUsers.push(...users);
      
      if (users.length < perPage) break;
      page++;
    }

    console.log(`[cleanup-orphan-users] Found ${allAuthUsers.length} total auth users`);

    // Get all user_ids that have profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id");
    const profileUserIds = new Set(profiles?.map(p => p.user_id) || []);

    // Get all user_ids that have roles
    const { data: userRolesAll } = await supabase
      .from("user_roles")
      .select("user_id");
    const roleUserIds = new Set(userRolesAll?.map(r => r.user_id) || []);

    // Get all user_ids that have condominium links
    const { data: condoLinks } = await supabase
      .from("user_condominiums")
      .select("user_id");
    const condoUserIds = new Set(condoLinks?.map(c => c.user_id) || []);

    // Find orphans: users without profile AND without role
    const orphanUsers: OrphanUser[] = [];

    for (const authUser of allAuthUsers) {
      const hasProfile = profileUserIds.has(authUser.id);
      const hasRole = roleUserIds.has(authUser.id);
      const hasCondominium = condoUserIds.has(authUser.id);

      // Consider orphan if has NO profile AND NO role
      if (!hasProfile && !hasRole) {
        orphanUsers.push({
          id: authUser.id,
          email: authUser.email || null,
          created_at: authUser.created_at,
          has_profile: hasProfile,
          has_role: hasRole,
          has_condominium: hasCondominium,
        });
      }
    }

    console.log(`[cleanup-orphan-users] Found ${orphanUsers.length} orphan users`);

    return new Response(
      JSON.stringify({
        success: true,
        orphan_users: orphanUsers,
        total_auth_users: allAuthUsers.length,
        total_orphans: orphanUsers.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[cleanup-orphan-users] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

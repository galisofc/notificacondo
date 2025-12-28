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
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Apenas super admins podem excluir síndicos" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Super admin verified:", requestingUser.id);

    const { user_id, force_delete } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "ID do usuário é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent deleting yourself
    if (user_id === requestingUser.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Não é possível excluir seu próprio usuário" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if target user is a super_admin
    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .maybeSingle();

    if (targetRole?.role === "super_admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Não é possível excluir um super admin" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar informações do síndico antes de excluir para o log
    const { data: sindicoProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user_id)
      .maybeSingle();

    console.log(`Deleting sindico: ${sindicoProfile?.full_name || user_id}`);

    // Get condominiums owned by this sindico
    const { data: condominiums } = await supabaseAdmin
      .from("condominiums")
      .select("id, name")
      .eq("owner_id", user_id);

    const condoCount = condominiums?.length || 0;
    console.log(`Found ${condoCount} condominiums to delete`);

    // Delete all related data in cascade order
    if (condominiums && condominiums.length > 0) {
      const condoIds = condominiums.map(c => c.id);

      // 1. Delete invoices
      await supabaseAdmin.from("invoices").delete().in("condominium_id", condoIds);
      console.log("Deleted invoices");

      // 2. Delete subscriptions
      await supabaseAdmin.from("subscriptions").delete().in("condominium_id", condoIds);
      console.log("Deleted subscriptions");

      // 3. Get blocks and their apartments
      const { data: blocks } = await supabaseAdmin
        .from("blocks")
        .select("id")
        .in("condominium_id", condoIds);

      if (blocks && blocks.length > 0) {
        const blockIds = blocks.map(b => b.id);

        const { data: apartments } = await supabaseAdmin
          .from("apartments")
          .select("id")
          .in("block_id", blockIds);

        if (apartments && apartments.length > 0) {
          const apartmentIds = apartments.map(a => a.id);

          // Get residents
          const { data: residents } = await supabaseAdmin
            .from("residents")
            .select("id")
            .in("apartment_id", apartmentIds);

          if (residents && residents.length > 0) {
            const residentIds = residents.map(r => r.id);

            // Delete defenses and attachments
            const { data: defenses } = await supabaseAdmin
              .from("defenses")
              .select("id")
              .in("resident_id", residentIds);

            if (defenses && defenses.length > 0) {
              const defenseIds = defenses.map(d => d.id);
              await supabaseAdmin.from("defense_attachments").delete().in("defense_id", defenseIds);
              await supabaseAdmin.from("defenses").delete().in("id", defenseIds);
            }

            // Delete fines
            await supabaseAdmin.from("fines").delete().in("resident_id", residentIds);

            // Delete notifications_sent
            await supabaseAdmin.from("notifications_sent").delete().in("resident_id", residentIds);
          }

          // Delete residents
          await supabaseAdmin.from("residents").delete().in("apartment_id", apartmentIds);
          console.log("Deleted residents");
        }

        // Delete apartments
        await supabaseAdmin.from("apartments").delete().in("block_id", blockIds);
        console.log("Deleted apartments");
      }

      // 4. Get and delete occurrences with related data
      const { data: occurrences } = await supabaseAdmin
        .from("occurrences")
        .select("id")
        .in("condominium_id", condoIds);

      if (occurrences && occurrences.length > 0) {
        const occurrenceIds = occurrences.map(o => o.id);

        // Delete occurrence evidences
        await supabaseAdmin.from("occurrence_evidences").delete().in("occurrence_id", occurrenceIds);

        // Delete decisions
        await supabaseAdmin.from("decisions").delete().in("occurrence_id", occurrenceIds);

        // Delete occurrences
        await supabaseAdmin.from("occurrences").delete().in("id", occurrenceIds);
        console.log("Deleted occurrences");
      }

      // 5. Delete blocks
      await supabaseAdmin.from("blocks").delete().in("condominium_id", condoIds);
      console.log("Deleted blocks");

      // 6. Delete condominium transfers
      await supabaseAdmin.from("condominium_transfers").delete().in("condominium_id", condoIds);

      // 7. Delete condominiums
      await supabaseAdmin.from("condominiums").delete().in("id", condoIds);
      console.log("Deleted condominiums");
    }

    // Delete user role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    console.log("Deleted user_roles");

    // Delete profile
    await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);
    console.log("Deleted profile");

    // Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao excluir usuário: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Deleted auth user");

    // Registrar log de auditoria
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
          deleted_user_name: sindicoProfile?.full_name || "unknown",
          deleted_condominiums: condoCount
        },
        user_id: requestingUser.id
      });

    console.log(`Successfully deleted sindico and ${condoCount} condominiums`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Síndico excluído com sucesso. ${condoCount} condomínio(s) removido(s).`,
        deleted_condominiums: condoCount
      }),
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

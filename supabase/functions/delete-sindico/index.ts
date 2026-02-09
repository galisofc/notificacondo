import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getDeletePreview(supabaseAdmin: any, userId: string) {
  const { data: condominiums } = await supabaseAdmin
    .from("condominiums")
    .select("id")
    .eq("owner_id", userId);

  const condoIds = condominiums?.map((c: any) => c.id) || [];
  let blocksCount = 0;
  let apartmentsCount = 0;
  let residentsCount = 0;
  let portersCount = 0;
  let occurrencesCount = 0;

  if (condoIds.length > 0) {
    // Count blocks
    const { count: blocks } = await supabaseAdmin
      .from("blocks")
      .select("*", { count: "exact", head: true })
      .in("condominium_id", condoIds);
    blocksCount = blocks || 0;

    // Get block IDs for apartment counting
    const { data: blocksData } = await supabaseAdmin
      .from("blocks")
      .select("id")
      .in("condominium_id", condoIds);
    const blockIds = blocksData?.map((b: any) => b.id) || [];

    if (blockIds.length > 0) {
      const { count: apartments } = await supabaseAdmin
        .from("apartments")
        .select("*", { count: "exact", head: true })
        .in("block_id", blockIds);
      apartmentsCount = apartments || 0;

      const { data: apartmentsData } = await supabaseAdmin
        .from("apartments")
        .select("id")
        .in("block_id", blockIds);
      const apartmentIds = apartmentsData?.map((a: any) => a.id) || [];

      if (apartmentIds.length > 0) {
        const { count: residents } = await supabaseAdmin
          .from("residents")
          .select("*", { count: "exact", head: true })
          .in("apartment_id", apartmentIds);
        residentsCount = residents || 0;
      }
    }

    // Count porters (users linked to these condominiums with porteiro role)
    const { data: porterLinks } = await supabaseAdmin
      .from("user_condominiums")
      .select("user_id")
      .in("condominium_id", condoIds);

    if (porterLinks && porterLinks.length > 0) {
      const porterUserIds = [...new Set(porterLinks.map((p: any) => p.user_id))];
      // Filter to only those with porteiro role
      const { count: porters } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .in("user_id", porterUserIds)
        .eq("role", "porteiro");
      portersCount = porters || 0;
    }

    // Count occurrences
    const { count: occurrences } = await supabaseAdmin
      .from("occurrences")
      .select("*", { count: "exact", head: true })
      .in("condominium_id", condoIds);
    occurrencesCount = occurrences || 0;
  }

  return {
    condominiums: condoIds.length,
    blocks: blocksCount,
    apartments: apartmentsCount,
    residents: residentsCount,
    porters: portersCount,
    occurrences: occurrencesCount,
  };
}

async function deletePortersForCondominiums(supabaseAdmin: any, condoIds: string[]) {
  // Find all porter user_condominiums for these condominiums
  const { data: porterLinks } = await supabaseAdmin
    .from("user_condominiums")
    .select("id, user_id")
    .in("condominium_id", condoIds);

  if (!porterLinks || porterLinks.length === 0) return;

  const porterUserIds = [...new Set(porterLinks.map((p: any) => p.user_id))];

  // Filter to only porteiro role users
  const { data: porterRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("user_id", porterUserIds)
    .eq("role", "porteiro");

  if (!porterRoles || porterRoles.length === 0) return;

  const confirmedPorterIds = porterRoles.map((r: any) => r.user_id);

  // Delete user_condominiums for these condominiums
  await supabaseAdmin
    .from("user_condominiums")
    .delete()
    .in("condominium_id", condoIds);
  console.log("Deleted porter user_condominiums");

  // For each porter, check if they still have other condominiums
  for (const porterId of confirmedPorterIds) {
    const { data: otherLinks } = await supabaseAdmin
      .from("user_condominiums")
      .select("id")
      .eq("user_id", porterId);

    if (otherLinks && otherLinks.length > 0) {
      console.log(`Porter ${porterId} still has ${otherLinks.length} other condo(s), keeping`);
      continue;
    }

    // No other condominiums - fully delete the porter
    console.log(`Fully deleting porter ${porterId}`);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", porterId).eq("role", "porteiro");
    await supabaseAdmin.from("profiles").delete().eq("user_id", porterId);
    
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(porterId);
    if (authErr) {
      console.error(`Error deleting porter auth user ${porterId}:`, authErr);
    } else {
      console.log(`Deleted porter auth user ${porterId}`);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Auth check
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

    // Check super_admin
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

    const { user_id, preview_only } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "ID do usuário é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Preview mode - just return counts
    if (preview_only) {
      const preview = await getDeletePreview(supabaseAdmin, user_id);
      return new Response(
        JSON.stringify({ success: true, preview }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent deleting yourself
    if (user_id === requestingUser.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Não é possível excluir seu próprio usuário" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if target is super_admin
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

    const { data: sindicoProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user_id)
      .maybeSingle();

    console.log(`Deleting sindico: ${sindicoProfile?.full_name || user_id}`);

    const { data: condominiums } = await supabaseAdmin
      .from("condominiums")
      .select("id, name")
      .eq("owner_id", user_id);

    const condoCount = condominiums?.length || 0;

    if (condominiums && condominiums.length > 0) {
      const condoIds = condominiums.map((c: any) => c.id);

      // 0. Delete porters
      await deletePortersForCondominiums(supabaseAdmin, condoIds);

      // 1. Delete packages
      await supabaseAdmin.from("packages").delete().in("condominium_id", condoIds);
      console.log("Deleted packages");

      // 2. Delete invoices
      await supabaseAdmin.from("invoices").delete().in("condominium_id", condoIds);

      // 3. Delete subscriptions
      await supabaseAdmin.from("subscriptions").delete().in("condominium_id", condoIds);

      // 4. Get blocks and apartments
      const { data: blocks } = await supabaseAdmin
        .from("blocks")
        .select("id")
        .in("condominium_id", condoIds);

      if (blocks && blocks.length > 0) {
        const blockIds = blocks.map((b: any) => b.id);

        const { data: apartments } = await supabaseAdmin
          .from("apartments")
          .select("id")
          .in("block_id", blockIds);

        if (apartments && apartments.length > 0) {
          const apartmentIds = apartments.map((a: any) => a.id);

          const { data: residents } = await supabaseAdmin
            .from("residents")
            .select("id")
            .in("apartment_id", apartmentIds);

          if (residents && residents.length > 0) {
            const residentIds = residents.map((r: any) => r.id);

            const { data: defenses } = await supabaseAdmin
              .from("defenses")
              .select("id")
              .in("resident_id", residentIds);

            if (defenses && defenses.length > 0) {
              const defenseIds = defenses.map((d: any) => d.id);
              await supabaseAdmin.from("defense_attachments").delete().in("defense_id", defenseIds);
              await supabaseAdmin.from("defenses").delete().in("id", defenseIds);
            }

            await supabaseAdmin.from("fines").delete().in("resident_id", residentIds);
            await supabaseAdmin.from("notifications_sent").delete().in("resident_id", residentIds);
          }

          await supabaseAdmin.from("residents").delete().in("apartment_id", apartmentIds);
        }

        await supabaseAdmin.from("apartments").delete().in("block_id", blockIds);
      }

      // 5. Occurrences
      const { data: occurrences } = await supabaseAdmin
        .from("occurrences")
        .select("id")
        .in("condominium_id", condoIds);

      if (occurrences && occurrences.length > 0) {
        const occurrenceIds = occurrences.map((o: any) => o.id);
        await supabaseAdmin.from("occurrence_evidences").delete().in("occurrence_id", occurrenceIds);
        await supabaseAdmin.from("decisions").delete().in("occurrence_id", occurrenceIds);
        await supabaseAdmin.from("occurrences").delete().in("id", occurrenceIds);
      }

      // 6. Blocks
      await supabaseAdmin.from("blocks").delete().in("condominium_id", condoIds);

      // 7. WhatsApp logs
      await supabaseAdmin.from("whatsapp_notification_logs").delete().in("condominium_id", condoIds);

      // 8. Party hall data
      await supabaseAdmin.from("party_hall_notifications").delete().in("condominium_id", condoIds);

      const { data: bookings } = await supabaseAdmin
        .from("party_hall_bookings")
        .select("id")
        .in("condominium_id", condoIds);

      if (bookings && bookings.length > 0) {
        const bookingIds = bookings.map((b: any) => b.id);
        const { data: checklists } = await supabaseAdmin
          .from("party_hall_checklists")
          .select("id")
          .in("booking_id", bookingIds);

        if (checklists && checklists.length > 0) {
          const checklistIds = checklists.map((c: any) => c.id);
          await supabaseAdmin.from("party_hall_checklist_items").delete().in("checklist_id", checklistIds);
          await supabaseAdmin.from("party_hall_checklists").delete().in("booking_id", bookingIds);
        }

        await supabaseAdmin.from("party_hall_bookings").delete().in("condominium_id", condoIds);
      }

      await supabaseAdmin.from("party_hall_settings").delete().in("condominium_id", condoIds);
      await supabaseAdmin.from("party_hall_checklist_templates").delete().in("condominium_id", condoIds);

      // 9. Templates & transfers
      await supabaseAdmin.from("condominium_whatsapp_templates").delete().in("condominium_id", condoIds);
      await supabaseAdmin.from("condominium_transfers").delete().in("condominium_id", condoIds);

      // 10. Condominiums
      await supabaseAdmin.from("condominiums").delete().in("id", condoIds);
      console.log("Deleted condominiums");
    }

    // Delete sindico role, profile, auth user
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
    await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao excluir usuário: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabaseAdmin.from("audit_logs").insert({
      table_name: "user_roles",
      action: "DELETE",
      record_id: user_id,
      old_data: {
        action: "delete_sindico",
        deleted_user_id: user_id,
        deleted_user_email: sindicoProfile?.email || "unknown",
        deleted_user_name: sindicoProfile?.full_name || "unknown",
        deleted_condominiums: condoCount,
      },
      user_id: requestingUser.id,
    });

    console.log(`Successfully deleted sindico and ${condoCount} condominiums`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Síndico excluído com sucesso. ${condoCount} condomínio(s) removido(s).`,
        deleted_condominiums: condoCount,
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

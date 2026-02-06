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
    // Auth check - only super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;

    // Check super_admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), { status: 403, headers: corsHeaders });
    }

    const escapeStr = (val: unknown): string => {
      if (val === null || val === undefined) return "NULL";
      if (typeof val === "boolean") return val ? "true" : "false";
      if (typeof val === "number") return String(val);
      if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
      return `'${String(val).replace(/'/g, "''")}'`;
    };

    const generateInserts = (tableName: string, rows: any[]): string => {
      if (!rows || rows.length === 0) return `-- No data in ${tableName}\n`;
      const columns = Object.keys(rows[0]);
      const colList = columns.join(", ");
      const inserts = rows.map((row) => {
        const values = columns.map((col) => escapeStr(row[col])).join(", ");
        return `INSERT INTO public.${tableName} (${colList}) VALUES (${values});`;
      });
      return `-- ${tableName} (${rows.length} rows)\n${inserts.join("\n")}\n`;
    };

    // Fetch all tables in dependency order
    const tables = [
      "plans",
      "app_settings",
      "package_types",
      "condominiums",
      "blocks",
      "apartments",
      "residents",
      "profiles",
      "user_roles",
      "user_condominiums",
      "subscriptions",
      "whatsapp_templates",
      "cron_job_controls",
      "party_hall_settings",
      "occurrences",
      "occurrence_evidences",
      "defenses",
      "defense_attachments",
      "decisions",
      "notifications_sent",
      "magic_link_access_logs",
      "party_hall_bookings",
      "party_hall_checklists",
      "party_hall_checklist_items",
      "party_hall_checklist_templates",
      "party_hall_notifications",
      "packages",
      "whatsapp_notification_logs",
      "invoices",
      "mercadopago_config",
      "mercadopago_webhook_logs",
      "edge_function_logs",
      "audit_logs",
      "password_recovery_attempts",
      "contact_messages",
    ];

    const scripts: Record<string, string> = {};
    const summary: Record<string, number> = {};

    for (const table of tables) {
      try {
        // Use count first
        const { count } = await supabaseAdmin
          .from(table)
          .select("*", { count: "exact", head: true });

        const totalCount = count || 0;
        summary[table] = totalCount;

        if (totalCount === 0) {
          scripts[table] = `-- No data in ${table}\n`;
          continue;
        }

        // Fetch in batches of 500
        let allRows: any[] = [];
        let offset = 0;
        const batchSize = 500;

        while (offset < totalCount) {
          const { data, error } = await supabaseAdmin
            .from(table)
            .select("*")
            .range(offset, offset + batchSize - 1);

          if (error) {
            scripts[table] = `-- ERROR fetching ${table}: ${error.message}\n`;
            break;
          }

          if (data) allRows = allRows.concat(data);
          offset += batchSize;
        }

        scripts[table] = generateInserts(table, allRows);
      } catch (err: any) {
        scripts[table] = `-- ERROR: ${err.message}\n`;
        summary[table] = -1;
      }
    }

    // Generate ENUM types
    const enumScript = `
-- ============================================
-- STEP 1: CREATE ENUM TYPES
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin', 'sindico', 'porteiro', 'morador');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.occurrence_status AS ENUM ('registrada', 'notificada', 'em_defesa', 'em_analise', 'decidida');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.occurrence_type AS ENUM ('notificacao', 'advertencia', 'multa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.decision_type AS ENUM ('arquivado', 'advertencia', 'multa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.package_status AS ENUM ('pendente', 'retirada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_type AS ENUM ('start', 'essencial', 'profissional', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;

    // Users info
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    const usersInfo = (usersData?.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      full_name: u.user_metadata?.full_name,
      phone: u.user_metadata?.phone,
      created_at: u.created_at,
    }));

    const usersScript = `
-- ============================================
-- USERS TO RECREATE (passwords cannot be exported)
-- Create these users manually in your new server's Auth section
-- ============================================
${usersInfo.map((u) => `-- User: ${u.email} | ID: ${u.id} | Name: ${u.full_name || "N/A"} | Phone: ${u.phone || "N/A"}`).join("\n")}
`;

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        users: usersInfo,
        execution_order: tables,
        scripts: {
          "00_enums": enumScript,
          "01_users_info": usersScript,
          ...Object.fromEntries(
            tables.map((t, i) => [`${String(i + 2).padStart(2, "0")}_${t}`, scripts[t]])
          ),
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

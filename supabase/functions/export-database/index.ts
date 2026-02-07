import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables ordered by foreign key dependencies (parents first)
const TABLE_ORDER = [
  "plans",
  "app_settings",
  "package_types",
  "whatsapp_config",
  "whatsapp_templates",
  "mercadopago_config",
  "password_recovery_attempts",
  "cron_job_controls",
  "condominiums",
  "contact_messages",
  "condominium_transfers",
  "user_roles",
  "user_condominiums",
  "profiles",
  "blocks",
  "subscriptions",
  "invoices",
  "apartments",
  "residents",
  "occurrences",
  "occurrence_evidences",
  "notifications_sent",
  "defenses",
  "defense_attachments",
  "decisions",
  "fines",
  "magic_link_access_logs",
  "packages",
  "party_hall_settings",
  "party_hall_bookings",
  "party_hall_checklists",
  "party_hall_checklist_items",
  "party_hall_checklist_templates",
  "party_hall_notifications",
  "condominium_whatsapp_templates",
  "whatsapp_notification_logs",
  "mercadopago_webhook_logs",
  "audit_logs",
  "edge_function_logs",
];

function escapeValue(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    // JSON/arrays
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  // string
  const escaped = String(val).replace(/'/g, "''");
  return `'${escaped}'`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user is super_admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body for optional section filter
    let section = "all";
    try {
      const body = await req.json();
      if (body.section) section = body.section;
    } catch {
      // no body = export all
    }

    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return new Response(
        JSON.stringify({ error: "SUPABASE_DB_URL não configurada" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use pg module for direct SQL queries
    const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const pool = new Pool(dbUrl, 3, true);
    const conn = await pool.connect();

    const scripts: Record<string, string> = {};

    try {
      // ===== 1. ENUM TYPES =====
      if (section === "all" || section === "schema") {
        const enumsResult = await conn.queryObject<{
          typname: string;
          enumlabel: string;
        }>(`
          SELECT t.typname, e.enumlabel
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          JOIN pg_namespace n ON t.typnamespace = n.oid
          WHERE n.nspname = 'public'
          ORDER BY t.typname, e.enumsortorder
        `);

        const enumMap: Record<string, string[]> = {};
        for (const row of enumsResult.rows) {
          if (!enumMap[row.typname]) enumMap[row.typname] = [];
          enumMap[row.typname].push(row.enumlabel);
        }

        let enumSql = "-- =====================\n-- ENUM TYPES\n-- =====================\n\n";
        for (const [name, labels] of Object.entries(enumMap)) {
          enumSql += `DO $$ BEGIN\n  CREATE TYPE public.${name} AS ENUM (${labels.map((l) => `'${l}'`).join(", ")});\nEXCEPTION WHEN duplicate_object THEN null;\nEND $$;\n\n`;
        }
        scripts.enums = enumSql;
      }

      // ===== 2. TABLE DEFINITIONS =====
      if (section === "all" || section === "schema") {
        const tablesResult = await conn.queryObject<{
          table_name: string;
          column_name: string;
          data_type: string;
          udt_name: string;
          is_nullable: string;
          column_default: string | null;
          character_maximum_length: number | null;
        }>(`
          SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position
        `);

        const tableColumns: Record<string, typeof tablesResult.rows> = {};
        for (const row of tablesResult.rows) {
          if (!tableColumns[row.table_name]) tableColumns[row.table_name] = [];
          tableColumns[row.table_name].push(row);
        }

        // Get primary keys
        const pkResult = await conn.queryObject<{
          table_name: string;
          column_name: string;
        }>(`
          SELECT tc.table_name, kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
        `);

        const pkMap: Record<string, string[]> = {};
        for (const row of pkResult.rows) {
          if (!pkMap[row.table_name]) pkMap[row.table_name] = [];
          pkMap[row.table_name].push(row.column_name);
        }

        // Get foreign keys
        const fkResult = await conn.queryObject<{
          table_name: string;
          column_name: string;
          foreign_table: string;
          foreign_column: string;
          constraint_name: string;
        }>(`
          SELECT
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column,
            tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
        `);

        // Get unique constraints
        const uniqueResult = await conn.queryObject<{
          table_name: string;
          column_name: string;
          constraint_name: string;
        }>(`
          SELECT tc.table_name, kcu.column_name, tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = 'public' AND tc.constraint_type = 'UNIQUE'
        `);

        let tableSql = "-- =====================\n-- TABLE DEFINITIONS\n-- =====================\n\n";

        for (const tableName of TABLE_ORDER) {
          const cols = tableColumns[tableName];
          if (!cols) continue;

          tableSql += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
          const colDefs: string[] = [];

          for (const col of cols) {
            let colType = col.data_type === "USER-DEFINED" ? `public.${col.udt_name}` : col.data_type;
            if (col.data_type === "ARRAY") colType = `${col.udt_name.replace(/^_/, "")}[]`;
            if (col.data_type === "character varying" && col.character_maximum_length) {
              colType = `character varying(${col.character_maximum_length})`;
            }

            let def = `  ${col.column_name} ${colType}`;
            if (col.is_nullable === "NO") def += " NOT NULL";
            if (col.column_default) def += ` DEFAULT ${col.column_default}`;
            colDefs.push(def);
          }

          // Primary key
          const pks = pkMap[tableName];
          if (pks) {
            colDefs.push(`  PRIMARY KEY (${pks.join(", ")})`);
          }

          tableSql += colDefs.join(",\n") + "\n);\n\n";

          // Foreign keys
          const fks = fkResult.rows.filter((f) => f.table_name === tableName);
          for (const fk of fks) {
            tableSql += `ALTER TABLE public.${tableName} ADD CONSTRAINT ${fk.constraint_name} FOREIGN KEY (${fk.column_name}) REFERENCES public.${fk.foreign_table}(${fk.foreign_column});\n`;
          }

          // Unique constraints
          const uniqueMap: Record<string, string[]> = {};
          for (const u of uniqueResult.rows.filter((u) => u.table_name === tableName)) {
            if (!uniqueMap[u.constraint_name]) uniqueMap[u.constraint_name] = [];
            uniqueMap[u.constraint_name].push(u.column_name);
          }
          for (const [cName, uCols] of Object.entries(uniqueMap)) {
            tableSql += `ALTER TABLE public.${tableName} ADD CONSTRAINT ${cName} UNIQUE (${uCols.join(", ")});\n`;
          }

          tableSql += "\n";
        }

        scripts.tables = tableSql;
      }

      // ===== 3. FUNCTIONS & TRIGGERS =====
      if (section === "all" || section === "functions") {
        const funcsResult = await conn.queryObject<{
          function_def: string;
        }>(`
          SELECT pg_get_functiondef(p.oid) as function_def
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          ORDER BY p.proname
        `);

        let funcSql = "-- =====================\n-- FUNCTIONS\n-- =====================\n\n";
        for (const row of funcsResult.rows) {
          funcSql += `${row.function_def};\n\n`;
        }

        const triggersResult = await conn.queryObject<{
          trigger_def: string;
        }>(`
          SELECT pg_get_triggerdef(t.oid) as trigger_def
          FROM pg_trigger t
          JOIN pg_class c ON t.tgrelid = c.oid
          JOIN pg_namespace n ON c.relnamespace = n.oid
          WHERE n.nspname = 'public'
          AND NOT t.tgisinternal
          ORDER BY c.relname, t.tgname
        `);

        funcSql += "-- =====================\n-- TRIGGERS\n-- =====================\n\n";
        for (const row of triggersResult.rows) {
          funcSql += `${row.trigger_def};\n\n`;
        }

        scripts.functions = funcSql;
      }

      // ===== 4. RLS POLICIES =====
      if (section === "all" || section === "policies") {
        const rlsResult = await conn.queryObject<{
          tablename: string;
          policyname: string;
          permissive: string;
          roles: string;
          cmd: string;
          qual: string | null;
          with_check: string | null;
        }>(`
          SELECT tablename, policyname, permissive, roles::text, cmd, qual::text, with_check::text
          FROM pg_policies
          WHERE schemaname = 'public'
          ORDER BY tablename, policyname
        `);

        let policySql = "-- =====================\n-- RLS POLICIES\n-- =====================\n\n";

        // Enable RLS for all tables
        const rlsTables = new Set(rlsResult.rows.map((r) => r.tablename));
        for (const t of rlsTables) {
          policySql += `ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;\n`;
        }
        policySql += "\n";

        for (const row of rlsResult.rows) {
          const permissive = row.permissive === "PERMISSIVE" ? "" : "AS RESTRICTIVE ";
          policySql += `CREATE POLICY "${row.policyname}" ON public.${row.tablename} ${permissive}FOR ${row.cmd} TO ${row.roles}`;
          if (row.qual) policySql += ` USING (${row.qual})`;
          if (row.with_check) policySql += ` WITH CHECK (${row.with_check})`;
          policySql += ";\n";
        }

        scripts.policies = policySql;
      }

      // ===== 5. DATA (INSERT statements) =====
      if (section === "all" || section === "data") {
        let dataSql = "-- =====================\n-- DATA\n-- =====================\n\n";

        for (const tableName of TABLE_ORDER) {
          const result = await conn.queryObject(`SELECT * FROM public.${tableName}`);
          if (!result.rows || result.rows.length === 0) continue;

          dataSql += `-- Table: ${tableName} (${result.rows.length} rows)\n`;
          
          for (const row of result.rows) {
            const record = row as Record<string, unknown>;
            const columns = Object.keys(record);
            const values = columns.map((col) => escapeValue(record[col]));
            dataSql += `INSERT INTO public.${tableName} (${columns.join(", ")}) VALUES (${values.join(", ")}) ON CONFLICT DO NOTHING;\n`;
          }
          dataSql += "\n";
        }

        scripts.data = dataSql;
      }
    } finally {
      conn.release();
      await pool.end();
    }

    return new Response(JSON.stringify({ scripts }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao exportar banco de dados" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

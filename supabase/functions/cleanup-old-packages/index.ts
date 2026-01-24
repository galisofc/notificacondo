import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Detect trigger type
  const authHeader = req.headers.get("authorization") || "";
  const triggerType = authHeader.includes(" anon") ? "scheduled" : "manual";

  // Parse request body for options
  let dryRun = false;
  let customRetentionDays: number | null = null;
  
  try {
    const body = await req.json();
    dryRun = body?.dry_run === true;
    customRetentionDays = body?.retention_days || null;
  } catch {
    // No body or invalid JSON, use defaults
  }

  // Insert initial log entry
  const { data: logEntry } = await supabase
    .from("edge_function_logs")
    .insert({
      function_name: "cleanup-old-packages",
      status: "running",
      trigger_type: triggerType,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  const logId = logEntry?.id;

  try {
    // Check if job is paused
    const { data: pauseStatus } = await supabase
      .from("cron_job_controls")
      .select("paused")
      .eq("function_name", "cleanup-old-packages")
      .single();

    if (pauseStatus?.paused && triggerType === "scheduled") {
      // Update log to skipped
      if (logId) {
        await supabase
          .from("edge_function_logs")
          .update({
            status: "skipped",
            finished_at: new Date().toISOString(),
            result: { message: "Job is paused" },
          })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Job is paused", skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get retention days from settings or use custom value
    let retentionDays = 90; // default
    
    if (customRetentionDays) {
      retentionDays = customRetentionDays;
    } else {
      const { data: setting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "package_retention_days")
        .single();

      if (setting?.value) {
        retentionDays = parseInt(setting.value, 10);
      }
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffIso = cutoffDate.toISOString();

    // Find packages to delete
    const { data: packagesToDelete, error: fetchError } = await supabase
      .from("packages")
      .select("id, photo_url")
      .eq("status", "retirada")
      .lt("picked_up_at", cutoffIso);

    if (fetchError) {
      throw new Error(`Failed to fetch packages: ${fetchError.message}`);
    }

    const totalFound = packagesToDelete?.length || 0;

    // If dry run, just return the count
    if (dryRun) {
      if (logId) {
        await supabase
          .from("edge_function_logs")
          .update({
            status: "success",
            finished_at: new Date().toISOString(),
            result: {
              dry_run: true,
              packages_found: totalFound,
              retention_days: retentionDays,
              cutoff_date: cutoffIso,
            },
          })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          packages_found: totalFound,
          retention_days: retentionDays,
          cutoff_date: cutoffIso,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process deletions
    let deletedPackages = 0;
    let deletedPhotos = 0;
    const errors: string[] = [];

    for (const pkg of packagesToDelete || []) {
      try {
        // Delete photo from storage if exists
        if (pkg.photo_url) {
          const urlParts = pkg.photo_url.split("/package-photos/");
          if (urlParts.length > 1) {
            const fileName = urlParts[1].split("?")[0]; // Remove query params
            const { error: storageError } = await supabase.storage
              .from("package-photos")
              .remove([fileName]);

            if (!storageError) {
              deletedPhotos++;
            }
          }
        }

        // Delete package record
        const { error: deleteError } = await supabase
          .from("packages")
          .delete()
          .eq("id", pkg.id);

        if (deleteError) {
          errors.push(`Package ${pkg.id}: ${deleteError.message}`);
        } else {
          deletedPackages++;
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        errors.push(`Package ${pkg.id}: ${errorMessage}`);
      }
    }

    const status = errors.length > 0 ? "partial" : "success";

    // Update log with results
    if (logId) {
      await supabase
        .from("edge_function_logs")
        .update({
          status,
          finished_at: new Date().toISOString(),
          result: {
            packages_found: totalFound,
            packages_deleted: deletedPackages,
            photos_deleted: deletedPhotos,
            retention_days: retentionDays,
            cutoff_date: cutoffIso,
            errors: errors.length > 0 ? errors : undefined,
          },
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        packages_found: totalFound,
        packages_deleted: deletedPackages,
        photos_deleted: deletedPhotos,
        retention_days: retentionDays,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in cleanup-old-packages:", errorMessage);

    // Update log with error
    if (logId) {
      try {
        await supabase
          .from("edge_function_logs")
          .update({
            status: "error",
            finished_at: new Date().toISOString(),
            result: { error: errorMessage },
          })
          .eq("id", logId);
      } catch {
        // Ignore log update errors
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

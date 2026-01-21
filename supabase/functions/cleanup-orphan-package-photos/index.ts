// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let supabase: ReturnType<typeof createClient> | null = null;
  let logId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine trigger type from request
    const authHeader = req.headers.get("authorization");
    const isScheduled = authHeader?.includes("anon") || false;
    const triggerType = isScheduled ? "scheduled" : "manual";

    console.log(`Starting orphan package photos cleanup (${triggerType})...`);

    // Log start of execution
    const { data: logEntry } = await supabase
      .from("edge_function_logs")
      .insert({
        function_name: "cleanup-orphan-package-photos",
        trigger_type: triggerType,
        status: "running",
        started_at: new Date().toISOString(),
      } as any)
      .select("id")
      .single();

    logId = (logEntry as any)?.id || null;

    // Check if this cron is paused
    const { data: pauseStatus } = await supabase
      .from("cron_job_controls")
      .select("paused")
      .eq("function_name", "cleanup-orphan-package-photos")
      .single();

    if ((pauseStatus as any)?.paused) {
      console.log("Cleanup job is paused, skipping execution");
      
      // Update log with skipped status
      if (logId) {
        await supabase
          .from("edge_function_logs")
          .update({
            status: "skipped",
            ended_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            result: { message: "Job is paused" },
          } as any)
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Job is paused" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all files from the package-photos bucket
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from("package-photos")
      .list("", { limit: 1000 });

    if (storageError) {
      throw new Error(`Error listing storage files: ${storageError.message}`);
    }

    if (!storageFiles || storageFiles.length === 0) {
      console.log("No files found in package-photos bucket");
      
      const result = { success: true, deletedCount: 0, message: "No files to check" };
      
      // Update log with success
      if (logId) {
        await supabase
          .from("edge_function_logs")
          .update({
            status: "success",
            ended_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            result,
          } as any)
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${storageFiles.length} files in storage`);

    // Get all package photo URLs from database
    const { data: packages, error: packagesError } = await supabase
      .from("packages")
      .select("photo_url")
      .not("photo_url", "is", null);

    if (packagesError) {
      throw new Error(`Error fetching packages: ${packagesError.message}`);
    }

    // Extract file names from package URLs
    const packageFileNames = new Set<string>();
    for (const pkg of (packages || []) as { photo_url: string }[]) {
      if (pkg.photo_url) {
        // Extract filename from URL: .../package-photos/filename.jpg
        const match = pkg.photo_url.match(/package-photos\/([^?]+)/);
        if (match) {
          packageFileNames.add(match[1]);
        }
      }
    }

    console.log(`Found ${packageFileNames.size} photos referenced in database`);

    // Find orphan files (in storage but not in database)
    const orphanFiles: string[] = [];
    for (const file of storageFiles) {
      // Skip folders (they have no metadata.size)
      if (!file.name || file.id === null) continue;
      
      if (!packageFileNames.has(file.name)) {
        orphanFiles.push(file.name);
      }
    }

    console.log(`Found ${orphanFiles.length} orphan files to delete`);

    let deletedCount = 0;
    const errors: string[] = [];

    // Delete orphan files in batches of 100
    const batchSize = 100;
    for (let i = 0; i < orphanFiles.length; i += batchSize) {
      const batch = orphanFiles.slice(i, i + batchSize);
      
      const { error: deleteError } = await supabase.storage
        .from("package-photos")
        .remove(batch);

      if (deleteError) {
        console.error(`Error deleting batch: ${deleteError.message}`);
        errors.push(deleteError.message);
      } else {
        deletedCount += batch.length;
        console.log(`Deleted batch of ${batch.length} files`);
      }
    }

    console.log(`Cleanup completed. Deleted ${deletedCount} orphan files.`);

    const result = {
      success: true,
      totalFilesChecked: storageFiles.length,
      referencedFiles: packageFileNames.size,
      orphanFilesFound: orphanFiles.length,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
    };

    // Update log with success
    if (logId) {
      await supabase
        .from("edge_function_logs")
        .update({
          status: errors.length > 0 ? "partial" : "success",
          ended_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          result,
        } as any)
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);

    // Try to update log with error
    if (supabase && logId) {
      try {
        await supabase
          .from("edge_function_logs")
          .update({
            status: "error",
            ended_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            error_message: String(error),
          } as any)
          .eq("id", logId);
      } catch (logError) {
        console.error("Failed to update log:", logError);
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

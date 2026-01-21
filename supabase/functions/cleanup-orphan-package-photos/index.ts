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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting orphan package photos cleanup...");

    // Check if this cron is paused
    const { data: pauseStatus } = await supabase
      .from("cron_job_controls")
      .select("paused")
      .eq("function_name", "cleanup-orphan-package-photos")
      .single();

    if (pauseStatus?.paused) {
      console.log("Cleanup job is paused, skipping execution");
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
      return new Response(
        JSON.stringify({ success: true, deletedCount: 0, message: "No files to check" }),
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
    for (const pkg of packages || []) {
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

    // Log the cleanup result
    await supabase.from("cron_job_logs").insert({
      function_name: "cleanup-orphan-package-photos",
      status: errors.length > 0 ? "partial" : "success",
      details: {
        totalFilesChecked: storageFiles.length,
        referencedFiles: packageFileNames.size,
        orphanFilesFound: orphanFiles.length,
        deletedCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    console.log(`Cleanup completed. Deleted ${deletedCount} orphan files.`);

    return new Response(
      JSON.stringify({
        success: true,
        totalFilesChecked: storageFiles.length,
        referencedFiles: packageFileNames.size,
        orphanFilesFound: orphanFiles.length,
        deletedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);

    // Try to log the error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase.from("cron_job_logs").insert({
        function_name: "cleanup-orphan-package-photos",
        status: "error",
        details: { error: String(error) },
      });
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

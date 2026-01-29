// Backend function: returns a signed URL for a private package photo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Server misconfigured" });
    }

    const authHeader = req.headers.get("authorization") ?? "";

    // Validate the caller is authenticated
    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authedClient.auth.getUser();
    if (userError || !userData?.user) {
      return json(401, { error: "Unauthorized" });
    }

    const body = await req.json().catch(() => null) as
      | { filePath?: string; expiresIn?: number }
      | null;

    const filePath = body?.filePath;
    const expiresIn = typeof body?.expiresIn === "number" ? body!.expiresIn : 3600;

    if (!filePath || typeof filePath !== "string") {
      return json(400, { error: "Missing filePath" });
    }

    // Basic hardening
    if (
      filePath.includes("..") ||
      filePath.startsWith("/") ||
      filePath.length > 300
    ) {
      return json(400, { error: "Invalid filePath" });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await admin.storage
      .from("package-photos")
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      return json(400, { error: error.message, signedUrl: null });
    }

    return json(200, { signedUrl: data?.signedUrl ?? null });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

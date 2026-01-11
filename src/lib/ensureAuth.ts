import { supabase } from "@/integrations/supabase/client";

/**
 * Best-effort session refresh to recover from occasional "JWT expired" API responses.
 *
 * It does NOT sign the user in; it only refreshes an existing session.
 */
export async function ensureValidSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  try {
    await supabase.auth.refreshSession();
  } catch {
    // Ignore: caller will handle errors (ProtectedRoute will redirect if user becomes null)
  }
}

export function isJwtExpiredError(err: unknown) {
  const anyErr = err as any;
  return (
    anyErr?.status === 401 ||
    anyErr?.code === "PGRST303" ||
    String(anyErr?.message || "").toLowerCase().includes("jwt expired")
  );
}

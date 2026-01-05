import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const base64UrlDecode = (input: string) => {
  // base64url -> base64
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  return atob(padded);
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const params = useParams<{ next?: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash fragment from URL (tokens often come here)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const error = hashParams.get("error");
        const errorDescription = hashParams.get("error_description");

        if (error) {
          console.error("Auth callback error:", error, errorDescription);
          setErrorMessage(errorDescription || error);
          setStatus("error");
          return;
        }

        // If we have tokens in the hash, set the session
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error("Error setting session:", sessionError);
            setErrorMessage(sessionError.message);
            setStatus("error");
            return;
          }
        }

        // Wait a moment for session to be established
        await new Promise((resolve) => setTimeout(resolve, 250));

        // If needed, try PKCE exchange
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (exchangeError) {
            // Not necessarily fatal (implicit flow)
            console.log("exchangeCodeForSession warning:", exchangeError.message);
          }
        }

        const { data: { session: finalSession } } = await supabase.auth.getSession();
        if (!finalSession) {
          setErrorMessage("Não foi possível estabelecer a sessão. Tente novamente.");
          setStatus("error");
          return;
        }

        setStatus("success");

        // 1) Prefer path param (/auth/callback/next/:next) - robust (no query stripping)
        let decodedNextFromParam: string | null = null;
        if (params.next) {
          try {
            decodedNextFromParam = base64UrlDecode(params.next);
            console.log("[AuthCallback] Decoded path param next:", decodedNextFromParam);
          } catch (e) {
            console.warn("[AuthCallback] Failed to decode path param:", params.next, e);
            decodedNextFromParam = null;
          }
        } else {
          console.log("[AuthCallback] No path param 'next' found");
        }

        // 2) Then query string
        const nextParam = new URLSearchParams(window.location.search).get("next");
        const safeQueryNext = nextParam && nextParam.startsWith("/") ? nextParam : null;
        console.log("[AuthCallback] Query string next:", nextParam, "-> safe:", safeQueryNext);

        // 3) Fallback localStorage
        const pendingRedirect = localStorage.getItem("post_magiclink_redirect");
        console.log("[AuthCallback] localStorage redirect:", pendingRedirect);
        if (pendingRedirect) localStorage.removeItem("post_magiclink_redirect");

        const safeParamNext = decodedNextFromParam && decodedNextFromParam.startsWith("/")
          ? decodedNextFromParam
          : null;

        const targetPath = safeParamNext || safeQueryNext || pendingRedirect || "/resident";

        console.log("[AuthCallback] Final redirect decision:", {
          safeParamNext,
          safeQueryNext,
          pendingRedirect,
          targetPath,
        });

        setTimeout(() => {
          navigate(targetPath, { replace: true });
        }, 600);
      } catch (err) {
        console.error("Auth callback error:", err);
        setErrorMessage("Erro ao processar autenticação.");
        setStatus("error");
      }
    };

    handleAuthCallback();
  }, [navigate, params.next]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-card border-border/50">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center text-center">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
                status === "error" ? "bg-destructive/10" : "bg-primary/10"
              }`}
            >
              {status === "error" ? (
                <AlertCircle className="w-8 h-8 text-destructive" />
              ) : status === "success" ? (
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              ) : (
                <Building2 className="w-8 h-8 text-primary" />
              )}
            </div>

            {status === "loading" && (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                  Processando autenticação...
                </h2>
                <p className="text-muted-foreground">Aguarde enquanto validamos seu acesso.</p>
              </>
            )}

            {status === "success" && (
              <>
                <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                  Autenticação concluída!
                </h2>
                <p className="text-muted-foreground mb-4">Redirecionando para sua ocorrência...</p>
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </>
            )}

            {status === "error" && (
              <>
                <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                  Erro na autenticação
                </h2>
                <p className="text-muted-foreground mb-6">
                  {errorMessage || "Não foi possível processar seu acesso."}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => navigate("/")}>Voltar ao início</Button>
                  <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;
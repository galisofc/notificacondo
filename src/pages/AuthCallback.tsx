import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash fragment from URL (Supabase Auth puts tokens here)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const error = hashParams.get("error");
        const errorDescription = hashParams.get("error_description");

        // Check for errors in the URL
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
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if we have a session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // Try to get session from URL (PKCE flow)
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          
          if (exchangeError) {
            console.error("Error exchanging code:", exchangeError);
            // Not necessarily an error - might just be implicit flow
          }
        }

        // Check session again
        const { data: { session: finalSession } } = await supabase.auth.getSession();

        if (finalSession) {
          setStatus("success");

          // Get pending redirect from localStorage
          const pendingRedirect = localStorage.getItem("post_magiclink_redirect");
          
          // Clear the pending redirect
          if (pendingRedirect) {
            localStorage.removeItem("post_magiclink_redirect");
          }

          // Determine where to redirect
          const targetPath = pendingRedirect || "/resident";

          // Small delay to show success state
          setTimeout(() => {
            navigate(targetPath, { replace: true });
          }, 1000);
        } else {
          setErrorMessage("Não foi possível estabelecer a sessão. Tente novamente.");
          setStatus("error");
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setErrorMessage("Erro ao processar autenticação.");
        setStatus("error");
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-card border-border/50">
        <CardContent className="pt-8 pb-8">
          <div className="flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
              status === "error" ? "bg-destructive/10" : "bg-primary/10"
            }`}>
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
                <p className="text-muted-foreground">
                  Aguarde enquanto validamos seu acesso.
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                  Autenticação concluída!
                </h2>
                <p className="text-muted-foreground mb-4">
                  Redirecionando para sua ocorrência...
                </p>
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
                  <Button variant="outline" onClick={() => navigate("/")}>
                    Voltar ao início
                  </Button>
                  <Button onClick={() => window.location.reload()}>
                    Tentar novamente
                  </Button>
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
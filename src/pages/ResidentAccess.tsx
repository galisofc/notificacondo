import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Home,
  User,
} from "lucide-react";

interface ResidentData {
  id: string;
  full_name: string;
  apartment_number: string;
  block_name: string;
  condominium_name: string;
}

const ResidentAccess = () => {
  const { token: paramToken } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get("token");
  const token = paramToken || queryToken;
  
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resident, setResident] = useState<ResidentData | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Link inválido");
        setLoading(false);
        return;
      }

      try {
        const { data, error: funcError } = await supabase.functions.invoke(
          "validate-access-token",
          {
            body: { token },
          }
        );

        if (funcError || data?.error) {
          setError(data?.error || "Link inválido ou expirado");
          setLoading(false);
          return;
        }

        setResident(data.resident);

        // Redirect to magic link to authenticate
        if (data.magicLink) {
          setRedirecting(true);
          window.location.href = data.magicLink;
        }
      } catch (err) {
        console.error("Error validating token:", err);
        setError("Erro ao validar o link. Tente novamente.");
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  if (loading || redirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gradient-card border-border/50">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                {redirecting ? "Redirecionando..." : "Validando acesso..."}
              </h2>
              <p className="text-muted-foreground">
                {redirecting
                  ? "Você será redirecionado para o painel do morador."
                  : "Aguarde enquanto verificamos seu link de acesso."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gradient-card border-border/50">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                Link Inválido
              </h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button variant="outline" onClick={() => navigate("/")}>
                Voltar para o início
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resident) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              Acesso Validado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <User className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Morador</p>
                  <p className="font-medium text-foreground">{resident.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <Home className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Unidade</p>
                  <p className="font-medium text-foreground">
                    {resident.block_name} - Apt {resident.apartment_number}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <Building2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Condomínio</p>
                  <p className="font-medium text-foreground">{resident.condominium_name}</p>
                </div>
              </div>
              <Button
                variant="hero"
                className="w-full mt-4"
                onClick={() => navigate("/resident")}
              >
                Acessar Painel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default ResidentAccess;

import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, ArrowRight, Sparkles } from "lucide-react";

interface SubscriptionGateProps {
  children: ReactNode;
  condominiumId?: string | null;
  /** Mensagem personalizada opcional */
  message?: string;
}

/**
 * Bloqueia o conteúdo quando o trial expirou e não há plano ativo/vitalício.
 * Exibe loading enquanto verifica, e um card de bloqueio elegante quando necessário.
 */
export default function SubscriptionGate({ children, condominiumId, message }: SubscriptionGateProps) {
  const navigate = useNavigate();
  const { isActive, isLoading } = useSubscriptionStatus(condominiumId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <Card className="bg-card border-border shadow-card">
        <CardContent className="py-16 flex flex-col items-center text-center gap-5">
          {/* Ícone */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>

          {/* Texto */}
          <div className="space-y-2 max-w-sm">
            <h3 className="font-display text-xl font-semibold text-foreground">
              Assinatura necessária
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {message ?? "Seu período de teste expirou. Assine um plano para continuar usando este módulo."}
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <Button
              onClick={() => navigate("/sindico/subscriptions")}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Ver planos disponíveis
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

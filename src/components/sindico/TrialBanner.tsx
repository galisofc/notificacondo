import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, differenceInHours } from "date-fns";
import { Clock, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface TrialSubscription {
  id: string;
  is_trial: boolean;
  trial_ends_at: string | null;
  plan: string;
  condominium: {
    id: string;
    name: string;
  };
}

const TrialBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: trialSubscriptions } = useQuery({
    queryKey: ["trial-subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          id,
          is_trial,
          trial_ends_at,
          plan,
          condominium:condominiums!inner(id, name, owner_id)
        `)
        .eq("condominiums.owner_id", user.id)
        .eq("is_trial", true);

      if (error) throw error;
      return (data || []) as TrialSubscription[];
    },
    enabled: !!user,
  });

  if (!trialSubscriptions || trialSubscriptions.length === 0) {
    return null;
  }

  const getTrialInfo = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return { daysLeft: 0, hoursLeft: 0, isUrgent: false, isExpired: false };
    
    const now = new Date();
    const endDate = new Date(trialEndsAt);
    const daysLeft = differenceInDays(endDate, now);
    const hoursLeft = differenceInHours(endDate, now);
    
    return {
      daysLeft: Math.max(0, daysLeft),
      hoursLeft: Math.max(0, hoursLeft),
      isUrgent: daysLeft <= 2,
      isExpired: now >= endDate,
    };
  };

  return (
    <div className="space-y-3">
      {trialSubscriptions.map((sub) => {
        const { daysLeft, hoursLeft, isUrgent, isExpired } = getTrialInfo(sub.trial_ends_at);

        if (isExpired) return null;

        return (
          <div
            key={sub.id}
            className={`relative overflow-hidden rounded-xl p-4 ${
              isUrgent
                ? "bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border border-amber-500/30"
                : "bg-gradient-to-r from-primary/20 via-accent/20 to-emerald-500/20 border border-primary/30"
            }`}
          >
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
              <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl ${
                isUrgent ? "bg-amber-500/20" : "bg-primary/20"
              }`} />
              <div className={`absolute -left-8 -bottom-8 w-24 h-24 rounded-full blur-2xl ${
                isUrgent ? "bg-red-500/20" : "bg-accent/20"
              }`} />
            </div>

            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  isUrgent ? "bg-amber-500/20" : "bg-primary/20"
                }`}>
                  {isUrgent ? (
                    <Clock className={`w-5 h-5 ${isUrgent ? "text-amber-500" : "text-primary"}`} />
                  ) : (
                    <Sparkles className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    {isUrgent ? "Período de teste acabando!" : "Período de teste gratuito"}
                    {sub.condominium.name && (
                      <span className="text-sm font-normal text-muted-foreground">
                        — {sub.condominium.name}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {daysLeft > 0 ? (
                      <>
                        Você tem{" "}
                        <span className={`font-bold ${isUrgent ? "text-amber-500" : "text-primary"}`}>
                          {daysLeft} {daysLeft === 1 ? "dia" : "dias"}
                        </span>{" "}
                        restantes para aproveitar todos os recursos gratuitamente.
                      </>
                    ) : (
                      <>
                        Restam apenas{" "}
                        <span className="font-bold text-amber-500">
                          {hoursLeft} {hoursLeft === 1 ? "hora" : "horas"}
                        </span>{" "}
                        do seu período de teste.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  isUrgent
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "bg-primary/20 text-primary"
                }`}>
                  <Clock className="w-4 h-4" />
                  {daysLeft > 0 ? `${daysLeft}d restantes` : `${hoursLeft}h restantes`}
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate("/sindico/subscriptions")}
                  className={isUrgent ? "bg-amber-500 hover:bg-amber-600" : ""}
                >
                  Ver planos
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative mt-4">
              <div className="h-1.5 bg-background/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isUrgent
                      ? "bg-gradient-to-r from-amber-500 to-red-500"
                      : "bg-gradient-to-r from-primary to-accent"
                  }`}
                  style={{ width: `${Math.max(5, ((7 - daysLeft) / 7) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                <span>Início</span>
                <span>7 dias grátis</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrialBanner;

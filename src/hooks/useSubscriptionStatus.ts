import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export interface SubscriptionStatus {
  isActive: boolean;       // trial válido OU plano pago ativo OU vitalício
  isLifetime: boolean;
  isTrial: boolean;
  isTrialExpired: boolean;
  isPaidActive: boolean;
  isLoading: boolean;
  condominiumId: string | null;
}

export function useSubscriptionStatus(condominiumId?: string | null): SubscriptionStatus {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["subscription-status", user?.id, condominiumId],
    queryFn: async () => {
      if (!user) return null;

      let query = supabase
        .from("subscriptions")
        .select(`
          id,
          is_trial,
          is_lifetime,
          active,
          trial_ends_at,
          plan,
          condominium_id
        `)
        .eq("active", true);

      if (condominiumId) {
        query = query.eq("condominium_id", condominiumId);
      } else {
        // Busca o condomínio do síndico atual
        const { data: condos } = await supabase
          .from("condominiums")
          .select("id")
          .eq("owner_id", user.id);

        const ids = condos?.map((c) => c.id) || [];
        if (ids.length === 0) return null;
        query = query.in("condominium_id", ids);
      }

      const { data, error } = await query.limit(1).single();
      if (error) return null;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  if (isLoading) {
    return {
      isActive: false,
      isLifetime: false,
      isTrial: false,
      isTrialExpired: false,
      isPaidActive: false,
      isLoading: true,
      condominiumId: condominiumId ?? null,
    };
  }

  if (!data) {
    return {
      isActive: false,
      isLifetime: false,
      isTrial: false,
      isTrialExpired: false,
      isPaidActive: false,
      isLoading: false,
      condominiumId: condominiumId ?? null,
    };
  }

  const isLifetime = data.is_lifetime === true;
  const isTrial = data.is_trial === true && !isLifetime;
  const now = new Date();
  const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
  const isTrialExpired = isTrial && trialEndsAt !== null && trialEndsAt < now;
  const isTrialValid = isTrial && !isTrialExpired;
  const isPaidActive = data.active === true && !isTrial && !isLifetime;
  const isActive = isLifetime || isTrialValid || isPaidActive;

  return {
    isActive,
    isLifetime,
    isTrial,
    isTrialExpired,
    isPaidActive,
    isLoading: false,
    condominiumId: data.condominium_id ?? condominiumId ?? null,
  };
}

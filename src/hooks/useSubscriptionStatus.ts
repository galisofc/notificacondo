import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
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
  const { isPorteiro } = useUserRole();

  const { data, isLoading } = useQuery({
    queryKey: ["subscription-status", user?.id, condominiumId, isPorteiro],
    queryFn: async () => {
      if (!user) return null;

      // Base query — sem filtrar active=true aqui para pegar também vitalícios
      // independente do status booleano
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
        `);

      if (condominiumId) {
        query = query.eq("condominium_id", condominiumId);
      } else if (isPorteiro) {
        // Porteiro: busca via user_condominiums
        const { data: userCondos } = await supabase
          .from("user_condominiums")
          .select("condominium_id")
          .eq("user_id", user.id);

        const ids = userCondos?.map((uc) => uc.condominium_id) || [];
        if (ids.length === 0) return null;
        query = query.in("condominium_id", ids);
      } else {
        // Síndico: busca pelo owner_id
        const { data: condos } = await supabase
          .from("condominiums")
          .select("id")
          .eq("owner_id", user.id);

        const ids = condos?.map((c) => c.id) || [];
        if (ids.length === 0) return null;
        query = query.in("condominium_id", ids);
      }

      // Busca todas as subscriptions do condomínio (pode ter mais de uma)
      const { data: rows, error } = await query;
      if (error || !rows || rows.length === 0) return null;

      // Prioridade: vitalício > pago ativo > trial ativo > qualquer active=true
      const lifetime = rows.find((r) => r.is_lifetime === true);
      if (lifetime) return lifetime;

      const now = new Date();

      // Plano pago ativo (não trial, não vitalício)
      const paidActive = rows.find(
        (r) => r.active === true && r.is_trial === false && r.is_lifetime === false
      );
      if (paidActive) return paidActive;

      // Trial ainda válido
      const validTrial = rows.find((r) => {
        if (!r.is_trial || !r.active) return false;
        const ends = r.trial_ends_at ? new Date(r.trial_ends_at) : null;
        return ends === null || ends >= now;
      });
      if (validTrial) return validTrial;

      // Retorna o primeiro ativo (trial expirado ou qualquer outro estado)
      const anyActive = rows.find((r) => r.active === true);
      return anyActive ?? rows[0];
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

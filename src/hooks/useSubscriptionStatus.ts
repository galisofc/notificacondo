import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

export interface SubscriptionStatus {
  isActive: boolean;
  isLifetime: boolean;
  isTrial: boolean;
  isTrialExpired: boolean;
  isPaidActive: boolean;
  isLoading: boolean;
  condominiumId: string | null;
}

export function useSubscriptionStatus(condominiumId?: string | null): SubscriptionStatus {
  const { user } = useAuth();
  const { isPorteiro, isSuperAdmin, loading: roleLoading } = useUserRole();

  const { data, isLoading } = useQuery({
    queryKey: ["subscription-status", user?.id, condominiumId, isPorteiro, isSuperAdmin],
    queryFn: async () => {
      if (!user) return null;

      // Super admin: acesso total sempre
      if (isSuperAdmin) {
        return {
          is_lifetime: true,
          is_trial: false,
          active: true,
          trial_ends_at: null,
          plan: "enterprise",
          condominium_id: condominiumId ?? null,
        };
      }

      // Busca direto nas subscriptions — o RLS já filtra pelo papel do usuário
      // (síndico: via condominiums.owner_id; porteiro: via user_condominiums)
      // Para porteiro, busca pelo condomínio ao qual está vinculado
      let rows: any[] | null = null;

      if (isPorteiro) {
        const { data: userCondos } = await supabase
          .from("user_condominiums")
          .select("condominium_id")
          .eq("user_id", user.id);

        const ids = userCondos?.map((uc) => uc.condominium_id) || [];
        if (ids.length === 0) return null;

        const { data: subs } = await supabase
          .from("subscriptions")
          .select("id, is_trial, is_lifetime, active, trial_ends_at, plan, condominium_id")
          .in("condominium_id", ids);
        rows = subs;
      } else if (condominiumId) {
        // Síndico com condomínio específico selecionado
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("id, is_trial, is_lifetime, active, trial_ends_at, plan, condominium_id")
          .eq("condominium_id", condominiumId);
        rows = subs;
      } else {
        // Síndico sem filtro — o RLS retorna apenas as subscriptions dos seus condomínios
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("id, is_trial, is_lifetime, active, trial_ends_at, plan, condominium_id");
        rows = subs;
      }

      if (!rows || rows.length === 0) return null;

      // Prioridade: vitalício > pago ativo > trial válido > fallback
      const lifetime = rows.find((r) => r.is_lifetime === true);
      if (lifetime) return lifetime;

      const now = new Date();

      const paidActive = rows.find(
        (r) => r.active === true && r.is_trial === false && r.is_lifetime === false
      );
      if (paidActive) return paidActive;

      const validTrial = rows.find((r) => {
        if (!r.is_trial || !r.active) return false;
        const ends = r.trial_ends_at ? new Date(r.trial_ends_at) : null;
        return ends === null || ends >= now;
      });
      if (validTrial) return validTrial;

      return rows.find((r) => r.active === true) ?? rows[0];
    },
    // Aguarda o role estar carregado para evitar cache com resultado incorreto
    enabled: !!user && !roleLoading,
    staleTime: 30 * 1000, // 30 segundos
  });

  // Enquanto o role ou a query carregam, mostra skeleton (não bloqueia)
  if (isLoading || roleLoading) {
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

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TRIAL_DAYS = 7;

export const useTrialDays = () => {
  const { data: trialDays = DEFAULT_TRIAL_DAYS, isLoading } = useQuery({
    queryKey: ['trial-days'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'default_trial_days')
        .single();
      
      if (error || !data) return DEFAULT_TRIAL_DAYS;
      
      const value = typeof data.value === 'number' ? data.value : Number(data.value);
      return isNaN(value) ? DEFAULT_TRIAL_DAYS : value;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  return { trialDays, isLoading };
};

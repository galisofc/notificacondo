-- Add trial period fields to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN is_trial BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the trial logic
COMMENT ON COLUMN public.subscriptions.trial_ends_at IS 'Date when the 7-day trial period ends. Invoice is generated for day 8.';
COMMENT ON COLUMN public.subscriptions.is_trial IS 'Whether the subscription is currently in trial period.';

-- Update handle_new_condominium to set trial period
CREATE OR REPLACE FUNCTION public.handle_new_condominium()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  trial_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Trial ends 7 days from now (billing starts on day 8)
  trial_end_date := NOW() + INTERVAL '7 days';
  
  INSERT INTO public.subscriptions (
    condominium_id, 
    plan, 
    notifications_limit, 
    warnings_limit, 
    fines_limit,
    is_trial,
    trial_ends_at,
    current_period_start,
    current_period_end
  )
  VALUES (
    NEW.id, 
    'start', 
    10, 
    10, 
    0,
    true,
    trial_end_date,
    NOW(),
    trial_end_date
  );
  
  RETURN NEW;
END;
$function$;
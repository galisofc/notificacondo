-- Create table for cron job pause controls (avoids modifying cron.job)
CREATE TABLE IF NOT EXISTS public.cron_job_controls (
  function_name TEXT PRIMARY KEY,
  paused BOOLEAN NOT NULL DEFAULT false,
  paused_at TIMESTAMP WITH TIME ZONE,
  paused_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cron_job_controls ENABLE ROW LEVEL SECURITY;

-- Super admins can view all controls
CREATE POLICY "Super admins can view cron job controls"
ON public.cron_job_controls
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can insert controls
CREATE POLICY "Super admins can insert cron job controls"
ON public.cron_job_controls
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can update controls
CREATE POLICY "Super admins can update cron job controls"
ON public.cron_job_controls
FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'));

-- Super admins can delete controls
CREATE POLICY "Super admins can delete cron job controls"
ON public.cron_job_controls
FOR DELETE
USING (public.has_role(auth.uid(), 'super_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_cron_job_controls_updated_at
  BEFORE UPDATE ON public.cron_job_controls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create RPC function to toggle pause status
CREATE OR REPLACE FUNCTION public.toggle_cron_job_pause(p_function_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_paused BOOLEAN;
  current_user_id UUID;
BEGIN
  -- Check if user is super_admin
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permission denied: only super admins can toggle cron job pause';
  END IF;
  
  current_user_id := auth.uid();
  
  -- Try to update existing record, or insert new one
  INSERT INTO public.cron_job_controls (function_name, paused, paused_at, paused_by)
  VALUES (p_function_name, true, now(), current_user_id)
  ON CONFLICT (function_name) 
  DO UPDATE SET 
    paused = NOT cron_job_controls.paused,
    paused_at = CASE WHEN NOT cron_job_controls.paused THEN now() ELSE NULL END,
    paused_by = CASE WHEN NOT cron_job_controls.paused THEN current_user_id ELSE NULL END,
    updated_at = now()
  RETURNING paused INTO new_paused;
  
  RETURN new_paused;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.toggle_cron_job_pause(TEXT) TO authenticated;

-- Create RPC to get all pause statuses (for UI)
CREATE OR REPLACE FUNCTION public.get_cron_job_pause_status()
RETURNS TABLE(function_name TEXT, paused BOOLEAN, paused_at TIMESTAMP WITH TIME ZONE)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT function_name, paused, paused_at 
  FROM public.cron_job_controls;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_cron_job_pause_status() TO authenticated;
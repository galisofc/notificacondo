-- Grant necessary permissions on cron schema
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Drop and recreate the function
DROP FUNCTION IF EXISTS public.toggle_cron_job(bigint);

CREATE OR REPLACE FUNCTION public.toggle_cron_job(p_jobid bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_status boolean;
BEGIN
  -- Check if user is super_admin
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Permission denied: only super admins can toggle cron jobs';
  END IF;

  -- Toggle the active status using fully qualified table name
  UPDATE cron.job 
  SET active = NOT active 
  WHERE jobid = p_jobid
  RETURNING active INTO new_status;
  
  IF new_status IS NULL THEN
    RAISE EXCEPTION 'Cron job not found with id: %', p_jobid;
  END IF;
  
  RETURN new_status;
END;
$$;

-- Ensure function is owned by postgres
ALTER FUNCTION public.toggle_cron_job(bigint) OWNER TO postgres;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.toggle_cron_job(bigint) TO authenticated;
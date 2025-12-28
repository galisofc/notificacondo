-- Drop and recreate the function with proper schema access
DROP FUNCTION IF EXISTS public.toggle_cron_job(bigint);

CREATE OR REPLACE FUNCTION public.toggle_cron_job(p_jobid bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cron, public
AS $$
DECLARE
  new_status boolean;
BEGIN
  -- Toggle the active status
  UPDATE cron.job 
  SET active = NOT active 
  WHERE jobid = p_jobid
  RETURNING active INTO new_status;
  
  RETURN new_status;
END;
$$;

-- Change ownership to postgres to ensure proper cron access
ALTER FUNCTION public.toggle_cron_job(bigint) OWNER TO postgres;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.toggle_cron_job(bigint) TO authenticated;
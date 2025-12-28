-- Function to toggle cron job active status
CREATE OR REPLACE FUNCTION public.toggle_cron_job(p_jobid bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.toggle_cron_job(bigint) TO authenticated;
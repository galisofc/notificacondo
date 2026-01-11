-- Fix audit_logs: Only service role or triggers should insert audit logs
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Create a proper policy that only allows the service role to insert
-- Note: The log_audit_event() trigger function runs with SECURITY DEFINER so it can insert
-- Regular users should not be able to insert directly
CREATE POLICY "Only service role can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Fix edge_function_logs: Only service role should manage these logs
DROP POLICY IF EXISTS "Service role can insert edge function logs" ON public.edge_function_logs;
DROP POLICY IF EXISTS "Service role can update edge function logs" ON public.edge_function_logs;

-- Create proper policies for service role only
CREATE POLICY "Service role can insert edge function logs" 
ON public.edge_function_logs 
FOR INSERT 
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update edge function logs" 
ON public.edge_function_logs 
FOR UPDATE 
TO service_role
USING (true);
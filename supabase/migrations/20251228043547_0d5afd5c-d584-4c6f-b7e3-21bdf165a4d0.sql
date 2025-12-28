-- Create table to log all edge function executions (manual and scheduled)
CREATE TABLE IF NOT EXISTS public.edge_function_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual', -- 'manual' or 'scheduled'
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'error', 'skipped'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  result JSONB,
  error_message TEXT,
  triggered_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast queries
CREATE INDEX idx_edge_function_logs_function_name ON public.edge_function_logs(function_name);
CREATE INDEX idx_edge_function_logs_started_at ON public.edge_function_logs(started_at DESC);

-- Enable RLS
ALTER TABLE public.edge_function_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can view all logs
CREATE POLICY "Super admins can view edge function logs"
ON public.edge_function_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- Allow service role to insert (for edge functions)
CREATE POLICY "Service role can insert edge function logs"
ON public.edge_function_logs
FOR INSERT
WITH CHECK (true);

-- Allow service role to update (for edge functions)
CREATE POLICY "Service role can update edge function logs"
ON public.edge_function_logs
FOR UPDATE
USING (true);
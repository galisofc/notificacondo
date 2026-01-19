-- Create table to track password recovery attempts for rate limiting
CREATE TABLE public.password_recovery_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN DEFAULT false
);

-- Create index for efficient querying by email and time
CREATE INDEX idx_password_recovery_email_time ON public.password_recovery_attempts (email, attempted_at DESC);

-- Enable RLS
ALTER TABLE public.password_recovery_attempts ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view attempts (for auditing)
CREATE POLICY "Super admins can view password recovery attempts"
ON public.password_recovery_attempts
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

-- Create function to clean old attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_password_recovery_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.password_recovery_attempts
  WHERE attempted_at < now() - INTERVAL '24 hours';
END;
$$;
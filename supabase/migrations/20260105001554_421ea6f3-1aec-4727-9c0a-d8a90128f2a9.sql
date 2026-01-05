-- Create table for magic link access audit
CREATE TABLE public.magic_link_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL,
  resident_id UUID REFERENCES public.residents(id),
  occurrence_id UUID REFERENCES public.occurrences(id),
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  access_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT true,
  is_new_user BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  redirect_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.magic_link_access_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can view all logs
CREATE POLICY "Super admins can view all magic link logs"
ON public.magic_link_access_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Síndicos can view logs for their condominiums
CREATE POLICY "Sindicos can view magic link logs for their condominiums"
ON public.magic_link_access_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.occurrences o
    JOIN public.condominiums c ON o.condominium_id = c.id
    WHERE o.id = magic_link_access_logs.occurrence_id
    AND c.owner_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_magic_link_access_logs_occurrence ON public.magic_link_access_logs(occurrence_id);
CREATE INDEX idx_magic_link_access_logs_resident ON public.magic_link_access_logs(resident_id);
CREATE INDEX idx_magic_link_access_logs_access_at ON public.magic_link_access_logs(access_at DESC);
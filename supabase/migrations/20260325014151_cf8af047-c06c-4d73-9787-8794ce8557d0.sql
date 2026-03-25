CREATE TABLE public.webhook_raw_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'meta',
  payload jsonb NOT NULL,
  statuses_count int DEFAULT 0,
  bsuids_captured int DEFAULT 0,
  notifications_updated int DEFAULT 0
);

ALTER TABLE public.webhook_raw_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view webhook raw logs"
ON public.webhook_raw_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Service role can insert webhook raw logs"
ON public.webhook_raw_logs FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update webhook raw logs"
ON public.webhook_raw_logs FOR UPDATE TO service_role
USING (true);
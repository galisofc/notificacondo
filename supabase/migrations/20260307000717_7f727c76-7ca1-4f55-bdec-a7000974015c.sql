
-- Add location column to maintenance_executions
ALTER TABLE public.maintenance_executions ADD COLUMN IF NOT EXISTS location jsonb DEFAULT NULL;

-- Create storage bucket for maintenance photos
INSERT INTO storage.buckets (id, name, public) VALUES ('maintenance-photos', 'maintenance-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for maintenance-photos bucket
CREATE POLICY "Zeladores can upload maintenance photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'maintenance-photos' AND (
  EXISTS (SELECT 1 FROM public.user_condominiums WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
));

CREATE POLICY "Authenticated users can view maintenance photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'maintenance-photos');

CREATE POLICY "Super admins can delete maintenance photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'maintenance-photos' AND public.has_role(auth.uid(), 'super_admin'));

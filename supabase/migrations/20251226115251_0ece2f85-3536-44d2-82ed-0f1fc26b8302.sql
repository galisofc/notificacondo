
-- Create storage bucket for occurrence evidences
INSERT INTO storage.buckets (id, name, public)
VALUES ('occurrence-evidences', 'occurrence-evidences', true);

-- RLS policies for occurrence-evidences bucket
CREATE POLICY "Authenticated users can upload evidences"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'occurrence-evidences');

CREATE POLICY "Authenticated users can view evidences"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'occurrence-evidences');

CREATE POLICY "Users can delete own evidences"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'occurrence-evidences' AND auth.uid()::text = (storage.foldername(name))[1]);

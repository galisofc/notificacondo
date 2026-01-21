-- Add RLS policy for sindicos to delete package photos
CREATE POLICY "Sindicos can delete package photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'package-photos'
  AND has_role(auth.uid(), 'sindico')
);

-- Add RLS policy for porteiros to delete package photos they uploaded
CREATE POLICY "Porteiros can delete package photos in their condominiums"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'package-photos'
  AND has_role(auth.uid(), 'porteiro')
);
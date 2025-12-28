-- Make occurrence-evidences bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'occurrence-evidences';

-- Make avatars bucket private (more secure for user data)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'avatars';

-- Drop existing policies for these buckets if any
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Occurrence evidences publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their avatar" ON storage.objects;

-- Create proper RLS policies for avatars bucket
-- Authenticated users can view avatars (needed for displaying profiles)
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create proper RLS policies for occurrence-evidences bucket
-- Condominium owners (síndicos) can view evidence for their condominiums
CREATE POLICY "Sindicos can view occurrence evidences"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'occurrence-evidences'
  AND EXISTS (
    SELECT 1 FROM public.occurrence_evidences oe
    JOIN public.occurrences o ON o.id = oe.occurrence_id
    JOIN public.condominiums c ON c.id = o.condominium_id
    WHERE oe.file_url LIKE '%' || name || '%'
    AND c.owner_id = auth.uid()
  )
);

-- Residents can view evidence for their own occurrences
CREATE POLICY "Residents can view own occurrence evidences"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'occurrence-evidences'
  AND EXISTS (
    SELECT 1 FROM public.occurrence_evidences oe
    JOIN public.occurrences o ON o.id = oe.occurrence_id
    JOIN public.residents r ON r.id = o.resident_id
    WHERE oe.file_url LIKE '%' || name || '%'
    AND r.user_id = auth.uid()
  )
);

-- Super admins can view all evidences
CREATE POLICY "Super admins can view all evidences"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'occurrence-evidences'
  AND public.has_role(auth.uid(), 'super_admin')
);

-- Users can upload evidence (will be linked via occurrence_evidences table)
CREATE POLICY "Users can upload occurrence evidences"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'occurrence-evidences'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own uploaded evidence
CREATE POLICY "Users can delete own occurrence evidences"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'occurrence-evidences'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
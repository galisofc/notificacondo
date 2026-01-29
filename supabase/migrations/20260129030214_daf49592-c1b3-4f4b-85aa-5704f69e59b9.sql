-- ============================================
-- FIX: Optimize storage RLS policies to avoid performance issues
-- The LIKE '%name%' pattern causes full table scans and timeouts
-- ============================================

-- Drop the problematic SELECT policies
DROP POLICY IF EXISTS "Super admins can view all package photos" ON storage.objects;
DROP POLICY IF EXISTS "Sindicos can view condominium package photos" ON storage.objects;
DROP POLICY IF EXISTS "Porteiros can view assigned condominium package photos" ON storage.objects;
DROP POLICY IF EXISTS "Residents can view own apartment package photos" ON storage.objects;

-- Create optimized policies using folder-based access pattern
-- Photo URLs are structured as: condominium_id/filename.jpg

-- Super admins can view all package photos
CREATE POLICY "Super admins can view all package photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'package-photos'
  AND has_role(auth.uid(), 'super_admin')
);

-- Sindicos can view photos by checking if folder matches their condominium
-- Uses (storage.foldername(name))[1] to extract the condominium_id from the path
CREATE POLICY "Sindicos can view condominium package photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'package-photos'
  AND EXISTS (
    SELECT 1 FROM condominiums c
    WHERE c.owner_id = auth.uid()
    AND c.id::text = (storage.foldername(name))[1]
  )
);

-- Porteiros can view photos in their assigned condominiums
CREATE POLICY "Porteiros can view assigned condominium package photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'package-photos'
  AND user_belongs_to_condominium(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Residents can view photos for packages in their apartment
-- Needs to check the actual package record since we need apartment context
CREATE POLICY "Residents can view own apartment package photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'package-photos'
  AND EXISTS (
    SELECT 1 FROM packages p
    JOIN residents r ON r.apartment_id = p.apartment_id
    WHERE r.user_id = auth.uid()
    AND p.condominium_id::text = (storage.foldername(name))[1]
  )
);
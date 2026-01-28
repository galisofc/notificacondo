-- ============================================
-- SECURITY FIX: Remove public access to sensitive data
-- ============================================

-- 1. FIX: app_settings table - Remove public read access
-- Drop the permissive "Anyone can read" policy
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;

-- Create authenticated-only read policy for app_settings
-- Only authenticated users can read app settings
CREATE POLICY "Authenticated users can read app settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

-- 2. FIX: plans table - Remove public read access  
-- Drop the permissive "Anyone can view active plans" policy
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.plans;

-- Create authenticated-only read policy for plans
-- Only authenticated users can view active plans
CREATE POLICY "Authenticated users can view active plans"
ON public.plans
FOR SELECT
TO authenticated
USING (is_active = true);

-- 3. FIX: package-photos storage bucket - Make private and add proper policies
-- Update the bucket to be private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'package-photos';

-- Drop the public SELECT policy
DROP POLICY IF EXISTS "Anyone can view package photos" ON storage.objects;

-- Create role-based SELECT policies for package photos

-- Super admins can view all package photos
CREATE POLICY "Super admins can view all package photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'package-photos'
  AND has_role(auth.uid(), 'super_admin')
);

-- Sindicos can view photos from their condominiums
CREATE POLICY "Sindicos can view condominium package photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'package-photos'
  AND EXISTS (
    SELECT 1 FROM packages p
    JOIN condominiums c ON c.id = p.condominium_id
    WHERE p.photo_url LIKE '%' || storage.objects.name || '%'
    AND c.owner_id = auth.uid()
  )
);

-- Porteiros can view photos in their assigned condominiums
CREATE POLICY "Porteiros can view assigned condominium package photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'package-photos'
  AND EXISTS (
    SELECT 1 FROM packages p
    WHERE p.photo_url LIKE '%' || storage.objects.name || '%'
    AND user_belongs_to_condominium(auth.uid(), p.condominium_id)
  )
);

-- Residents can view photos for packages in their apartment
CREATE POLICY "Residents can view own apartment package photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'package-photos'
  AND EXISTS (
    SELECT 1 FROM packages p
    JOIN residents r ON r.apartment_id = p.apartment_id
    WHERE p.photo_url LIKE '%' || storage.objects.name || '%'
    AND r.user_id = auth.uid()
  )
);
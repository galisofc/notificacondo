-- Allow super admins to update all profiles (needed for editing sindico CPF, phone, etc)
CREATE POLICY "Super admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
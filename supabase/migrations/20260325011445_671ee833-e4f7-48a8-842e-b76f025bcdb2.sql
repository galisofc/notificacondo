CREATE POLICY "Super admins can view all residents"
ON public.residents
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admins can view all apartments"
ON public.apartments
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can view all blocks"
ON public.blocks
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
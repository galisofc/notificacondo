-- Add RLS policy for super admins to view all occurrences
CREATE POLICY "Super admins can view all occurrences"
ON public.occurrences
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
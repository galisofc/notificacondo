-- Add policy for sindicos to view profiles of porteiros who registered packages in their condominiums
CREATE POLICY "Sindicos can view package registrants"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.packages p
    JOIN public.condominiums c ON p.condominium_id = c.id
    WHERE p.received_by = profiles.user_id
    AND c.owner_id = auth.uid()
  )
);
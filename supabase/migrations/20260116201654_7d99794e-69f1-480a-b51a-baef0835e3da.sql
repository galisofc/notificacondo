-- Allow sindicos to view roles of users in their condominiums
CREATE POLICY "Sindicos can view roles of their condominium users"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM user_condominiums uc
    JOIN condominiums c ON uc.condominium_id = c.id
    WHERE uc.user_id = user_roles.user_id
    AND c.owner_id = auth.uid()
  )
);
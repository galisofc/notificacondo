-- Adicionar política para síndicos visualizarem perfis de porteiros dos seus condomínios
CREATE POLICY "Sindicos can view porter profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM user_condominiums uc
    JOIN condominiums c ON c.id = uc.condominium_id
    WHERE uc.user_id = profiles.user_id 
    AND c.owner_id = auth.uid()
  )
);
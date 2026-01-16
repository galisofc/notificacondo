-- Adicionar política para síndicos atualizarem perfis de porteiros dos seus condomínios
CREATE POLICY "Sindicos can update porter profiles"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM user_condominiums uc
    JOIN condominiums c ON c.id = uc.condominium_id
    WHERE uc.user_id = profiles.user_id 
    AND c.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM user_condominiums uc
    JOIN condominiums c ON c.id = uc.condominium_id
    WHERE uc.user_id = profiles.user_id 
    AND c.owner_id = auth.uid()
  )
);
-- Add INSERT policy for subscriptions table
-- Condominium owners need to be able to create subscriptions when creating condominiums

CREATE POLICY "Condominium owners can insert subscription"
ON public.subscriptions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM condominiums c 
    WHERE c.id = subscriptions.condominium_id 
    AND c.owner_id = auth.uid()
  )
);
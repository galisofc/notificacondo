
-- Allow porters to view the subscription of condominiums they are assigned to
CREATE POLICY "Porteiros can view subscription of assigned condominium"
ON public.subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_condominiums uc
    WHERE uc.user_id = auth.uid()
      AND uc.condominium_id = subscriptions.condominium_id
  )
);

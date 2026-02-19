CREATE POLICY "Porteiros can view profiles of co-workers in same condominium"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_condominiums uc1
      JOIN public.user_condominiums uc2 ON uc1.condominium_id = uc2.condominium_id
      WHERE uc1.user_id = auth.uid()
        AND uc2.user_id = profiles.user_id
        AND has_role(auth.uid(), 'porteiro'::app_role)
    )
  );
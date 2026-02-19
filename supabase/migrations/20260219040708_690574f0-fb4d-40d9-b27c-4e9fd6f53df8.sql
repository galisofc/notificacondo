CREATE POLICY "Porteiros can view WABA logs of assigned condominiums"
  ON public.whatsapp_notification_logs
  FOR SELECT
  USING (
    user_belongs_to_condominium(auth.uid(), condominium_id)
  );
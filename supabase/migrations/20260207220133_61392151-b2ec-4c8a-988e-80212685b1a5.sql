
CREATE POLICY "Super admins can delete WABA logs"
  ON public.whatsapp_notification_logs
  FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete party hall notifications"
  ON public.party_hall_notifications
  FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role));

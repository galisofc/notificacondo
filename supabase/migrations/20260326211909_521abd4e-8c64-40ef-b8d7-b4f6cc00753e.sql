
-- Add timestamp columns to whatsapp_notification_logs
ALTER TABLE public.whatsapp_notification_logs 
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Add accepted_at to notifications_sent
ALTER TABLE public.notifications_sent 
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

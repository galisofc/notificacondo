-- Add notification tracking fields to packages table
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS notification_sent boolean DEFAULT false;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS notification_sent_at timestamp with time zone;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS notification_count integer DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.packages.notification_sent IS 'Whether at least one notification was sent for this package';
COMMENT ON COLUMN public.packages.notification_sent_at IS 'Timestamp of the last notification sent';
COMMENT ON COLUMN public.packages.notification_count IS 'Number of residents notified';
-- Add column to support official WhatsApp API (WABA) via Z-PRO
ALTER TABLE public.whatsapp_config 
ADD COLUMN IF NOT EXISTS use_official_api BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.whatsapp_config.use_official_api IS 'When true, uses official WABA endpoints (SendMessageAPIText, SendMessageAPIFileURL) instead of unofficial endpoints (/params, /url)';
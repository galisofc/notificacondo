-- Add button_config column to whatsapp_templates for storing action button configuration
ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS button_config JSONB DEFAULT NULL;

-- Add a comment to document the structure
COMMENT ON COLUMN public.whatsapp_templates.button_config IS 'Configuration for interactive buttons. Structure: { type: "url"|"quick_reply"|"call", text: string, url_base?: string, has_dynamic_suffix?: boolean }';
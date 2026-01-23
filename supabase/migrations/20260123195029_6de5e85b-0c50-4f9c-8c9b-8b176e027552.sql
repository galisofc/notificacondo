-- Add WABA template fields to whatsapp_templates table
ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS waba_template_name TEXT,
ADD COLUMN IF NOT EXISTS waba_language TEXT DEFAULT 'pt_BR',
ADD COLUMN IF NOT EXISTS params_order TEXT[];

-- Add WABA toggle to whatsapp_config table
ALTER TABLE public.whatsapp_config 
ADD COLUMN IF NOT EXISTS use_waba_templates BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.whatsapp_templates.waba_template_name IS 'Nome do template aprovado na Meta/WABA';
COMMENT ON COLUMN public.whatsapp_templates.waba_language IS 'Código de idioma do template WABA (ex: pt_BR, en, es)';
COMMENT ON COLUMN public.whatsapp_templates.params_order IS 'Ordem das variáveis para o array params do endpoint /templateBody';
COMMENT ON COLUMN public.whatsapp_config.use_waba_templates IS 'Quando true, usa endpoint /templateBody com templates WABA em vez de texto livre';
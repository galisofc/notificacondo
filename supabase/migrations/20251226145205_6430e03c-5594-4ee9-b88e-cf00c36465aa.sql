-- Adicionar coluna app_url na tabela whatsapp_config para configurar a URL base do sistema
ALTER TABLE public.whatsapp_config 
ADD COLUMN IF NOT EXISTS app_url TEXT DEFAULT 'https://notificacondo.com.br';

-- Comentário para documentar a coluna
COMMENT ON COLUMN public.whatsapp_config.app_url IS 'URL base do sistema para gerar links de acesso do morador';
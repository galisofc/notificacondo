-- Permitir que síndicos vejam logs de WABA dos seus condomínios
-- Precisamos adicionar uma coluna condominium_id na tabela whatsapp_notification_logs

-- Adicionar coluna condominium_id
ALTER TABLE public.whatsapp_notification_logs 
ADD COLUMN condominium_id uuid REFERENCES public.condominiums(id);

-- Criar índice para performance
CREATE INDEX idx_whatsapp_notification_logs_condominium_id 
ON public.whatsapp_notification_logs(condominium_id);

-- Criar policy para síndicos visualizarem logs dos seus condomínios
CREATE POLICY "Sindicos can view their condominium WABA logs"
ON public.whatsapp_notification_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM condominiums c
    WHERE c.id = whatsapp_notification_logs.condominium_id
    AND c.owner_id = auth.uid()
  )
);
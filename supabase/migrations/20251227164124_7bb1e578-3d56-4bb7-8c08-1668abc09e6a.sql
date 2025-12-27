-- Create table for WhatsApp message templates
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage templates
CREATE POLICY "Super admins can manage templates"
ON public.whatsapp_templates
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.whatsapp_templates (slug, name, description, content, variables) VALUES
(
  'notification_occurrence',
  'Notificação de Ocorrência',
  'Enviado ao morador quando uma nova ocorrência é registrada',
  '🏢 *{condominio}*

Olá, *{nome}*!

Você recebeu uma *{tipo}*:
📋 *{titulo}*

Acesse o link abaixo para ver os detalhes e apresentar sua defesa:
👉 {link}

Este link é pessoal e intransferível.',
  ARRAY['nome', 'tipo', 'titulo', 'condominio', 'link']
),
(
  'decision_archived',
  'Decisão: Arquivada',
  'Enviado quando a ocorrência é arquivada',
  '✅ *DECISÃO: ARQUIVADA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua defesa referente à ocorrência "{titulo}" foi analisada.

📋 *Decisão:* ARQUIVADA

Sua defesa foi aceita e a ocorrência foi arquivada. Nenhuma penalidade será aplicada.

💬 *Justificativa:*
{justificativa}

Acesse o sistema para mais detalhes:
👉 {link}',
  ARRAY['nome', 'titulo', 'condominio', 'justificativa', 'link']
),
(
  'decision_warning',
  'Decisão: Advertência',
  'Enviado quando uma advertência é aplicada',
  '⚠️ *DECISÃO: ADVERTÊNCIA APLICADA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua defesa referente à ocorrência "{titulo}" foi analisada.

📋 *Decisão:* ADVERTÊNCIA APLICADA

Após análise da sua defesa, foi decidido aplicar uma advertência formal.

💬 *Justificativa:*
{justificativa}

Acesse o sistema para mais detalhes:
👉 {link}',
  ARRAY['nome', 'titulo', 'condominio', 'justificativa', 'link']
),
(
  'decision_fine',
  'Decisão: Multa',
  'Enviado quando uma multa é aplicada',
  '🚨 *DECISÃO: MULTA APLICADA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua defesa referente à ocorrência "{titulo}" foi analisada.

📋 *Decisão:* MULTA APLICADA

Após análise da sua defesa, foi decidido aplicar uma multa. Verifique os detalhes no sistema.

💬 *Justificativa:*
{justificativa}

Acesse o sistema para mais detalhes:
👉 {link}',
  ARRAY['nome', 'titulo', 'condominio', 'justificativa', 'link']
),
(
  'notify_sindico_defense',
  'Aviso ao Síndico: Nova Defesa',
  'Enviado ao síndico quando um morador envia uma defesa',
  '📋 *Nova Defesa Recebida*

🏢 *{condominio}*

O morador *{nome_morador}* enviou uma defesa para a ocorrência:

📝 *{titulo}*
Tipo: {tipo}

Acesse o sistema para analisar:
👉 {link}',
  ARRAY['nome_morador', 'tipo', 'titulo', 'condominio', 'link']
);
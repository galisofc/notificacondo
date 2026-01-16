-- Inserir template de encomendas no WhatsApp templates
INSERT INTO public.whatsapp_templates (name, slug, content, description, variables, is_active)
VALUES (
  'Notificação de Encomenda',
  'package_arrival',
  '📦 *Nova Encomenda!*

🏢 *{condominio}*

Olá, *{nome}*!

Você tem uma encomenda aguardando na portaria.

🏠 *Destino:* Bloco {bloco}, Apto {apartamento}
🔑 *Código de retirada:* {codigo}

Apresente este código na portaria para retirar sua encomenda.

_Mensagem automática - NotificaCondo_',
  'Mensagem enviada aos moradores quando uma encomenda é registrada na portaria',
  ARRAY['nome', 'condominio', 'bloco', 'apartamento', 'codigo'],
  true
)
ON CONFLICT (slug) DO UPDATE SET
  content = EXCLUDED.content,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  updated_at = now();
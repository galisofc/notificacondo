-- Insert default WhatsApp template for package arrival notification
INSERT INTO public.whatsapp_templates (name, slug, content, description, variables, is_active)
VALUES (
  'Chegada de Encomenda',
  'package_arrival',
  '📦 *Nova Encomenda!*

Olá, *{nome}*!

Você tem uma encomenda aguardando na portaria do *{condominio}*.

🏠 *Destino:* Bloco {bloco}, Apto {apartamento}
🔑 *Código de retirada:* {codigo}

Apresente este código na portaria para retirar sua encomenda.

_Mensagem automática - NotificaCondo_',
  'Notificação enviada ao morador quando uma encomenda é registrada na portaria',
  ARRAY['nome', 'condominio', 'bloco', 'apartamento', 'codigo'],
  true
)
ON CONFLICT (slug) DO NOTHING;
-- Atualizar template de encomendas com tipo e código de rastreio
UPDATE public.whatsapp_templates 
SET 
  content = '📦 *Nova Encomenda!*

🏢 *{condominio}*

Olá, *{nome}*!

Você tem uma encomenda aguardando na portaria.

📋 *Tipo:* {tipo_encomenda}
📍 *Rastreio:* {codigo_rastreio}
🏠 *Destino:* Bloco {bloco}, Apto {apartamento}
🔑 *Código de retirada:* {codigo}

Apresente este código na portaria para retirar sua encomenda.

_Mensagem automática - NotificaCondo_',
  variables = ARRAY['nome', 'condominio', 'bloco', 'apartamento', 'codigo', 'tipo_encomenda', 'codigo_rastreio'],
  updated_at = now()
WHERE slug = 'package_arrival';
-- Insert trial notification templates
INSERT INTO public.whatsapp_templates (slug, name, description, content, variables, is_active)
VALUES 
(
  'trial_ending',
  'Trial Expirando',
  'Notificação enviada quando o período de trial está acabando',
  '⏰ *Seu Período de Teste está Acabando!*

🏢 *{condominio}*

Olá, *{nome}*!

Seu período de teste gratuito do Condomínio Legal termina em *{dias_restantes}*.

📅 *Data de expiração:* {data_expiracao}

Para continuar utilizando todos os recursos da plataforma, assine um de nossos planos:
👉 {link_planos}

Não perca acesso a:
✅ Notificações automatizadas
✅ Gestão de ocorrências  
✅ Controle de multas e advertências

Qualquer dúvida, estamos à disposição!',
  ARRAY['condominio', 'nome', 'dias_restantes', 'data_expiracao', 'link_planos'],
  true
),
(
  'trial_expired',
  'Trial Expirado',
  'Notificação enviada quando o período de trial expirou',
  '🔔 *Seu Período de Teste Expirou*

🏢 *{condominio}*

Olá, *{nome}*!

Seu período de teste gratuito do Condomínio Legal *expirou em {data_expiracao}*.

Para continuar utilizando a plataforma, assine um de nossos planos:
👉 {link_planos}

📦 *Planos disponíveis:*
• Start - Ideal para pequenos condomínios
• Essencial - Recursos completos
• Profissional - Sem limites

Esperamos você de volta! 💙',
  ARRAY['condominio', 'nome', 'data_expiracao', 'link_planos'],
  true
),
(
  'trial_welcome',
  'Boas-vindas Trial',
  'Mensagem de boas-vindas para novos trials',
  '🎉 *Bem-vindo ao Condomínio Legal!*

🏢 *{condominio}*

Olá, *{nome}*!

Seu período de teste de *7 dias* começou!

📅 *Expira em:* {data_expiracao}

Durante o trial você tem acesso a:
✅ Até 10 notificações
✅ Até 10 advertências  
✅ Sistema completo de ocorrências

Acesse agora e explore:
👉 {link_dashboard}

Qualquer dúvida, estamos aqui para ajudar!',
  ARRAY['condominio', 'nome', 'data_expiracao', 'link_dashboard'],
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  content = EXCLUDED.content,
  variables = EXCLUDED.variables;
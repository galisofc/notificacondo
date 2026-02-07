

# Script SQL de Sincronizacao Completa - whatsapp_templates

Execute o script abaixo no **SQL Editor** do Supabase externo. Ele faz:
- **UPDATE** nos 10 templates existentes (corrigindo `params_order`, `variables`, `content`, `button_config`, `description`)
- **INSERT** dos 6 templates ausentes

---

## Script SQL

```sql
-- =====================================================
-- 1. UPDATES - Corrigir templates existentes
-- =====================================================

-- decision_archived: OK (params_order ja esta correto)
-- Apenas garantir description
UPDATE whatsapp_templates SET
  description = 'Enviado quando a ocorrência é arquivada'
WHERE slug = 'decision_archived';

-- decision_fine: params_order NULL -> corrigir
UPDATE whatsapp_templates SET
  params_order = NULL,
  description = 'Enviado quando uma multa é aplicada'
WHERE slug = 'decision_fine';

-- decision_warning: params_order divergente
UPDATE whatsapp_templates SET
  params_order = ARRAY['condominio','nome','titulo','justificativa','link'],
  description = 'Enviado quando uma advertência é aplicada'
WHERE slug = 'decision_warning';

-- notification_occurrence: params_order e button_config divergentes
UPDATE whatsapp_templates SET
  params_order = ARRAY['condominio','nome','tipo','titulo'],
  button_config = '[{"text":"Acessar Ocorrência","type":"url","url_base":"https://notificacondo.com.br/acesso/","has_dynamic_suffix":true}]'::jsonb,
  waba_template_name = 'aviso_nova_ocorrencia_2',
  description = 'Enviado ao morador quando uma nova ocorrência é registrada'
WHERE slug = 'notification_occurrence';

-- notify_sindico_defense: params_order NULL -> corrigir
UPDATE whatsapp_templates SET
  params_order = ARRAY['nome_morador','tipo','titulo','condominio','link'],
  description = 'Enviado ao síndico quando um morador envia uma defesa'
WHERE slug = 'notify_sindico_defense';

-- package_arrival: ja corrigido, apenas atualizar variables e content
UPDATE whatsapp_templates SET
  variables = ARRAY['nome','condominio','bloco','apartamento','tipo_encomenda','codigo_rastreio','porteiro','numeropedido'],
  content = E'📦 *Nova Encomenda!*\n\n🏢 *{condominio}*\n\nOlá, *{nome}*!\n\nVocê tem uma encomenda aguardando na portaria.\n\n🏠 *Destino:* {bloco}, APTO {apartamento}\n📋 *Tipo:* {tipo_encomenda}\n📍 *Rastreio:* {codigo_rastreio}\n🧑‍💼 *Recebido por:* {porteiro}\n🔑 *Código de retirada:* {numeropedido}\n\nApresente este código na portaria para retirar sua encomenda.\n\n`Mensagem automática - NotificaCondo`',
  description = 'Mensagem enviada aos moradores quando uma encomenda é registrada na portaria'
WHERE slug = 'package_arrival';

-- party_hall_reminder: params_order NULL e variables faltando checklist
UPDATE whatsapp_templates SET
  params_order = ARRAY['condominio','nome','espaco','data','horario_inicio','horario_fim','checklist'],
  variables = ARRAY['condominio','nome','espaco','data','horario_inicio','horario_fim','checklist'],
  content = E'🎉 *LEMBRETE DE RESERVA*\n\n🏢 *{condominio}*\n\nOlá, *{nome}*!\n\nSua reserva do *{espaco}* está confirmada para:\n📅 *Data:* {data}\n⏰ *Horário:* {horario_inicio} às {horario_fim}\n\n{checklist}\n\n📋 *Lembre-se:*\n• Respeite as regras do espaço\n\nEm caso de dúvidas, entre em contato com a administração.\n\nBoa festa! 🎊',
  description = 'Notificação enviada ao morador lembrando da reserva do salão de festas'
WHERE slug = 'party_hall_reminder';

-- trial_ending: apenas description
UPDATE whatsapp_templates SET
  description = 'Notificação enviada quando o período de trial está acabando'
WHERE slug = 'trial_ending';

-- trial_expired: apenas description
UPDATE whatsapp_templates SET
  description = 'Notificação enviada quando o período de trial expirou'
WHERE slug = 'trial_expired';

-- trial_welcome: atualizar variables (faltam campos) e params_order
UPDATE whatsapp_templates SET
  variables = ARRAY['condominio','nome','dias_trial','data_expiracao','limite_notificacoes','limite_advertencias','limite_multas','link_dashboard'],
  params_order = ARRAY['condominio','nome','dias_trial','data_expiracao','limite_notificacoes','limite_advertencias','limite_multas','link_dashboard'],
  description = 'Mensagem de boas-vindas para novos trials'
WHERE slug = 'trial_welcome';

-- =====================================================
-- 2. INSERTS - Templates ausentes
-- =====================================================

-- condominium_transfer
INSERT INTO whatsapp_templates (slug, name, description, content, variables, waba_template_name, waba_language, params_order, is_active) VALUES (
  'condominium_transfer',
  'Transferência de Condomínio',
  'Enviado ao novo síndico quando um condomínio é transferido para ele',
  E'Olá, *{nome_novo_sindico}*!\n\nO condomínio *{condominio}* foi transferido para sua gestão.\n\n📋 *Detalhes da transferência:*\n• *Síndico anterior:* {nome_antigo_sindico}\n• *Data:* {data_transferencia}\n{observacoes}\n\nAcesse o sistema para gerenciar seu novo condomínio.\n\nBem-vindo(a) à gestão do condomínio!',
  ARRAY['nome_novo_sindico','condominio','nome_antigo_sindico','data_transferencia','observacoes','link'],
  'condominium_transfer_old_owner',
  'pt_BR',
  ARRAY['nome_novo_sindico','condominio','nome_antigo_sindico','data_transferencia','observacoes','link'],
  true
);

-- condominium_transfer_old_owner
INSERT INTO whatsapp_templates (slug, name, description, content, variables, waba_template_name, waba_language, params_order, is_active) VALUES (
  'condominium_transfer_old_owner',
  'Transferência de Condomínio - Síndico Anterior',
  'Enviado ao síndico anterior quando um condomínio é transferido para outro síndico',
  E'🔄 *TRANSFERÊNCIA DE CONDOMÍNIO*\n\nOlá, *{nome_antigo_sindico}*!\n\nO condomínio *{condominio}* foi transferido da sua gestão.\n\n📋 *Detalhes da transferência:*\n• Novo síndico: {nome_novo_sindico}\n• Data: {data_transferencia}\n{observacoes}\n\nAgradecemos pelo seu trabalho na gestão do condomínio!\n\nEm caso de dúvidas, entre em contato com o suporte.',
  ARRAY['nome_antigo_sindico','condominio','nome_novo_sindico','data_transferencia','observacoes'],
  'condominium_transfer_old_owner',
  'pt_BR',
  NULL,
  true
);

-- invoice_generated
INSERT INTO whatsapp_templates (slug, name, description, content, variables, waba_template_name, waba_language, params_order, is_active) VALUES (
  'invoice_generated',
  'Fatura Gerada',
  'Enviado ao síndico quando uma nova fatura é gerada',
  E'📄 *Nova Fatura Gerada*\n\n🏢 *{condominio}*\n\nOlá, *{nome}*!\n\nUma nova fatura foi gerada para o seu condomínio:\n\n📋 *Detalhes:*\n• Número: {numero_fatura}\n• Período: {periodo}\n• Valor: *{valor}*\n• Vencimento: *{data_vencimento}*\n\nAcesse o sistema para visualizar e efetuar o pagamento:\n👉 {link}\n\n💡 Pague via PIX para confirmação instantânea!',
  ARRAY['condominio','nome','numero_fatura','periodo','valor','data_vencimento','link'],
  'invoice_generated',
  'pt_BR',
  NULL,
  true
);

-- party_hall_cancelled
INSERT INTO whatsapp_templates (slug, name, description, content, variables, waba_template_name, waba_language, params_order, is_active) VALUES (
  'party_hall_cancelled',
  'Reserva Cancelada do Salão',
  'Notificação enviada ao morador quando a reserva do salão de festas é cancelada',
  E'❌ *RESERVA CANCELADA*\n\n🏢 *{condominio}*\n\nOlá, *{nome}*!\n\nInformamos que sua reserva do *{espaco}* foi cancelada.\n\n📅 *Data:* {data}\n⏰ *Horário:* {horario_inicio} às {horario_fim}\n\nSe você não solicitou este cancelamento ou tem dúvidas, entre em contato com a administração.\n\nAtenciosamente,\nEquipe {condominio}',
  ARRAY['condominio','nome','espaco','data','horario_inicio','horario_fim'],
  'party_hall_cancelled',
  'pt_BR',
  ARRAY['condominio','nome','espaco','data','horario_inicio','horario_fim'],
  true
);

-- payment_confirmed
INSERT INTO whatsapp_templates (slug, name, description, content, variables, waba_template_name, waba_language, params_order, is_active) VALUES (
  'payment_confirmed',
  'Pagamento Confirmado',
  'Enviado ao síndico quando um pagamento é confirmado',
  E'💰 *Pagamento Confirmado!*\n\n🏢 *{condominio}*\n\nOlá, *{nome}*!\n\nUm pagamento foi confirmado:\n📋 Fatura: {descricao_fatura}\n💳 Método: *{metodo_pagamento}*\n💵 Valor: *{valor}*\n📅 Data: {data_pagamento}\n\n✅ A fatura foi marcada como paga automaticamente.',
  ARRAY['condominio','nome','descricao_fatura','metodo_pagamento','valor','data_pagamento'],
  'payment_confirmed',
  'pt_BR',
  NULL,
  true
);

-- resend_porter_credentials
INSERT INTO whatsapp_templates (slug, name, description, content, variables, waba_template_name, waba_language, params_order, is_active) VALUES (
  'resend_porter_credentials',
  'Reenvio de Credenciais do Porteiro',
  'Template para enviar credenciais de acesso aos porteiros via WhatsApp',
  E'🔐 *Credenciais de Acesso*\n\n🏢 *{condominio}*\n\nOlá, *{nome}*!\n\nSuas credenciais de acesso ao sistema foram geradas:\n\n📧 *E-mail:* {email}\n🔑 *Senha:* {senha}\n\nAcesse o sistema através do link:\n👉 {link}\n\n⚠️ *Importante:* Recomendamos que você altere sua senha após o primeiro acesso.\n\n_Mensagem automática - NotificaCondo_',
  ARRAY['condominio','nome','email','senha','link'],
  NULL,
  NULL,
  ARRAY['condominio','nome','email','senha','link'],
  true
);
```

---

## Resumo das alteracoes

| Template | Acao | O que muda |
|----------|------|------------|
| `decision_warning` | UPDATE | `params_order` corrigido para ordem correta |
| `notification_occurrence` | UPDATE | `params_order` corrigido (4 params body), `waba_template_name` atualizado |
| `notify_sindico_defense` | UPDATE | `params_order` adicionado (era NULL) |
| `package_arrival` | UPDATE | `variables` corrigido (8 campos), `content` atualizado |
| `party_hall_reminder` | UPDATE | `params_order` e `variables` com `checklist` adicionado |
| `trial_welcome` | UPDATE | `variables` e `params_order` completos (8 campos) |
| `condominium_transfer` | INSERT | Template novo |
| `condominium_transfer_old_owner` | INSERT | Template novo |
| `invoice_generated` | INSERT | Template novo |
| `party_hall_cancelled` | INSERT | Template novo |
| `payment_confirmed` | INSERT | Template novo |
| `resend_porter_credentials` | INSERT | Template novo |

Apos executar o script, todas as notificacoes WhatsApp do servidor externo estarao sincronizadas com o Lovable Cloud.


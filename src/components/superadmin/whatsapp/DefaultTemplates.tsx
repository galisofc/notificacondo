export const DEFAULT_TEMPLATES: Record<string, string> = {
  notification_occurrence: `🏢 *{condominio}*

Olá, *{nome}*!

Você recebeu uma *{tipo}*:
📋 *{titulo}*

Acesse o link abaixo para ver os detalhes e apresentar sua defesa:
👉 {link}

Este link é pessoal e intransferível.`,
  decision_archived: `✅ *DECISÃO: ARQUIVADA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua defesa referente à ocorrência "{titulo}" foi analisada.

📋 *Decisão:* ARQUIVADA

Sua defesa foi aceita e a ocorrência foi arquivada. Nenhuma penalidade será aplicada.

💬 *Justificativa:*
{justificativa}

Acesse o sistema para mais detalhes:
👉 {link}`,
  decision_warning: `⚠️ *DECISÃO: ADVERTÊNCIA APLICADA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua defesa referente à ocorrência "{titulo}" foi analisada.

📋 *Decisão:* ADVERTÊNCIA APLICADA

Após análise da sua defesa, foi decidido aplicar uma advertência formal.

💬 *Justificativa:*
{justificativa}

Acesse o sistema para mais detalhes:
👉 {link}`,
  decision_fine: `🚨 *DECISÃO: MULTA APLICADA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua defesa referente à ocorrência "{titulo}" foi analisada.

📋 *Decisão:* MULTA APLICADA

Após análise da sua defesa, foi decidido aplicar uma multa. Verifique os detalhes no sistema.

💬 *Justificativa:*
{justificativa}

Acesse o sistema para mais detalhes:
👉 {link}`,
  notify_sindico_defense: `📋 *Nova Defesa Recebida*

🏢 *{condominio}*

O morador *{nome_morador}* enviou uma defesa para a ocorrência:

📝 *{titulo}*
Tipo: {tipo}

Acesse o sistema para analisar:
👉 {link}`,
  trial_ending: `⏰ *Seu Período de Teste está Acabando!*

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

Qualquer dúvida, estamos à disposição!`,
  trial_expired: `🔔 *Seu Período de Teste Expirou*

🏢 *{condominio}*

Olá, *{nome}*!

Seu período de teste gratuito do Condomínio Legal *expirou em {data_expiracao}*.

Para continuar utilizando a plataforma, assine um de nossos planos:
👉 {link_planos}

📦 *Planos disponíveis:*
• Start - Ideal para pequenos condomínios
• Essencial - Recursos completos
• Profissional - Sem limites

Esperamos você de volta! 💙`,
  trial_welcome: `🎉 *Bem-vindo ao Condomínio Legal!*

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

Qualquer dúvida, estamos aqui para ajudar!`,
  condominium_transfer: `🔄 *TRANSFERÊNCIA DE CONDOMÍNIO*

Olá, *{nome_novo_sindico}*!

O condomínio *{condominio}* foi transferido para sua gestão.

📋 *Detalhes da transferência:*
• Síndico anterior: {nome_antigo_sindico}
• Data: {data_transferencia}
{observacoes}

Acesse o sistema para gerenciar seu novo condomínio:
👉 {link}

Bem-vindo(a) à gestão do condomínio!`,
  condominium_transfer_old_owner: `🔄 *TRANSFERÊNCIA DE CONDOMÍNIO*

Olá, *{nome_antigo_sindico}*!

O condomínio *{condominio}* foi transferido da sua gestão.

📋 *Detalhes da transferência:*
• Novo síndico: {nome_novo_sindico}
• Data: {data_transferencia}
{observacoes}

Agradecemos pelo seu trabalho na gestão do condomínio!

Em caso de dúvidas, entre em contato com o suporte.`,
  payment_confirmed: `💰 *Pagamento Confirmado!*

🏢 *{condominio}*

Olá, *{nome}*!

Um pagamento foi confirmado:
📋 Fatura: {descricao_fatura}
💳 Método: *{metodo_pagamento}*
💵 Valor: *{valor}*
📅 Data: {data_pagamento}

✅ A fatura foi marcada como paga automaticamente.`,
  invoice_generated: `📄 *Nova Fatura Gerada*

🏢 *{condominio}*

Olá, *{nome}*!

Uma nova fatura foi gerada para o seu condomínio:

📋 *Detalhes:*
• Número: {numero_fatura}
• Período: {periodo}
• Valor: *{valor}*
• Vencimento: *{data_vencimento}*

Acesse o sistema para visualizar e efetuar o pagamento:
👉 {link}

💡 Pague via PIX para confirmação instantânea!`,
  party_hall_reminder: `🎉 *LEMBRETE DE RESERVA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua reserva do *{espaco}* está confirmada para:
📅 *Data:* {data}
⏰ *Horário:* {horario_inicio} às {horario_fim}

{checklist}

📋 *Lembre-se:*
• Compareça no horário para o checklist de entrada
• Respeite as regras do espaço

Em caso de dúvidas, entre em contato com a administração.

Boa festa! 🎊`,
  party_hall_cancelled: `❌ *RESERVA CANCELADA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua reserva do *{espaco}* foi cancelada:
📅 *Data:* {data}
⏰ *Horário:* {horario_inicio} às {horario_fim}

Em caso de dúvidas, entre em contato com a administração.

Atenciosamente,
Equipe {condominio}`,
  package_arrival: `📦 *Nova Encomenda!*

🏢 *{condominio}*

Olá, *{nome}*!

Você tem uma encomenda aguardando na portaria.

🏠 *Destino:* BLOCO {bloco}, APTO {apartamento}
📋 *Tipo:* {tipo_encomenda}
📍 *Rastreio:* {codigo_rastreio}
🧑‍💼 *Recebido por:* {porteiro}
🔑 *Código de retirada:* {numeropedido}

Apresente este código na portaria para retirar sua encomenda.

_Mensagem automática - NotificaCondo_`,
  resend_porter_credentials: `🔐 *Credenciais de Acesso*

🏢 *{condominio}*

Olá, *{nome}*!

Suas credenciais de acesso ao sistema foram geradas:

📧 *E-mail:* {email}
🔑 *Senha:* {senha}

Acesse o sistema através do link:
👉 {link}

⚠️ *Importante:* Recomendamos que você altere sua senha após o primeiro acesso.

_Mensagem automática - NotificaCondo_`,
};

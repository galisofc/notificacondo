
Objetivo: corrigir o falso positivo de “enviado” no WhatsApp.

Diagnóstico que confirmei:
- O envio recente da ocorrência retornou `HTTP 200` com `message_status: "accepted"` para o template `aviso_nova_ocorrencia_2`.
- O sistema grava isso imediatamente como sucesso (`notifications_sent.zpro_status = "sent"`) e a UI mostra mensagem de êxito.
- Não há logs recentes da função `whatsapp-webhook`.
- Os registros atuais em `webhook_raw_logs` são payloads de teste/exemplo da Meta e não correspondem aos `message_id` reais enviados agora.
- Resultado: hoje o sistema sabe apenas que a Meta aceitou a requisição, mas não confirma entrega ao morador.

Causa provável:
1. `accepted` está sendo tratado como “mensagem enviada ao morador”.
2. O webhook real de status não está chegando nesta instância.
3. O arquivo `whatsapp-webhook/index.ts` tenta atualizar `whatsapp_notification_logs.status`, mas esse campo não existe no schema atual, então esse trecho já está inconsistente.

Plano de correção:
1. Ajustar o significado dos status no backend
- Em `supabase/functions/send-whatsapp-notification/index.ts`, salvar status inicial como `accepted` (ou `queued`), não `sent`.
- Manter `message_id`, payload e resposta da Meta para auditoria.
- Aplicar o mesmo padrão aos demais envios WABA que hoje consideram `200/accepted` como entrega concluída.

2. Corrigir o webhook de confirmação
- Em `supabase/functions/whatsapp-webhook/index.ts`, continuar atualizando `notifications_sent` pelo `zpro_message_id`.
- Corrigir o update em `whatsapp_notification_logs`:
  - opção recomendada: criar coluna `status` via migração e usar `accepted/delivered/read/failed`;
  - alternativa mínima: remover esse update quebrado e usar apenas `notifications_sent`.
- Persistir erros de status da Meta (`failed`, códigos, títulos) para facilitar diagnóstico real.

3. Corrigir a UI para não prometer entrega antes da hora
- Em `src/pages/OccurrenceDetails.tsx`, trocar o toast de:
  - “O morador foi notificado via WhatsApp com sucesso”
  por algo como:
  - “Mensagem aceita pela Meta. A entrega será confirmada pelo webhook.”
- Exibir status real:
  - `accepted` = Aceito pela Meta
  - `delivered` = Entregue
  - `read` = Lido
  - `failed` = Falhou
- Atualizar telas de monitoramento para refletirem esse fluxo real, especialmente:
  - `src/components/notifications/NotificationsMonitor.tsx`
  - `src/pages/superadmin/WabaLogs.tsx`

4. Validar a causa operacional fora do código
- Conferir na Meta se o callback URL ativo aponta para a função `whatsapp-webhook` desta instância.
- Confirmar que os eventos de `messages/message_status` estão assinados no app/número correto.
- Repetir um envio de teste e verificar se o mesmo `wamid` aparece no webhook e atualiza `delivered_at/read_at`.

Arquivos envolvidos:
- `supabase/functions/send-whatsapp-notification/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts`
- `src/pages/OccurrenceDetails.tsx`
- `src/components/notifications/NotificationsMonitor.tsx`
- `src/pages/superadmin/WabaLogs.tsx`
- migração para `whatsapp_notification_logs.status` (recomendado)

Critério de sucesso:
- o sistema para de mostrar “enviado” quando a Meta apenas aceitou a mensagem;
- o webhook passa a receber os callbacks reais;
- os envios passam a evoluir corretamente entre `accepted`, `delivered`, `read` e `failed`.

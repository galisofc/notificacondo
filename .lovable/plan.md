

## Plano: Indicador visual de status de entrega no PackageDetailsDialog

### Objetivo
Mostrar o status de entrega em tempo real (accepted → sent → delivered → read) para cada notificação nos detalhes da encomenda, usando um stepper visual com ícones.

### Mudanças

#### `src/components/packages/PackageDetailsDialog.tsx`

1. **Atualizar a interface `NotificationLog`** para incluir o campo `status` (que já é atualizado pelo webhook com valores: accepted, sent, delivered, read, failed).

2. **Atualizar a query** de `fetchNotificationLogs` para incluir `status` no select.

3. **Adicionar realtime subscription** no `package_id` para que o status atualize automaticamente quando o webhook receber callbacks da Meta.

4. **Criar componente inline `DeliveryStatusTracker`** — um stepper horizontal com 4 etapas:
   - **Aceita** (accepted) — ícone check, cor azul
   - **Enviada** (sent) — ícone send, cor azul
   - **Entregue** (delivered) — ícone check duplo, cor verde
   - **Lida** (read) — ícone eye, cor verde

   Cada etapa mostra ativo/inativo conforme o status atual. Se `failed`, mostra indicador vermelho.

5. **Renderizar o tracker** dentro de cada card de log de notificação, abaixo da data/hora, substituindo o texto simples "Enviada com sucesso" por este indicador visual progressivo.

### Detalhes Técnicos

- O campo `whatsapp_notification_logs.status` já recebe updates do webhook (`accepted` → `sent` → `delivered` → `read`)
- Realtime: subscribe no canal `whatsapp_notification_logs` filtrando por `package_id` para atualizar o stepper sem refresh manual
- O stepper usa uma lógica de progressão: `const steps = ['accepted','sent','delivered','read']` e `currentIndex = steps.indexOf(status)` para determinar quais etapas estão ativas

### Arquivos Afetados
- `src/components/packages/PackageDetailsDialog.tsx`


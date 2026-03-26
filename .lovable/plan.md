

## Plano: Tooltips com horários no DeliveryStatusTracker

### Objetivo
Ao passar o mouse sobre cada etapa do stepper (Aceita, Enviada, Entregue, Lida), mostrar um tooltip com a data/hora exata em que aquele status foi registrado.

### Problema atual
As tabelas não armazenam timestamps individuais por status:
- `whatsapp_notification_logs`: tem apenas `status` e `created_at`
- `notifications_sent`: tem `sent_at`, `delivered_at`, `read_at` mas falta `accepted_at`

### Mudanças

#### 1. Migração SQL — Adicionar colunas de timestamps

**`whatsapp_notification_logs`**: adicionar `accepted_at`, `sent_at`, `delivered_at`, `read_at` (timestamp nullable)

**`notifications_sent`**: adicionar `accepted_at` (timestamp nullable)

#### 2. Webhook — Salvar timestamps por status

**`supabase/functions/whatsapp-webhook/index.ts`**

Ao receber cada status callback da Meta, salvar o `now` na coluna correspondente:
- `accepted` → `accepted_at = now`
- `sent` → `sent_at = now`
- `delivered` → `delivered_at = now`
- `read` → `read_at = now`

Aplicar em ambas as tabelas (`notifications_sent` e `whatsapp_notification_logs`).

#### 3. DeliveryStatusTracker — Aceitar e exibir timestamps

**`src/components/packages/DeliveryStatusTracker.tsx`**

- Adicionar prop opcional `timestamps` com shape `{ accepted_at?, sent_at?, delivered_at?, read_at? }`
- Envolver cada ícone do stepper com `Tooltip` (do radix/shadcn)
- O tooltip mostra o horário formatado (ex: "26/03/2026 às 14:32") quando a etapa está ativa e o timestamp existe
- Se não houver timestamp, mostrar apenas o label sem tooltip

#### 4. Passar timestamps nos locais de uso

**`src/components/packages/PackageDetailsDialog.tsx`**: incluir os campos de timestamp na query dos logs e passar para o tracker.

**`src/pages/OccurrenceDetails.tsx`**: incluir `accepted_at` na query de `notifications_sent` e passar `{ accepted_at, sent_at, delivered_at, read_at }` para o tracker no timeline.

**`src/components/packages/PackageCard.tsx`**: opcional — nos cards compactos, o tooltip pode não ser necessário (hover em mobile é ruim). Manter sem timestamps nos cards.

### Arquivos afetados
- Nova migração SQL (4 colunas em `whatsapp_notification_logs` + 1 em `notifications_sent`)
- `supabase/functions/whatsapp-webhook/index.ts`
- `src/components/packages/DeliveryStatusTracker.tsx`
- `src/components/packages/PackageDetailsDialog.tsx`
- `src/pages/OccurrenceDetails.tsx`


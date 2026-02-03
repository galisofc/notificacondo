
# Plano: Limite de Notificações de Encomendas com Cobrança Extra

## Resumo do Problema
Atualmente, o sistema possui limites apenas para **notificações de ocorrências**, **advertências** e **multas**. As notificações de encomendas são enviadas sem nenhum controle de limite. O usuário deseja adicionar um limite para notificações de encomendas, com cobrança de R$ 0,10 por notificação excedente.

## Escopo das Alterações

### 1. Banco de Dados

**Tabela `plans`** - Adicionar coluna:
- `package_notifications_limit` (integer, default 50) - Limite de notificações de encomendas por mês

**Tabela `subscriptions`** - Adicionar colunas:
- `package_notifications_limit` (integer, default 50) - Limite herdado do plano
- `package_notifications_used` (integer, default 0) - Contador de uso mensal
- `package_notifications_extra` (integer, default 0) - Notificações extras (acima do limite)

**Tabela `app_settings`** - Adicionar configuração:
- `package_notification_extra_cost` = 0.10 - Custo por notificação extra (R$)

### 2. Interface - Páginas a Alterar

**Página Inicial / Pricing (`src/components/landing/Pricing.tsx`)**
- Adicionar linha mostrando "Notificações de Encomendas: X/mês"

**Página de Planos (`src/pages/Plans.tsx`)**
- Adicionar na seção de limites
- Atualizar tabela comparativa de features

**Página de Autenticação (`src/pages/Auth.tsx`)**
- Mostrar limite de notificações de encomendas no resumo do plano selecionado

**SuperAdmin - Configurações (`src/pages/superadmin/Settings.tsx`)**
- Adicionar campo para editar `package_notifications_limit` nos planos
- Adicionar configuração do custo por notificação extra

**SuperAdmin - Monitor de Assinaturas (`src/components/superadmin/SubscriptionsMonitor.tsx`)**
- Adicionar progress bar para notificações de encomendas
- Mostrar quantidade de notificações extras

**Síndico - Assinaturas (`src/pages/SindicoSubscriptions.tsx`)**
- Mostrar uso de notificações de encomendas
- Alertar quando próximo do limite

**Templates WhatsApp (`src/components/superadmin/whatsapp/DefaultTemplates.tsx`)**
- Atualizar template `trial_welcome` com nova variável `{limite_encomendas}`

### 3. Backend - Edge Functions

**`notify-package-arrival` (`supabase/functions/notify-package-arrival/index.ts`)**
- Buscar subscription do condomínio
- Verificar se está dentro do limite
- Se acima do limite: incrementar `package_notifications_extra`
- Sempre incrementar `package_notifications_used`
- Enviar notificação normalmente (não bloquear, apenas cobrar extra)

**`generate-invoices` (`supabase/functions/generate-invoices/index.ts`)**
- Ao gerar fatura, verificar `package_notifications_extra`
- Calcular valor adicional: `extras * 0.10`
- Adicionar ao valor da fatura
- Zerar contador de extras após gerar fatura

### 4. Fluxo de Negócio

```text
+----------------------------------+
|  Porteiro registra encomenda     |
+----------------------------------+
              |
              v
+----------------------------------+
|  notify-package-arrival          |
|  - Busca subscription            |
|  - Verifica limite               |
+----------------------------------+
              |
    +---------+---------+
    |                   |
    v                   v
+-------------+  +------------------+
| Dentro do   |  | Acima do limite  |
| limite      |  | (+1 extra)       |
+-------------+  +------------------+
    |                   |
    +--------+----------+
             |
             v
+----------------------------------+
|  Incrementa package_notifications|
|  _used e envia notificação      |
+----------------------------------+
              |
              v
+----------------------------------+
|  Fim do mês: generate-invoices   |
|  - Calcula extras * R$0,10       |
|  - Adiciona ao valor da fatura   |
+----------------------------------+
```

### 5. Valores Sugeridos por Plano

| Plano | Limite Encomendas/mês |
|-------|----------------------|
| Start | 20 |
| Essencial | 100 |
| Profissional | 500 |
| Enterprise | Ilimitado (-1) |

---

## Detalhes Técnicos

### Migração SQL

```sql
-- Adicionar coluna aos planos
ALTER TABLE plans ADD COLUMN package_notifications_limit integer NOT NULL DEFAULT 50;

-- Adicionar colunas às assinaturas
ALTER TABLE subscriptions 
  ADD COLUMN package_notifications_limit integer NOT NULL DEFAULT 50,
  ADD COLUMN package_notifications_used integer NOT NULL DEFAULT 0,
  ADD COLUMN package_notifications_extra integer NOT NULL DEFAULT 0;

-- Configuração do custo extra
INSERT INTO app_settings (key, value, description)
VALUES ('package_notification_extra_cost', '0.10', 'Custo por notificação de encomenda acima do limite (R$)');

-- Atualizar planos existentes com limites sugeridos
UPDATE plans SET package_notifications_limit = 20 WHERE slug = 'start';
UPDATE plans SET package_notifications_limit = 100 WHERE slug = 'essencial';
UPDATE plans SET package_notifications_limit = 500 WHERE slug = 'profissional';
UPDATE plans SET package_notifications_limit = -1 WHERE slug = 'enterprise';

-- Sincronizar assinaturas existentes com os limites dos planos
UPDATE subscriptions s
SET package_notifications_limit = p.package_notifications_limit
FROM plans p
WHERE s.plan::text = p.slug;
```

### Alterações no Edge Function `notify-package-arrival`

Adicionar após a validação de autorização:

```typescript
// Buscar subscription do condomínio
const { data: subscription } = await supabase
  .from("subscriptions")
  .select("id, package_notifications_limit, package_notifications_used, package_notifications_extra")
  .eq("condominium_id", condoId)
  .eq("active", true)
  .single();

if (subscription) {
  const isUnlimited = subscription.package_notifications_limit === -1;
  const isOverLimit = !isUnlimited && 
    subscription.package_notifications_used >= subscription.package_notifications_limit;

  // Incrementar contadores
  await supabase
    .from("subscriptions")
    .update({
      package_notifications_used: subscription.package_notifications_used + 1,
      package_notifications_extra: isOverLimit 
        ? subscription.package_notifications_extra + 1 
        : subscription.package_notifications_extra,
    })
    .eq("id", subscription.id);
}
```

### Alterações no Edge Function `generate-invoices`

Ao calcular o valor da fatura:

```typescript
// Buscar custo por notificação extra
const { data: extraCostSetting } = await supabase
  .from("app_settings")
  .select("value")
  .eq("key", "package_notification_extra_cost")
  .single();

const extraCostPerNotification = extraCostSetting ? Number(extraCostSetting.value) : 0.10;

// Calcular valor extra
const extraNotifications = subscription.package_notifications_extra || 0;
const extraCharge = extraNotifications * extraCostPerNotification;
const totalAmount = price + extraCharge;

// Criar fatura com valor total
const invoiceDescription = extraNotifications > 0
  ? `Assinatura ${planName} + ${extraNotifications} notificações extras de encomendas`
  : `Assinatura ${planName}`;

// Após criar fatura, zerar contador de extras
await supabase
  .from("subscriptions")
  .update({
    package_notifications_used: 0,
    package_notifications_extra: 0,
  })
  .eq("id", subscription.id);
```

### Componentes UI a Modificar

1. **Pricing.tsx / Plans.tsx**: Adicionar linha para `package_notifications_limit`
2. **Auth.tsx**: Mostrar limite no resumo do plano
3. **Settings.tsx (SuperAdmin)**: Campo de edição do limite
4. **SubscriptionsMonitor.tsx**: Progress bar + badge de extras
5. **SindicoSubscriptions.tsx**: Mostrar uso atual
6. **DefaultTemplates.tsx**: Variável `{limite_encomendas}` no trial_welcome

---

## Ordem de Implementação

1. Criar migração SQL para adicionar colunas e configurações
2. Atualizar edge function `notify-package-arrival` para controlar limite
3. Atualizar edge function `generate-invoices` para cobrar extras
4. Atualizar interfaces de planos (Pricing, Plans, Auth)
5. Atualizar SuperAdmin Settings para editar limite
6. Atualizar monitoramento de assinaturas
7. Atualizar template de boas-vindas do trial
8. Testar fluxo completo


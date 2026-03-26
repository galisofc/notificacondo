

## Plano: Novo evento na timeline — "Ocorrência Aberta e Lida"

### Objetivo
Substituir o evento atual "Notificação Lida" por um novo evento dedicado "Ocorrência Aberta e Lida" com ícone próprio, exibindo o IP, data e horário de acesso do morador.

### Mudanças

#### `src/pages/OccurrenceDetails.tsx`

**1. Adicionar tipo `"accessed"` ao TimelineItem:**
Incluir `"accessed"` na union type do campo `type`.

**2. Buscar dados de `magic_link_access_logs`:**
Fazer query na tabela `magic_link_access_logs` filtrando por `occurrence_id` e `success = true`, trazendo `ip_address`, `user_agent`, `created_at` e `resident_id`.

**3. Substituir o evento "Notificação Lida" pelo novo "Ocorrência Aberta e Lida":**
Ao invés de gerar um item `"read"` dentro do loop de notificações, gerar itens a partir dos registros de `magic_link_access_logs`. Cada acesso vira um item na timeline com:
- Ícone: `Globe` (ícone de rede/internet)
- Cor: `bg-green-500`
- Título: "Ocorrência Aberta e Lida"
- Descrição: `IP: 177.215.112.220` (formatado, apenas o primeiro IP)
- Data: `created_at` do log de acesso

**4. Manter o evento "Notificação Lida" do WhatsApp separado (via webhook):**
O status `read` do WhatsApp continuará visível no stepper do DeliveryStatusTracker. O novo evento "Ocorrência Aberta e Lida" representa o acesso real ao link — são dados diferentes.

### Detalhes técnicos
- Nova interface `AccessLog` com campos: `id`, `ip_address`, `user_agent`, `created_at`, `resident_id`
- Query: `supabase.from("magic_link_access_logs").select("id, ip_address, user_agent, created_at, resident_id").eq("occurrence_id", id).eq("success", true)`
- Função `buildTimeline` recebe o array de access logs como parâmetro adicional
- Cada access log gera um item `{ type: "accessed", title: "Ocorrência Aberta e Lida", icon: <Globe />, ... }`
- Remove a criação do item `"read"` dentro do loop de notificações

### Arquivos afetados
- `src/pages/OccurrenceDetails.tsx`


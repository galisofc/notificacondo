

## Plano: Remover seção "Últimos Webhooks WhatsApp"

### Mudança
Remover o bloco do Card "Últimos Webhooks WhatsApp" (linhas 258-313) do arquivo `src/pages/superadmin/BsuidMigration.tsx`, incluindo a query e imports relacionados (`webhookLogs`, `logsLoading`, `refetchLogs`, ícone `Activity`, etc.) que não sejam usados em outro lugar.

### Arquivo
- `src/pages/superadmin/BsuidMigration.tsx`


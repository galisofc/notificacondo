

## Plano: Log Visual de Webhooks no Painel BSUIDs

### Objetivo
Adicionar uma seção abaixo da tabela de moradores mostrando os últimos webhooks recebidos (da tabela `whatsapp_notification_logs`), com timestamp, telefone, status (sucesso/erro), template usado e message_id. Isso facilita o diagnóstico de problemas de captura de BSUID.

### Mudanças

#### 1. Atualizar `src/pages/superadmin/BsuidMigration.tsx`
- Adicionar nova query para buscar os últimos 20 registros de `whatsapp_notification_logs` ordenados por `created_at` desc
- Renderizar uma nova seção "Últimos Webhooks" abaixo da paginação com:
  - Tabela compacta: Data/Hora, Telefone, Template, Status (badge verde/vermelho), Message ID, Erro (se houver)
  - Importar ícones `Activity` e `AlertCircle`
  - Usar `formatDistanceToNow` do date-fns para timestamps relativos
- Adicionar botão de refresh para recarregar os logs

### Dados consultados
Query na tabela `whatsapp_notification_logs` com campos: `created_at`, `phone`, `template_name`, `success`, `error_message`, `message_id`, `function_name` — limitado a 20 registros mais recentes.

### Arquivos
- `src/pages/superadmin/BsuidMigration.tsx` (atualizar)



# Recriar Pagina de Exportacao do Banco de Dados

A pagina `/superadmin/export-database` e a Edge Function correspondente foram removidas do projeto. O plano abaixo recria toda a funcionalidade.

## O que sera criado

1. **Edge Function `export-database`** -- Gera scripts SQL completos (schemas, dados, funcoes, triggers, RLS) para todas as 39 tabelas do banco, respeitando a ordem de dependencias de chaves estrangeiras.

2. **Pagina `ExportDatabase.tsx`** -- Interface no painel Super Admin para visualizar, copiar e baixar os scripts SQL em lotes.

3. **Rota e menu** -- Registro da rota `/superadmin/export-database` no `App.tsx` e link no menu lateral do Super Admin.

---

## Detalhes tecnicos

### 1. Edge Function (`supabase/functions/export-database/index.ts`)

- Acesso restrito: valida que o usuario autenticado tem role `super_admin`.
- Consulta `information_schema` para extrair:
  - Tipos ENUM
  - Definicoes de tabelas (colunas, tipos, defaults, constraints)
  - Funcoes e triggers
  - Politicas RLS
- Gera `INSERT INTO` para todos os registros de cada tabela publica, ordenando pela dependencia de foreign keys.
- Exclui dados de `auth.users` e `storage.objects` por seguranca.
- Retorna JSON com os scripts SQL divididos em lotes (schema, data, policies).

### 2. Pagina (`src/pages/superadmin/ExportDatabase.tsx`)

- Botao para acionar a geracao dos scripts via chamada a Edge Function.
- Exibicao dos scripts em blocos com syntax highlight basico.
- Botoes por bloco: **Copiar** (clipboard) e **Baixar** (arquivo `.sql`).
- Indicador de progresso/loading durante a geracao.
- Breadcrumbs consistentes com o padrao Super Admin.

### 3. Rota (`src/App.tsx`)

- Adicionar rota protegida `/superadmin/export-database` com `requiredRole="super_admin"`.
- Importar o componente `ExportDatabase`.

### 4. Menu lateral (`src/components/layouts/DashboardLayout.tsx`)

- Adicionar link "Exportar Banco" na secao de ferramentas/configuracoes do menu Super Admin, usando icone `Database` ou `Download` do Lucide.

### Tabelas incluidas na exportacao

Todas as 39 tabelas publicas: `apartments`, `app_settings`, `audit_logs`, `blocks`, `condominium_transfers`, `condominium_whatsapp_templates`, `condominiums`, `contact_messages`, `cron_job_controls`, `decisions`, `defense_attachments`, `defenses`, `edge_function_logs`, `fines`, `invoices`, `magic_link_access_logs`, `mercadopago_config`, `mercadopago_webhook_logs`, `notifications_sent`, `occurrence_evidences`, `occurrences`, `package_types`, `packages`, `party_hall_bookings`, `party_hall_checklist_items`, `party_hall_checklist_templates`, `party_hall_checklists`, `party_hall_notifications`, `party_hall_settings`, `password_recovery_attempts`, `plans`, `profiles`, `residents`, `subscriptions`, `user_condominiums`, `user_roles`, `whatsapp_config`, `whatsapp_notification_logs`, `whatsapp_templates`.

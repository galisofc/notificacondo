

## Plano: Painel de BSUIDs no Super Admin

### Objetivo
Criar uma nova página no Super Admin para visualizar os BSUIDs capturados dos moradores e acompanhar o progresso da migração (quantos moradores já possuem BSUID vs. total).

### Mudanças

#### 1. Nova página `src/pages/superadmin/BsuidMigration.tsx`
- Cards de estatísticas no topo: total de moradores, com BSUID, sem BSUID, percentual de migração
- Barra de progresso visual da migração
- Tabela com todos os moradores mostrando: nome, telefone, condomínio, bloco/apto, BSUID (ou "Pendente"), data de captura
- Filtros: busca por nome/telefone/BSUID, filtro por status (todos/com BSUID/sem BSUID)
- Paginação

#### 2. Rota no `src/App.tsx`
- Adicionar rota `/superadmin/bsuid-migration` protegida com `requiredRole="super_admin"`

#### 3. Menu lateral no `src/components/layouts/DashboardLayout.tsx`
- Adicionar item "BSUIDs" dentro do grupo "WhatsApp" (ao lado de Templates e Configurações)

### Dados consultados
A página fará um join entre `residents`, `apartments`, `blocks` e `condominiums` para exibir o contexto completo de cada morador junto com seu status de BSUID.

### Arquivos
- `src/pages/superadmin/BsuidMigration.tsx` (novo)
- `src/App.tsx` (nova rota)
- `src/components/layouts/DashboardLayout.tsx` (novo item no menu)


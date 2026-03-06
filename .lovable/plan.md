

# Sistema de Manutenção Preventiva - Role "Zelador"

O usuário confirmou que o zelador sera um novo perfil/login, separado do porteiro. Isso requer adicionar uma nova role `zelador` ao sistema antes de construir o modulo de manutencao.

---

## Escopo da Implementacao (Fase 1)

### 1. Nova Role "zelador" no banco de dados

- Adicionar `zelador` ao enum `app_role`
- Atualizar `check_conflicting_roles()` para impedir conflito zelador+sindico (zelador pode coexistir com porteiro? Provavelmente nao - sao perfis distintos)
- Atualizar `handle_new_user()` para suportar a nova role

### 2. Edge Functions para gerenciar zeladores

- **`create-zelador`**: Baseada na `create-porteiro`, cria usuario com role `zelador` e vincula ao condominio via `user_condominiums`
- **`delete-zelador`**: Remove zelador (mesma logica de `delete-porteiro`)
- **`update-zelador`**: Atualiza dados do zelador

### 3. Pagina de gestao de zeladores pelo sindico

- **`/sindico/zeladores`**: CRUD de zeladores, similar a `/sindico/porteiros`
- Formulario com nome, email, telefone, senha, selecao de condominio
- Listagem com acoes de editar, excluir, reenviar credenciais

### 4. Frontend - Role e rotas do zelador

- Atualizar `useUserRole.tsx`: adicionar `zelador` ao tipo `UserRole`, adicionar `isZelador`, buscar condominios do zelador
- Atualizar `ProtectedRoute.tsx`: redirect para `/zelador` quando role = zelador
- Atualizar `DashboardLayout.tsx`: menu lateral do zelador com itens de manutencao
- Atualizar `App.tsx`: rotas `/zelador/*`

### 5. Tabelas de Manutencao

```sql
-- Enum de periodicidade
CREATE TYPE maintenance_periodicity AS ENUM (
  'semanal','quinzenal','mensal','bimestral',
  'trimestral','semestral','anual','personalizado'
);

-- Enum de status da execucao
CREATE TYPE maintenance_execution_status AS ENUM (
  'concluida','parcial','nao_realizada'
);

-- Categorias
CREATE TABLE maintenance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tarefas
CREATE TABLE maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL,
  category_id UUID REFERENCES maintenance_categories(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'media',
  periodicity maintenance_periodicity NOT NULL,
  periodicity_days INTEGER,
  next_due_date DATE NOT NULL,
  last_completed_at TIMESTAMPTZ,
  notification_days_before INTEGER DEFAULT 7,
  status TEXT DEFAULT 'em_dia',
  responsible_notes TEXT,
  estimated_cost NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Execucoes
CREATE TABLE maintenance_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  condominium_id UUID NOT NULL,
  executed_by UUID,
  executed_by_name TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  observations TEXT,
  cost NUMERIC,
  photos TEXT[] DEFAULT '{}',
  status maintenance_execution_status DEFAULT 'concluida',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 6. RLS para tabelas de manutencao

- Sindicos: CRUD completo nos seus condominios
- Zeladores: SELECT em tarefas/categorias + INSERT em execucoes (via `user_belongs_to_condominium`)
- Super admins: acesso total

### 7. Paginas do Zelador

- **`/zelador`**: Dashboard com tarefas pendentes/proximas/atrasadas
- **`/zelador/manutencoes`**: Lista de manutencoes com registro de execucao

### 8. Paginas do Sindico (manutencao)

- **`/sindico/manutencoes`**: Dashboard de manutencoes com cards de status
- **`/sindico/manutencoes/categorias`**: CRUD de categorias
- **`/sindico/manutencoes/historico`**: Historico de execucoes

### 9. Menu lateral

**Sindico** - novo grupo:
```text
Manutencao
  Dashboard
  Zeladores
  Categorias
  Historico
```

**Zelador** - menu proprio:
```text
Inicio (dashboard)
Manutencoes (lista + registro execucao)
Configuracoes
```

---

## Ordem de implementacao

Dado o tamanho, sugiro dividir em 2-3 mensagens:

1. **Primeira mensagem**: Migration (enum + tabelas + RLS), edge functions (create/delete-zelador), pagina de gestao de zeladores pelo sindico, atualizacao de roles/rotas
2. **Segunda mensagem**: Paginas de manutencao do sindico (dashboard, categorias, historico)
3. **Terceira mensagem**: Paginas do zelador (dashboard, registro de execucao)


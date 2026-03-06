

# Modulo PORTARIA para Porteiros

## Resumo

Criar um novo menu "Portaria" no painel do porteiro com duas funcionalidades:
1. **Registro de Ocorrencias** - porteiros podem registrar ocorrencias no condominio
2. **Passagem de Plantao** - checklist de equipamentos para troca de turno, com modelo definido pelo sindico

---

## 1. Banco de Dados - Novas Tabelas

### Tabela `porter_occurrences` (Ocorrencias da Portaria)
- `id` (uuid, PK)
- `condominium_id` (uuid, FK -> condominiums)
- `registered_by` (uuid, FK -> auth.users) - porteiro que registrou
- `title` (text)
- `description` (text)
- `category` (text) - ex: "visitante", "entrega", "manutencao", "seguranca", "outros"
- `priority` (text) - "baixa", "media", "alta"
- `status` (text, default "aberta") - "aberta", "resolvida"
- `occurred_at` (timestamptz)
- `resolved_at` (timestamptz, nullable)
- `resolved_by` (uuid, nullable)
- `resolution_notes` (text, nullable)
- `created_at` / `updated_at`

**RLS:**
- Porteiros podem CRUD nas ocorrencias dos condominios atribuidos (via `user_belongs_to_condominium`)
- Sindicos podem visualizar/gerenciar ocorrencias dos seus condominios
- Super admins acesso total

### Tabela `shift_checklist_templates` (Templates de checklist criados pelo sindico)
- `id` (uuid, PK)
- `condominium_id` (uuid, FK -> condominiums)
- `item_name` (text)
- `category` (text, default "Geral") - ex: "Equipamentos", "Seguranca", "Limpeza"
- `is_active` (boolean, default true)
- `display_order` (integer, default 0)
- `created_at` / `updated_at`

**RLS:**
- Sindicos podem gerenciar templates dos seus condominios
- Porteiros podem visualizar templates dos condominios atribuidos
- Super admins acesso total

### Tabela `shift_handovers` (Registros de passagem de plantao)
- `id` (uuid, PK)
- `condominium_id` (uuid, FK -> condominiums)
- `outgoing_porter_id` (uuid) - porteiro que esta saindo
- `incoming_porter_name` (text) - nome do porteiro que esta entrando
- `shift_ended_at` (timestamptz, default now())
- `general_observations` (text, nullable)
- `created_at`

**RLS:**
- Porteiros podem criar e visualizar registros dos seus condominios
- Sindicos podem visualizar registros dos seus condominios
- Super admins acesso total

### Tabela `shift_handover_items` (Itens checados na passagem)
- `id` (uuid, PK)
- `handover_id` (uuid, FK -> shift_handovers)
- `item_name` (text)
- `category` (text, nullable)
- `is_ok` (boolean, default true)
- `observation` (text, nullable)
- `created_at`

**RLS:**
- Mesmas regras do `shift_handovers` (via JOIN)

---

## 2. Menu do Porteiro - Navegacao

Atualizar o menu lateral do porteiro em `DashboardLayout.tsx` para agrupar itens:

```text
Inicio
Condominio
------ Encomendas (grupo) ------
  Registrar Encomenda
  Retirar Encomenda
  Historico
------ Portaria (grupo) ------
  Ocorrencias
  Passagem de Plantao
Configuracoes
```

---

## 3. Paginas do Porteiro (Frontend)

### 3.1 Ocorrencias da Portaria (`src/pages/porteiro/PortariaOccurrences.tsx`)
- Lista de ocorrencias registradas pelo porteiro
- Filtros por status (aberta/resolvida), categoria, periodo
- Botao para registrar nova ocorrencia (dialog/formulario)
- Possibilidade de marcar como resolvida com observacoes
- Seletor de condominio (caso o porteiro atenda mais de um)

### 3.2 Passagem de Plantao (`src/pages/porteiro/ShiftHandover.tsx`)
- Formulario com:
  - Nome do porteiro que esta assumindo
  - Checklist automatico baseado no template do sindico para aquele condominio
  - Cada item: checkbox "OK" + campo de observacao opcional
  - Observacoes gerais
- Historico de passagens anteriores
- Seletor de condominio

---

## 4. Pagina do Sindico - Configuracao de Checklist

### 4.1 Configuracao do Checklist de Portaria (`src/pages/sindico/ShiftChecklistSettings.tsx`)
- Acessivel via menu do sindico (dentro de "Servicos > Porteiros" ou novo submenu)
- Seletor de condominio
- CRUD de itens do checklist por categoria
- Reordenacao dos itens
- Ativar/desativar itens
- Segue o mesmo padrao visual do `PartyHallSettings.tsx` (aba de checklist)

---

## 5. Rotas

Novas rotas em `App.tsx`:
- `/porteiro/portaria/ocorrencias` - Ocorrencias da portaria
- `/porteiro/portaria/plantao` - Passagem de plantao
- `/sindico/portaria/checklist` - Config do checklist (sindico)

---

## Detalhes Tecnicos

- Seguir padrao existente de componentes (Card, Dialog, Select, etc.)
- Queries com `@tanstack/react-query` para cache e refetch
- Filtros seguindo o padrao horizontal ja estabelecido
- Contagem de ocorrencias abertas como badge no menu lateral
- Realtime opcional para atualizacoes em tempo real das ocorrencias


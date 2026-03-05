

# Diagnose: High Disk IO no Supabase

## Problema Identificado

A causa principal do consumo excessivo de Disk IO e a tabela **`user_roles`** sofrendo **48 milhoes de sequential scans** lendo **328 milhoes de tuplas**. Isso acontece porque a funcao `has_role()` e chamada em diversas RLS policies e, mesmo existindo um index `(user_id, role)`, o Postgres esta fazendo full table scans.

### Numeros Criticos (desde o ultimo restart do Postgres)

| Recurso | Scans/Reads | Problema |
|---|---|---|
| `user_roles` seq scans | 48M scans, 328M tuplas lidas | `has_role()` em RLS de varias tabelas |
| `user_condominiums` index scans | 158M | `user_belongs_to_condominium()` em RLS |
| `residents` index scans | 95M | RLS de packages, apartments |
| `blocks` index + seq scans | 70M + 1.4M | JOINs em RLS policies |
| `apartments` index scans | 39M | JOINs em RLS policies |
| `audit_logs` tamanho | 20MB, 13K registros | Trigger de auditoria em todas as tabelas |

### Causas Raiz

1. **RLS policies com subconsultas pesadas**: Cada SELECT/INSERT/UPDATE em tabelas como `packages`, `residents`, `apartments` dispara subconsultas que fazem JOINs em `blocks → condominiums` ou chamam `has_role()` e `user_belongs_to_condominium()`. Com ~200 pacotes e ~300 apartamentos, o custo por query e pequeno, mas o volume acumulado de chamadas e massivo.

2. **`audit_logs` crescendo sem limpeza**: 20MB e a maior tabela, com 13K registros e trigger em todas as operacoes. Cada INSERT/UPDATE/DELETE em qualquer tabela auditada gera mais IO.

3. **Cron jobs frequentes**: 6 edge functions rodando a cada hora/dia, cada execucao faz queries que ativam RLS e audit triggers.

## Plano de Otimizacao

### 1. Criar index dedicado para `has_role()` (impacto alto)
```sql
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
ON public.user_roles (user_id, role);
```
Ja existe `user_roles_user_id_role_key` (UNIQUE), mas vamos verificar se o planner esta usando. O mais provavel e que as sequential scans venham da funcao `SECURITY DEFINER` com `SET search_path` interferindo.

### 2. Limpar `audit_logs` antigos (impacto alto)
- Criar uma rotina de limpeza que mantenha apenas os ultimos 30 dias
- Isso reduz a maior tabela de 20MB e reduz IO do vacuum

### 3. Otimizar `audit_logs` trigger
- Remover auditoria da tabela `subscriptions` (2025 updates registrados - provavelmente dos cron jobs de billing)
- Remover auditoria da tabela `packages` (10K+ operacoes - maior volume)

### 4. Reduzir frequencia dos cron jobs
- `notify-trial-ending`: rodar 1x/dia em vez de a cada hora
- `generate-invoices`: ja roda 1x/dia, OK
- `start/finish-party-hall-usage`: rodar 2x/dia em vez de a cada hora

### 5. VACUUM e ANALYZE manuais
- `packages` tem 3034 dead tuples vs 199 live - ratio muito alto
- Executar VACUUM ANALYZE nas tabelas principais

## Secao Tecnica

As mudancas serao:
1. **Migration SQL**: limpeza de audit_logs > 30 dias, criacao de funcao de cleanup periodico
2. **Migration SQL**: remover triggers de audit em tabelas de alto volume (packages, subscriptions) ou tornar o trigger condicional
3. **Ajuste nos cron jobs**: reduzir frequencia no `supabase/config.toml` (se os schedules estiverem la) ou na configuracao do cron
4. **VACUUM ANALYZE** nas tabelas com dead tuples acumulados

O impacto mais imediato sera a limpeza dos audit_logs e a reducao da auditoria em tabelas de alto volume.


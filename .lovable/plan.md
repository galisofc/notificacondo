

## Problema Confirmado

A query ao banco confirma: a coluna `received_by_name` **não existe** na tabela `packages`. O código em `RegisterPackage.tsx` (linha 263) já tenta inserir `received_by_name`, o que causa erro no insert e impede o cadastro de encomendas.

## Plano

### 1. Criar migração para adicionar a coluna
Executar via migration tool:

```sql
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS received_by_name text;
```

### 2. Backfill registros existentes
Executar via insert tool (operação de dados):

```sql
UPDATE public.packages p
SET received_by_name = pr.full_name
FROM public.profiles pr
WHERE pr.user_id = p.received_by
AND p.received_by_name IS NULL;
```

### 3. Lembrete VPS externa
Informar o SQL que deve ser executado manualmente na VPS externa.

**Nenhuma alteração de código necessária** — o `RegisterPackage.tsx` já está correto, só precisa da coluna no banco.


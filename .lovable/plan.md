

# Correção: Nome de quem recebeu a encomenda mostrando "-"

## Diagnóstico

O campo `received_by` na tabela `packages` armazena apenas o **UUID** do porteiro. Para exibir o nome, as páginas de histórico fazem uma consulta separada à tabela `profiles` usando esse UUID. Essa consulta depende de políticas RLS complexas (`has_role()` + JOINs em `user_condominiums` + `packages`), que podem falhar silenciosamente no servidor externo, retornando vazio e exibindo "-".

Na base de dados do Lovable Cloud, os dados estão corretos (THAISA PEREIRA, EDNAURIA SOARES aparecem normalmente). O problema está na dependência de RLS para resolver nomes.

## Solução Proposta

Adicionar uma coluna `received_by_name` na tabela `packages` (similar ao `picked_up_by_name` que já existe) para gravar o nome do porteiro no momento do registro. Isso elimina a dependência de consultas extras à tabela `profiles`.

### Mudanças

1. **Migration SQL**: Adicionar coluna `received_by_name` (text, nullable) na tabela `packages`
2. **Preencher dados existentes**: UPDATE dos pacotes existentes com os nomes dos perfis atuais
3. **RegisterPackage.tsx**: Ao registrar, salvar `received_by_name` junto com `received_by`
4. **PackagesHistory.tsx (porteiro)**: Usar `pkg.received_by_name` como fallback antes do `received_by_profile?.full_name`
5. **PackagesHistory.tsx (síndico)**: Mesma alteração
6. **PackagesCondominiumHistory.tsx**: Mesma alteração

### Detalhes Técnicos

```sql
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS received_by_name text;

UPDATE public.packages p
SET received_by_name = pr.full_name
FROM public.profiles pr
WHERE pr.user_id = p.received_by AND p.received_by_name IS NULL;
```

No `RegisterPackage.tsx`, buscar o nome do perfil do usuário logado e incluir no insert:
```typescript
// Buscar nome do porteiro logado
const { data: profile } = await supabase
  .from("profiles").select("full_name").eq("user_id", user.id).single();

// No insert
received_by_name: profile?.full_name || user.email,
```

Nas páginas de histórico, alterar a exibição:
```typescript
// De:
pkg.received_by_profile?.full_name || "-"
// Para:
pkg.received_by_name || pkg.received_by_profile?.full_name || "-"
```




## Problema: Painel BSUIDs não mostra dados

### Causa raiz
A tabela `residents` não possui uma política RLS para `super_admin`. As políticas existentes só permitem acesso a:
- Donos de condomínio (síndicos)
- Porteiros de condomínios atribuídos
- O próprio morador

Quando o super admin acessa o painel, a query retorna 0 linhas porque nenhuma policy permite o SELECT.

### Solução

**Migração SQL** — Adicionar política RLS para super_admin na tabela `residents`:

```sql
CREATE POLICY "Super admins can view all residents"
ON public.residents
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));
```

### Arquivos
- Apenas migração SQL (nenhuma alteração de código no frontend)


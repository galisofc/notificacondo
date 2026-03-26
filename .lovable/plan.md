

## Plano: Atualizar API da Meta para v25.0

### Objetivo
Padronizar todas as chamadas à API da Meta WhatsApp Cloud para a versão `v25.0`.

### Mudanças

#### 1. `supabase/functions/_shared/meta-whatsapp.ts`
- Alterar `META_API_VERSION` de `"v20.0"` para `"v25.0"` (linha 11)
- Isso atualiza automaticamente todas as funções que usam este módulo compartilhado

#### 2. `supabase/functions/update-porteiro-password/index.ts`
- Alterar URL hardcoded de `v21.0` para `v25.0` (linha 186)

#### 3. `supabase/functions/create-waba-template/index.ts`
- Alterar URL hardcoded de `v20.0` para `v25.0` (linha 114)

#### 4. `supabase/functions/check-whatsapp-template-status/index.ts`
- Alterar URL hardcoded de `v20.0` para `v25.0` (linha 79)

#### 5. `supabase/functions/list-waba-templates/index.ts`
- Alterar URL hardcoded de `v20.0` para `v25.0` (linha 71)

### Observação
Idealmente as funções dos itens 2-5 deveriam importar `META_API_VERSION` do módulo compartilhado para evitar duplicação, mas por ora a atualização direta resolve.


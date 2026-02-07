

# Corrigir erro "Invalid JWT" (401) nas Edge Functions

## Problema

Existem **9 Edge Functions** que nao estao configuradas no arquivo `supabase/config.toml` com `verify_jwt = false`. No Supabase externo com sistema de signing-keys, o padrao `verify_jwt = true` nao funciona corretamente, causando o erro `{code: 401, message: "Invalid JWT"}`.

As funcoes afetadas sao:
- `check-whatsapp-template-status`
- `create-waba-template`
- `get-package-photo-signed-url`
- `list-waba-templates`
- `send-password-recovery`
- `send-whatsapp-image-test`
- `send-whatsapp-template-test`
- `update-porteiro-password`
- `update-porteiro`

O erro que voce esta vendo na pagina `/superadmin/whatsapp` provavelmente vem da funcao `list-waba-templates` ou `send-whatsapp-template-test`.

## Solucao

Adicionar todas as 9 funcoes faltantes no `supabase/config.toml` com `verify_jwt = false`.

Essas funcoes ja fazem validacao de autenticacao internamente no codigo (usando `getClaims()` ou `getUser()`), entao a seguranca nao sera afetada.

## Detalhes Tecnicos

### Arquivo alterado: `supabase/config.toml`

Adicionar as seguintes entradas ao final do arquivo:

```text
# Verificacao de status de template WhatsApp
[functions.check-whatsapp-template-status]
verify_jwt = false

# Criacao de template WABA
[functions.create-waba-template]
verify_jwt = false

# URL assinada para fotos de encomendas
[functions.get-package-photo-signed-url]
verify_jwt = false

# Listagem de templates WABA
[functions.list-waba-templates]
verify_jwt = false

# Recuperacao de senha
[functions.send-password-recovery]
verify_jwt = false

# Teste de envio de imagem WhatsApp
[functions.send-whatsapp-image-test]
verify_jwt = false

# Teste de envio de template WhatsApp
[functions.send-whatsapp-template-test]
verify_jwt = false

# Atualizacao de senha de porteiro
[functions.update-porteiro-password]
verify_jwt = false

# Atualizacao de dados de porteiro
[functions.update-porteiro]
verify_jwt = false
```

Apos essa alteracao, sera necessario fazer o **redeploy** das Edge Functions no Supabase externo para que a configuracao entre em vigor.


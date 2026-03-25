

## Problema: Webhook não captura dados reais da Meta

### Diagnóstico
Analisando os payloads **reais** salvos na `webhook_raw_logs`, identifiquei que a Meta envia os campos com nomes diferentes do que o código espera:

```text
O que o código espera          O que a Meta envia
─────────────────────          ──────────────────
status.recipient_id            status.recipient_user_id  (ou ausente)
status.user_id                 (campo no nível do contato, não do status)
```

Nos logs da edge function, vemos `phone: undefined` — confirmando que `status.recipient_id` não existe no payload real. Sem o telefone, a captura de BSUID também falha.

### Solução

**Atualizar `supabase/functions/whatsapp-webhook/index.ts`**:

1. Extrair o telefone com fallback: `status.recipient_id || status.recipient_user_id`
2. Extrair o BSUID do contato: buscar no array `change.value.contacts` o campo `user_id` (que é o BSUID real da Meta)
3. Redeployar a edge function

```typescript
// Antes:
const recipientPhone = status.recipient_id;
const bsuid = status.user_id;

// Depois:
const recipientPhone = status.recipient_id || status.recipient_user_id;
const contacts = change.value.contacts || [];
const contactBsuid = contacts.length > 0 ? contacts[0].user_id : null;
const bsuid = status.user_id || status.recipient_user_id || contactBsuid;
```

### Teste
Após deploy, registrar uma encomenda real no painel do porteiro para o morador 11982731247 e verificar se:
- O payload aparece na `webhook_raw_logs`
- O BSUID é capturado na tabela `residents`

### Arquivos
- `supabase/functions/whatsapp-webhook/index.ts` (corrigir extração de campos)
- Redeploy da edge function


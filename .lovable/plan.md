

## Plano: Corrigir e Completar o Webhook WhatsApp

### Problemas Encontrados

1. **Falta verificação do `hub.verify_token`** no GET — qualquer requisição pode verificar o webhook
2. **Status `"accepted"` não mapeado** no `normalizeMetaStatus` — a Meta envia esse status antes de `sent`, e ele não está sendo tratado
3. **Erros de entrega não são salvos** no banco — apenas vão para `console.error`
4. **Sem secret de verificação** configurada para o webhook

### Mudanças

#### 1. Adicionar secret `META_WEBHOOK_VERIFY_TOKEN`
- Solicitar ao usuário que defina um token de verificação via ferramenta de secrets
- Usar esse token para validar o GET de verificação do webhook

#### 2. Atualizar `supabase/functions/whatsapp-webhook/index.ts`

**a) Verificação do token no GET:**
```typescript
const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
const hubToken = url.searchParams.get("hub.verify_token");
if (mode === "subscribe" && challenge && hubToken === verifyToken) {
  return new Response(challenge, { status: 200 });
}
return new Response("Forbidden", { status: 403 });
```

**b) Adicionar `"accepted"` ao mapa de status:**
```typescript
const statusMap = {
  accepted: "accepted",
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};
```

**c) Salvar erros de entrega no banco:**
Quando `status.errors` existir, salvar o erro na tabela `whatsapp_notification_logs` (campo `error_message` ou similar) e em `notifications_sent`.

**d) Atualizar status `accepted` corretamente:**
Quando o status for `accepted`, atualizar o `zpro_status` mas sem marcar `delivered_at`.

### Arquivos Afetados
- `supabase/functions/whatsapp-webhook/index.ts`
- Nova secret: `META_WEBHOOK_VERIFY_TOKEN`


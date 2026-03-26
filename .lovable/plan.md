

## Diagnóstico: Status "Entregue" e "Lido" não atualizam na VPS externa

### Causa raiz

O webhook da Meta está configurado para enviar os callbacks de status (delivered, read) para a URL do Lovable Cloud:
```
https://kcnojeouypwbkkbnbold.supabase.co/functions/v1/whatsapp-webhook
```

A VPS externa tem seu **próprio** Supabase com sua **própria** Edge Function `whatsapp-webhook`. Porém, a Meta continua enviando os callbacks para o Lovable Cloud, então a VPS externa **nunca recebe** as atualizações de "delivered" e "read".

O fluxo atual:
```text
1. Porteiro registra encomenda (VPS externa)
2. notify-package-arrival envia msg via Meta API (VPS externa) → status = "sent" ✓
3. Meta envia webhook de delivered/read → Lovable Cloud ✗ (deveria ir para VPS)
4. VPS externa nunca recebe → status fica parado em "sent"
```

### Solução

Este é um problema de **configuração no painel Meta**, não de código. O usuário precisa:

1. Acessar o **Meta App Dashboard** → WhatsApp → Configuration → Webhook
2. Alterar a **Callback URL** para apontar para a VPS externa:
   ```
   https://[SUPABASE_URL_DA_VPS]/functions/v1/whatsapp-webhook
   ```
3. Manter o mesmo **Verify Token** (`META_WEBHOOK_VERIFY_TOKEN`) que está configurado nos secrets da VPS
4. Garantir que os campos de subscription estão marcados: `messages`

### Alternativa (se quiser manter dois ambientes)

Se o objetivo é manter **ambos** os ambientes (Lovable Cloud + VPS) recebendo webhooks, a Meta só permite **uma URL de webhook por app**. Nesse caso, as opções são:

- **Opção A**: Usar apenas a VPS externa como destino do webhook (recomendado para produção)
- **Opção B**: Criar um proxy/relay na VPS que recebe o webhook e repassa para o outro ambiente

### O que NÃO precisa mudar no código

O código da Edge Function `whatsapp-webhook` já está correto — ela atualiza tanto `notifications_sent` quanto `whatsapp_notification_logs` com os timestamps de delivered/read. O problema é exclusivamente que a Meta não está enviando os callbacks para o servidor correto.


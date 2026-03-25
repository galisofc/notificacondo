

## Plano: Visualizador de Payloads do Webhook Meta

### Objetivo
Criar tabela `webhook_raw_logs` para armazenar payloads brutos da Meta, atualizar o webhook para salvar cada payload recebido, e adicionar seção no painel BSUIDs com botão "olho" para inspecionar o JSON completo.

### Mudanças

#### 1. Migração SQL — Tabela `webhook_raw_logs`
```sql
CREATE TABLE public.webhook_raw_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'meta',
  payload jsonb NOT NULL,
  statuses_count int DEFAULT 0,
  bsuids_captured int DEFAULT 0,
  notifications_updated int DEFAULT 0
);

ALTER TABLE public.webhook_raw_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view webhook raw logs"
ON public.webhook_raw_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Service role can insert webhook raw logs"
ON public.webhook_raw_logs FOR INSERT TO service_role
WITH CHECK (true);
```

#### 2. Edge Function `whatsapp-webhook/index.ts`
- Após `req.json()`, inserir o payload na tabela `webhook_raw_logs`
- Após processar, atualizar o registro com os contadores finais (`statuses_count`, `bsuids_captured`, `notifications_updated`)

#### 3. Frontend `src/pages/superadmin/BsuidMigration.tsx`
- Nova seção "Payloads do Webhook Meta" com:
  - Query nos últimos 20 registros de `webhook_raw_logs`
  - Tabela: Data/Hora, Source, Statuses, BSUIDs Capturados, Notificações Atualizadas
  - Botão com ícone `Eye` (lucide) em cada linha abrindo um `Dialog` com o JSON formatado (`JSON.stringify(payload, null, 2)` em `<pre>`)
  - Botão refresh

### Arquivos
- Migração SQL (nova tabela)
- `supabase/functions/whatsapp-webhook/index.ts` (inserir + atualizar payload)
- `src/pages/superadmin/BsuidMigration.tsx` (nova seção)


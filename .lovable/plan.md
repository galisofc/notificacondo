

## Plano: Corrigir timeline de encomendas na VPS externa

### Diagnóstico

O `DeliveryStatusTracker` nos cards de encomendas depende do hook `usePackageNotificationStatus`, que consulta a tabela `whatsapp_notification_logs`. Na VPS externa, a query retorna vazio porque a **política RLS para porteiros** provavelmente não foi aplicada manualmente.

A política necessária é:
```sql
CREATE POLICY "Porteiros can view WABA logs of assigned condominiums"
  ON public.whatsapp_notification_logs
  FOR SELECT
  USING (user_belongs_to_condominium(auth.uid(), condominium_id));
```

Além disso, as colunas de timestamp (`accepted_at`, `sent_at`, `delivered_at`, `read_at`) também podem não existir na VPS.

### Solução

Não há mudança de código necessária. O problema é que as migrações não foram replicadas na VPS externa.

Você precisa executar manualmente no SQL da VPS os seguintes comandos:

**1. Verificar/criar a política RLS do porteiro:**
```sql
-- Verificar se a policy existe
SELECT * FROM pg_policies WHERE tablename = 'whatsapp_notification_logs' AND policyname LIKE '%Porteiros%';

-- Se não existir, criar:
CREATE POLICY "Porteiros can view WABA logs of assigned condominiums"
  ON public.whatsapp_notification_logs
  FOR SELECT
  USING (user_belongs_to_condominium(auth.uid(), condominium_id));
```

**2. Verificar/criar colunas de timestamp:**
```sql
ALTER TABLE public.whatsapp_notification_logs 
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;
```

**3. Habilitar realtime (se não estiver):**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_notification_logs;
```

### Resumo
O código está correto. O problema é a falta de sincronização das migrações na VPS externa. Execute os SQLs acima no banco de produção e o tracker aparecerá nos cards.


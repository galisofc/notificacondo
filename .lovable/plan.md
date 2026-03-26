

## Plano: Verificação real do Webhook na Meta

### Objetivo
Adicionar um botão "Verificar Webhook" no card de Webhook que faz uma chamada real à API da Meta para confirmar se o webhook está corretamente configurado e recebendo eventos. O status será dinâmico (verde/amarelo/vermelho) baseado na resposta da API.

### Como funciona
A API da Meta permite consultar as subscriptions de um App via `GET /{app-id}/subscriptions`. Porém, isso requer o App Access Token. Uma alternativa mais simples e já disponível: consultar a tabela `webhook_raw_logs` para verificar se há payloads recentes recebidos, o que prova que o webhook está funcionando.

### Implementação

**1. Lógica de verificação no frontend (`src/pages/superadmin/WhatsAppConfig.tsx`):**
- Adicionar estado `webhookStatus`: `"checking" | "active" | "inactive" | "unknown"`
- Ao carregar a página, consultar `webhook_raw_logs` ordenado por `created_at DESC` com `limit 1`
- Se o último registro foi recebido nas últimas 72h: status **Ativo** (verde)
- Se foi recebido há mais de 72h: status **Inativo** (amarelo/aviso)
- Se não há nenhum registro: status **Sem dados** (cinza)
- Adicionar botão "Verificar agora" que refaz a consulta

**2. Atualizar o card visual:**
- Substituir o badge estático "Configurado" por badge dinâmico baseado no status real
- Mostrar data/hora do último webhook recebido
- Mostrar contagem de webhooks recebidos nas últimas 24h

### Detalhes técnicos
- Query: `supabase.from("webhook_raw_logs").select("id, created_at, source").eq("source", "meta").order("created_at", { ascending: false }).limit(1)`
- Query contagem 24h: `supabase.from("webhook_raw_logs").select("id", { count: "exact", head: true }).eq("source", "meta").gte("created_at", last24h)`
- Arquivo editado: `src/pages/superadmin/WhatsAppConfig.tsx`


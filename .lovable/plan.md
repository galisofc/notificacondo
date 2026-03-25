

## Análise: Preparação para BSUIDs do WhatsApp (Business-Scoped User IDs)

### O que muda na Meta

A partir de **31 de março de 2026** (daqui a 6 dias!), a Meta começa a incluir um novo campo `user_id` (BSUID) nos webhooks. A partir de **maio de 2026**, será possível enviar mensagens usando BSUIDs ao invés de números de telefone. Quando um usuário ativar "usernames", o número de telefone pode **deixar de aparecer** nos webhooks.

Formato do BSUID: `BR.13491208655302741918`

### Impacto no NotificaCondo

O sistema atual envia mensagens usando **número de telefone dos moradores** (campo `phone` na tabela `residents`). As áreas impactadas são:

**1. Envio de mensagens (`_shared/meta-whatsapp.ts`)**
- `formatPhoneForMeta()` limpa e formata números de telefone
- `sendMetaTemplate()` e `sendMetaText()` enviam para `to: formattedPhone`
- Precisará suportar BSUID como alternativa ao campo `to`

**2. Webhook de status (`whatsapp-webhook/index.ts`)**
- Ainda usa formato legado de provedores antigos (Z-PRO, Z-API, Evolution, WPPConnect)
- Precisa ser atualizado para o formato oficial da Meta, que trará `user_id` (BSUID) nos webhooks
- O webhook atual nem processa o formato da Meta!

**3. Banco de dados**
- Nenhuma tabela armazena BSUIDs atualmente
- Será necessário um campo para mapear BSUID -> morador

### Plano de Adaptação

#### Fase 1: Imediata (antes de 31/03)

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**
- Reescrever para processar o formato oficial da Meta (campo `statuses[]` com `id`, `status`, `recipient_id` e novo `user_id`)
- Remover toda a lógica de provedores legados (Z-PRO, Z-API, Evolution, WPPConnect)
- Extrair e logar o `user_id` (BSUID) quando presente nos webhooks

**Migração SQL**
- Adicionar coluna `bsuid` (text, nullable) na tabela `residents` para armazenar o BSUID de cada morador
- Criar indice unico em `bsuid` para busca rapida

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**
- Ao receber um webhook com `user_id`, buscar o morador pelo `recipient_id` (telefone) e salvar o BSUID

#### Fase 2: Maio 2026 (quando a Meta liberar envio por BSUID)

**Arquivo: `supabase/functions/_shared/meta-whatsapp.ts`**
- Atualizar `sendMetaTemplate()` e `sendMetaText()` para aceitar BSUID no campo `to`
- Criar lógica de fallback: tentar BSUID primeiro, fallback para telefone
- Detectar formato BSUID (contém `.` e letras) vs telefone (somente dígitos)

### Arquivos Modificados
- `supabase/functions/whatsapp-webhook/index.ts` — reescrever para formato Meta + captura de BSUID
- `supabase/functions/_shared/meta-whatsapp.ts` — preparar para aceitar BSUID como destinatário
- Migração SQL — adicionar coluna `bsuid` na tabela `residents`

### Resumo
O sistema **não está preparado** atualmente. O webhook ainda usa formatos de provedores legados e não processa o formato da Meta. A prioridade imediata é atualizar o webhook para o formato oficial e começar a capturar BSUIDs antes de 31/03. A adaptação do envio por BSUID pode aguardar maio de 2026.




## Problema: Payloads não estão sendo salvos

### Diagnóstico
- A tabela `webhook_raw_logs` está **vazia** (0 registros)
- Não há logs recentes da edge function `whatsapp-webhook`
- O código foi atualizado para salvar payloads, mas a edge function provavelmente **não foi redeployada** após a alteração

### Solução

#### 1. Redeployar a edge function `whatsapp-webhook`
A versão em produção ainda é a antiga (sem o insert na `webhook_raw_logs`). Preciso fazer o redeploy para que o novo código entre em vigor.

#### 2. Testar com curl após deploy
Enviar um POST simulado ao webhook para confirmar que o payload está sendo salvo na tabela.

### Arquivos
- Nenhuma alteração de código — apenas redeploy da edge function existente e teste


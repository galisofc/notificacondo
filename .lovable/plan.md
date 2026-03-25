

## Plano: Simular Webhook para LEANDRO GALIS

### Objetivo
Enviar um POST simulado ao webhook `whatsapp-webhook` com o `recipient_id: 5511982731247` (telefone do LEANDRO GALIS) para capturar o BSUID dele corretamente.

### Ação
Executar um `curl` para a edge function com o payload Meta contendo:
- `recipient_id`: `5511982731247`
- `user_id` (BSUID): `BR.98765432109876543210`
- `status`: `delivered`
- `id` (wamid): `wamid.test_leandro_001`

### Verificação
Após o POST, consultar a tabela `residents` para confirmar que o campo `bsuid` do LEANDRO GALIS foi atualizado.

### Arquivos
Nenhuma alteração de código — apenas execução de teste via curl + query SQL.


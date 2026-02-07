

# Corrigir exclusao de condominios - Politicas RLS faltando

## Problema
O erro persiste porque as tabelas `whatsapp_notification_logs` e `party_hall_notifications` **nao possuem politica RLS para DELETE**. O comando `.delete()` executado pelo frontend (com o token do super admin) simplesmente nao deleta nada -- retorna sucesso mas 0 linhas afetadas. Como os registros permanecem, a exclusao do condominio falha por violacao de foreign key.

## Causa Raiz

| Tabela | Politicas RLS existentes | DELETE permitido? |
|--------|--------------------------|-------------------|
| `whatsapp_notification_logs` | INSERT (service role), SELECT (super_admin, sindico) | **NAO** |
| `party_hall_notifications` | SELECT (super_admin, sindico) | **NAO** |

## Correcao

Criar duas migrations SQL para adicionar politicas RLS de DELETE para super admins nessas tabelas:

### Migration 1: whatsapp_notification_logs
```sql
CREATE POLICY "Super admins can delete WABA logs"
  ON public.whatsapp_notification_logs
  FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role));
```

### Migration 2: party_hall_notifications
```sql
CREATE POLICY "Super admins can delete party hall notifications"
  ON public.party_hall_notifications
  FOR DELETE
  USING (has_role(auth.uid(), 'super_admin'::app_role));
```

Nenhuma alteracao de codigo e necessaria -- as chamadas `.delete()` ja estao no lugar certo (adicionadas na mensagem anterior). Apenas faltam as permissoes no banco de dados.


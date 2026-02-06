

# Plano de Exportacao do Banco de Dados

## Objetivo
Gerar scripts SQL completos (CREATE TABLE + INSERT) para migrar todos os dados do Lovable Cloud para o servidor externo (supabase.atenderchat.com.br).

## Entrega
Uma edge function chamada `export-database` que, ao ser chamada, retorna todos os scripts SQL organizados por tabela, prontos para serem executados no SQL Editor do novo servidor.

## Etapas

### 1. Criar edge function `export-database`
- A function consulta todas as tabelas e gera INSERTs para cada registro
- Retorna um JSON com os scripts organizados por tabela
- Inclui a ordem correta de importacao (respeitando foreign keys)

### 2. Scripts incluidos

**Estrutura (CREATE TABLE + tipos + funcoes):**
- Tipos ENUM: `app_role`, `occurrence_status`, `package_status`, `plan_type`
- Todas as 30+ tabelas com colunas, defaults e constraints
- Funcoes do banco (has_role, handle_new_user, etc.)
- Triggers
- Politicas RLS

**Dados (INSERT INTO):**
- plans (4 registros)
- app_settings (5 registros)
- package_types (15 registros)
- condominiums (2 registros)
- blocks (15 registros)
- apartments (300 registros)
- residents (279 registros)
- profiles (8 registros)
- user_roles (8 registros)
- user_condominiums (4 registros)
- subscriptions (2 registros)
- whatsapp_templates (~15 registros)
- whatsapp_config (1 registro)
- occurrences (1 registro)
- occurrence_evidences (1 registro)
- notifications_sent (~5 registros)
- party_hall_settings (1 registro)
- party_hall_bookings (6 registros)
- party_hall_checklist_templates (5 registros)
- packages (852 registros - em lotes)

### 3. Alternativa mais simples
Em vez de uma edge function, posso gerar os scripts SQL diretamente no chat para voce copiar e colar no SQL Editor do novo servidor. Cada tabela sera um bloco separado.

## Limitacoes
- Senhas de usuarios NAO podem ser exportadas - usuarios precisarao redefinir
- URLs de arquivos no storage apontam para o Lovable Cloud e nao funcionarao
- IDs (UUIDs) serao mantidos para preservar relacionamentos

## Secao Tecnica

### Ordem de execucao dos scripts
```text
1. ENUMs e tipos
2. plans, app_settings, package_types (sem dependencias)
3. condominiums
4. blocks (depende de condominiums)
5. apartments (depende de blocks)
6. residents (depende de apartments)
7. profiles (depende de auth.users)
8. user_roles (depende de auth.users)
9. user_condominiums (depende de auth.users + condominiums)
10. subscriptions (depende de condominiums)
11. whatsapp_templates, whatsapp_config
12. party_hall_settings (depende de condominiums)
13. party_hall_bookings (depende de party_hall_settings + residents)
14. party_hall_checklist_templates (depende de condominiums)
15. occurrences (depende de condominiums + blocks + apartments + residents)
16. occurrence_evidences (depende de occurrences)
17. notifications_sent (depende de occurrences + residents)
18. packages (depende de condominiums + blocks + apartments)
```

### Usuarios que precisam ser recriados no novo servidor
- superadmin@notificacondo.com.br (super_admin)
- condominiocentenario2018@gmail.com (sindico)
- porteiro@centenario.com.br (porteiro)
- julio@centenario.com.br (porteiro)
- thaisa@centenario.com.br (porteiro)
- ednauria@centenario.com.br (porteiro)
- leandrogalis@hotmail.com (morador)
- teste@hotmail.com (sindico)


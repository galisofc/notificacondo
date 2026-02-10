

## Importacao CSV com Upsert (Atualizar ou Criar)

### Comportamento Desejado
Ao importar um CSV de moradores, o sistema deve:
- **Atualizar** moradores que ja existem (mesmo nome no mesmo apartamento)
- **Criar** moradores que nao existem ainda

### O que sera feito

**1. Criar constraint unica no banco de dados**
- Adicionar uma constraint unica em `(apartment_id, UPPER(full_name))` na tabela `residents` para permitir o uso de upsert nativo
- Isso garante que nao existam dois moradores com o mesmo nome no mesmo apartamento

**2. Alterar logica de importacao em `BulkResidentCSVImportDialog.tsx`**
- Buscar moradores existentes por `full_name` + `apartment_id` (em vez de email)
- No `handleImport`, usar upsert: se o morador ja existe (mesmo nome + apartamento), atualizar os campos (telefone, proprietario, responsavel); se nao existe, criar
- Remover a logica de marcacao de duplicatas como "erro" -- duplicatas agora sao atualizacoes validas
- Atualizar o resumo final para mostrar quantos foram criados vs atualizados

**3. Alterar logica de importacao em `ResidentCSVImportDialog.tsx`**
- Mesma logica de upsert: buscar moradores existentes do apartamento, comparar por nome, atualizar ou criar
- Atualizar resumo final

### Detalhes Tecnicos

- Criar um indice unico funcional: `CREATE UNIQUE INDEX residents_apartment_name_unique ON residents (apartment_id, UPPER(full_name))`
- No codigo, usar `supabase.from("residents").upsert({...}, { onConflict: "apartment_id,full_name" })` ou fazer manualmente: buscar existente, se encontrou fazer UPDATE pelo id, senao INSERT
- Como a constraint usa `UPPER()`, a abordagem manual (fetch + compare + insert/update) sera mais confiavel
- Remover estados e UI relacionados a deteccao de duplicatas (campo `existingResidents` usado para marcar erros)
- Adicionar contagem separada de "atualizados" e "criados" no resultado final


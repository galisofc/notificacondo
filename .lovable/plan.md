

## Plano: Limpar BSUIDs de teste

### Ação
Executar UPDATE na tabela `residents` para definir `bsuid = NULL` nos registros de LEANDRO GALIS e ROSIANE, removendo os BSUIDs simulados para que sejam preenchidos com valores reais após 31/03.

### SQL
```sql
UPDATE residents SET bsuid = NULL WHERE full_name ILIKE '%leandro galis%' OR full_name ILIKE '%rosiane%';
```

### Arquivos
Nenhuma alteração de código — apenas operação de dados via insert tool.


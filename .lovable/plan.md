

## Historico de Advertencias por Unidade no Modulo de Ocorrencias

### O que sera feito

Adicionar um indicador visual que mostra quantas advertencias (e outros tipos de ocorrencias) um apartamento ja possui, visivel em dois locais:

### 1. Na lista de ocorrencias (`src/pages/Occurrences.tsx`)

- Ao lado de cada ocorrencia na listagem, exibir um badge/chip mostrando o total de advertencias daquela unidade (ex: "3a Advertencia")
- Isso permite ao sindico ter visao rapida do historico da unidade

### 2. Nos detalhes da ocorrencia (`src/pages/OccurrenceDetails.tsx`)

- Adicionar um card "Historico da Unidade" na pagina de detalhes
- Exibir contadores por tipo: Advertencias, Notificacoes, Multas
- Listar as ocorrencias anteriores da mesma unidade com data e status

### 3. No formulario de nova ocorrencia (`src/pages/Occurrences.tsx`)

- Ao selecionar um apartamento no formulario de criacao, exibir um alerta informativo caso a unidade ja tenha advertencias anteriores (ex: "Esta unidade ja possui 2 advertencias registradas")

### Detalhes Tecnicos

**Busca de dados:**
- Query na tabela `occurrences` filtrando por `apartment_id` para contar registros por tipo
- Reutilizar dados ja carregados quando possivel

**Na listagem (Occurrences.tsx):**
- Apos carregar as ocorrencias, agrupar por `apartment_id` e contar advertencias
- Criar um mapa `apartmentWarningsCount: Record<string, number>` 
- Exibir badge ao lado do nome do apartamento: "Xa Adv." (ex: "3a Adv.")

**Nos detalhes (OccurrenceDetails.tsx):**
- Buscar todas as ocorrencias do mesmo `apartment_id` (excluindo a atual)
- Exibir card com contadores e lista resumida das ocorrencias anteriores
- Usar cores distintas para cada tipo (amarelo para advertencias, azul para notificacoes, vermelho para multas)

**No formulario de criacao:**
- Ao mudar o `apartment_id`, fazer query para contar ocorrencias existentes
- Exibir alerta amarelo se houver historico


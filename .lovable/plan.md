

## Plano: Livro de Ocorrências Completo com Bloco/Apartamento

### Problema Atual
1. Apenas o **porteiro** pode criar ocorrências da portaria — o **síndico** não tem o botão "Nova Ocorrência"
2. O formulário de criação não tem campos para informar **qual unidade está abrindo** a ocorrência e **sobre qual unidade** é a reclamação
3. A tabela `porter_occurrences` não possui colunas para bloco/apartamento

### Solução

#### 1. Migração SQL — Adicionar colunas à tabela `porter_occurrences`
Adicionar 4 novas colunas para registrar origem e destino da ocorrência:

- `reporter_block_id` (uuid, nullable) — bloco de quem está registrando
- `reporter_apartment_id` (uuid, nullable) — apartamento de quem está registrando  
- `target_block_id` (uuid, nullable) — bloco alvo da reclamação
- `target_apartment_id` (uuid, nullable) — apartamento alvo da reclamação

Colunas são nullable porque nem toda ocorrência envolve uma unidade específica (ex: "Visitante suspeito no estacionamento").

#### 2. Atualizar formulário do Porteiro (`src/pages/porteiro/PortariaOccurrences.tsx`)
- Adicionar busca de blocos e apartamentos do condomínio selecionado
- Adicionar no formulário dois grupos de seletores:
  - **"Registrado por (Unidade)"**: Select de Bloco + Select de Apartamento (opcional)
  - **"Ocorrência sobre (Unidade)"**: Select de Bloco + Select de Apartamento (opcional)
- Incluir os novos campos no insert da mutation

#### 3. Adicionar criação de ocorrências na página do Síndico (`src/pages/sindico/PortariaOccurrences.tsx`)
- Adicionar botão "Nova Ocorrência" ao lado do botão "Categorias"
- Adicionar dialog com o mesmo formulário do porteiro (título, descrição, categoria, prioridade + blocos/apartamentos)
- Adicionar a mutation de criação (mesma lógica do porteiro)

#### 4. Exibir bloco/apartamento nos cards de ocorrência (ambas as páginas)
- Nos cards de listagem, mostrar as informações de "Registrado por" e "Sobre" quando preenchidas
- Usar o componente `BlockApartmentDisplay` já existente para exibir bloco/apto de forma padronizada
- Buscar nomes dos blocos/apartamentos via join na query de listagem

#### Arquivos Modificados
- **Migração SQL**: nova migração com `ALTER TABLE`
- `src/pages/porteiro/PortariaOccurrences.tsx` — formulário + exibição
- `src/pages/sindico/PortariaOccurrences.tsx` — adicionar criação + exibição




# Pagina de Exportacao do Banco de Dados

## Objetivo
Criar uma pagina no app (acessivel apenas por super_admin) com um botao para exportar o banco de dados, eliminando a necessidade de usar o console do navegador.

## O que sera feito

### 1. Nova pagina `/superadmin/export-database`
- Botao "Exportar Banco de Dados" que chama a edge function `export-database`
- Exibe os scripts SQL gerados na tela em blocos copiáveis
- Botao para copiar cada script individualmente
- Botao para copiar tudo de uma vez
- Indicador de loading durante a exportacao

### 2. Adicionar rota no App.tsx
- Nova rota protegida para super_admin

### 3. Link no menu do superadmin
- Adicionar acesso rapido a partir do painel de administracao

## Secao Tecnica

### Arquivos a criar
- `src/pages/superadmin/ExportDatabase.tsx` - Pagina principal com botao de exportacao e visualizacao dos scripts

### Arquivos a editar
- `src/App.tsx` - Adicionar rota `/superadmin/export-database`
- Menu/navegacao do superadmin (se existir) - Adicionar link

### Fluxo
1. Super admin acessa a pagina
2. Clica em "Exportar"
3. Edge function `export-database` e chamada
4. Scripts SQL sao exibidos organizados por tabela
5. Usuario copia os scripts e executa no SQL Editor do novo servidor


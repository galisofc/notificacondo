

## Plano: Nova Landing Page Completa

### Problema
A landing page atual mostra apenas 3 módulos (Ocorrências, Encomendas, Salão de Festas) mas o sistema cresceu com mais funcionalidades: **Portaria** (passagem de plantão, livro de recados, banners, ocorrências da portaria) e **Manutenção** (zeladores, categorias, historico). Além disso, o componente `Testimonials` existe mas não está sendo usado, e referências antigas ao "ZPRO" ainda aparecem nos textos.

### Mudanças Planejadas

#### 1. Atualizar `Index.tsx` — Adicionar Testimonials
- Importar e adicionar o componente `Testimonials` entre `Workflow` e `Pricing`

#### 2. Atualizar `Hero.tsx` — Adicionar pills dos novos módulos
- Adicionar pills para **Portaria** e **Manutenção** ao lado dos 3 existentes
- Atualizar subtítulo para refletir os 5 módulos
- Atualizar estatísticas (ex: "5 módulos integrados")

#### 3. Atualizar `Features.tsx` — Adicionar 2 novas abas de módulos
- Expandir TabsList de 3 para 5 colunas
- Adicionar aba **Portaria** com features:
  - Passagem de Plantão (registro detalhado entre turnos)
  - Livro de Recados (comunicação entre porteiros estilo chat)
  - Banners Informativos (avisos rotativos por condomínio)
  - Ocorrências da Portaria (registro de incidentes com bloco/apto)
  - Controle de Acesso (gestão de visitantes e entregas)
  - Checklist de Ronda (verificação de itens por turno)
- Adicionar aba **Manutenção** com features:
  - Dashboard de Manutenções (visão geral de chamados)
  - Categorias Personalizáveis (tipos de manutenção)
  - Atribuição a Zeladores (distribuição de tarefas)
  - Histórico Completo (registro de todas as manutenções)
  - Prioridades e Status (controle de urgência)
  - Notificação ao Zelador (alerta WhatsApp automático)
- Atualizar "Recursos em Todos os Módulos" de 4 para incluir WhatsApp WABA
- Corrigir referência "ZPRO" para "WhatsApp oficial (WABA)"

#### 4. Atualizar `Workflow.tsx` — Adicionar fluxos dos novos módulos
- Adicionar fluxo **Portaria** (6 passos: início do plantão, rondas, registro de ocorrências, recados, passagem de plantão, relatório)
- Adicionar fluxo **Manutenção** (6 passos: abertura do chamado, categorização, atribuição ao zelador, execução, conclusão, histórico)
- Expandir TabsList de 3 para 5 colunas

#### 5. Atualizar `FAQ.tsx` — Adicionar categorias dos novos módulos
- Adicionar categoria **Portaria** com 4 perguntas sobre plantão, recados e ocorrências
- Adicionar categoria **Manutenção** com 4 perguntas sobre chamados e zeladores

#### 6. Atualizar `Pricing.tsx` — Incluir badges dos 5 módulos
- Atualizar de "4 módulos" para "5 módulos" nos badges
- Adicionar pills de Portaria e Manutenção

#### 7. Atualizar `CTA.tsx` — Texto mais abrangente
- Ajustar copy para refletir gestão completa (não só multas)

#### 8. Atualizar `Footer.tsx` — Descrição atualizada
- Atualizar descrição de "notificações, advertências e multas" para "gestão condominial completa"

#### 9. Atualizar `ScreenshotsModal.tsx` — Adicionar telas dos novos módulos
- Adicionar telas de Portaria e Manutenção ao carrossel

#### 10. Atualizar `Header.tsx` — Link FAQ
- Adicionar link "FAQ" na navegação

### Arquivos Modificados
- `src/pages/Index.tsx`
- `src/components/landing/Hero.tsx`
- `src/components/landing/Features.tsx`
- `src/components/landing/Workflow.tsx`
- `src/components/landing/FAQ.tsx`
- `src/components/landing/Pricing.tsx`
- `src/components/landing/CTA.tsx`
- `src/components/landing/Footer.tsx`
- `src/components/landing/ScreenshotsModal.tsx`
- `src/components/landing/Header.tsx`




## Plano: Remover aba "Conteúdo" do Editor de Templates

### Contexto
O sistema agora funciona exclusivamente com WABA (API oficial da Meta). A aba "Conteúdo" permite editar texto local que nunca será usado no envio real -- o conteúdo válido é sempre o aprovado pela Meta. Manter essa aba gera confusão.

### Solução
Remover o sistema de abas e manter apenas o conteúdo da aba "WABA Template" como a única view do editor. Campos que serão **removidos**: textarea de conteúdo local, variáveis clicáveis para inserção, botão "Restaurar Padrão". Campos que **permanecem**: Nome, Descrição, toda a configuração WABA (template name, idioma, parâmetros, botões), preview da Meta.

### Mudanças no arquivo

**`src/components/superadmin/whatsapp/TemplateEditor.tsx`**:
1. Remover o state `activeTab` e a lógica de abas
2. Remover a seção inteira da aba "Conteúdo" (textarea, variáveis clicáveis, `insertVariable`)
3. Manter os campos Nome e Descrição no topo do formulário (acima da configuração WABA)
4. Manter toda a seção WABA como conteúdo principal (vinculação, idioma, parâmetros, botões)
5. O preview sempre mostrará o conteúdo da Meta (não mais condicional por aba)
6. Remover o botão "Restaurar Padrão" e a `resetMutation` (não faz sentido sem conteúdo local)
7. Manter o dialog de teste WABA intacto
8. Remover a opção de formato "Z-PRO (simplificado)" do dialog de teste, já que o sistema é exclusivamente WABA/Meta


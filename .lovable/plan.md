

## Problema

Quando o sidebar está colapsado (modo ícone), os submenus dos grupos (Gestão, Portaria, etc.) ficam com `hidden` e não há como acessá-los. Linha 686: `collapsed && "hidden"`.

## Solução

Quando o sidebar estiver colapsado, ao passar o mouse sobre um grupo, exibir um **popover/tooltip** com os subitens do menu. Isso é um padrão comum em sidebars colapsadas.

## Plano

### Arquivo: `src/components/layouts/DashboardLayout.tsx`

1. **Substituir o comportamento de grupos quando colapsado**: Em vez de esconder os subitens com `hidden`, quando `collapsed === true`, envolver o grupo em um componente com hover que mostra um popover flutuante com os subitens.

2. **Implementação**: Usar `HoverCard` ou um `Popover` posicionado à direita do ícone do grupo. Na prática, a abordagem mais simples é:
   - Quando `collapsed`, renderizar o grupo dentro de um `Tooltip` customizado ou um `div` com estado `onMouseEnter`/`onMouseLeave` que mostra um menu flutuante posicionado `absolute` à direita.
   - O menu flutuante terá os mesmos subitens com links de navegação.

3. **Detalhes técnicos**:
   - Adicionar estado local `hoveredGroup` (string | null) no componente `SidebarNavContent`
   - No `onMouseEnter` do grupo colapsado, setar `hoveredGroup = item.title`
   - No `onMouseLeave`, limpar com delay de ~200ms para permitir mover o mouse para o submenu
   - Renderizar um `div` com `position: absolute; left: 100%; top: 0` contendo os subitens estilizados como um mini-menu dropdown
   - Manter o comportamento atual (Collapsible) quando não colapsado


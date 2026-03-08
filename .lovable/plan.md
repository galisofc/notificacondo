

## Plano: Eliminar Queries Duplicadas com UserRole Context + Consolidar Dados

### Problema Principal
Os network requests mostram que ao carregar a página do porteiro, acontecem **simultaneamente**:
- `user_roles` → 4 queries idênticas
- `profiles` → 3 queries idênticas
- `user_condominiums` → 3 queries idênticas

Isso ocorre porque `useUserRole()` é chamado independentemente em **ProtectedRoute**, **DashboardLayout (SidebarNavigation)**, e na **página atual** - cada um fazendo suas próprias queries diretas ao banco (sem React Query cache).

Além disso, **PorteiroDashboard** faz queries separadas para `user_condominiums` e `profiles` que o `useUserRole` já busca.

### Solução

#### 1. Converter useUserRole para Context Provider (MAIOR IMPACTO)
Assim como `useAuth` usa Context, criar `UserRoleProvider` que busca os dados **uma única vez** e compartilha via context com todos os componentes.

- Criar `UserRoleProvider` wrapping as rotas protegidas (dentro de `AuthProvider`)
- O hook `useUserRole()` passa a ler do context em vez de fazer queries
- **Resultado: de ~12 queries por page load para ~3-4**

#### 2. Eliminar queries duplicadas no PorteiroDashboard
O dashboard do porteiro busca `user_condominiums` e `profiles` separadamente, mas o `useUserRole` já fornece `porteiroCondominiums` e `profileInfo`.

- Remover os `useEffect` que buscam condominiums e userName
- Usar `porteiroCondominiums` e `profileInfo` do context

#### 3. Eliminar queries duplicadas no DashboardLayout
O `SidebarNavigation` busca `user_condominiums` para porteiros (linha 429-434), mas o `useUserRole` já fornece `porteiroCondominiums`.

- Usar `porteiroCondominiums` do context em vez de buscar novamente

#### 4. Remover realtime subscriptions do DashboardLayout
Há **5 WebSocket channels** abertos simultaneamente no layout:
- `contact-messages-changes` (super_admin)
- `occurrences-status-changes` (sindico)
- `porter-occurrences-badge` (sindico)
- `packages-status-changes` (porteiro)
- `porter-occs-porteiro-badge` (porteiro)

Mais 1 no SuperAdminDashboard (`audit-logs-realtime`) e 1 no SindicoInvoices (`invoices-realtime`).

Cada WebSocket mantém uma conexão permanente + dispara queries adicionais a cada evento.

- Substituir realtime por polling com `refetchInterval: 60000` (60s) apenas quando a página está visível
- Manter apenas o realtime de `contact-messages` para super_admin (notificação sonora)

#### 5. Converter badges do DashboardLayout para React Query
Os contadores de badges (pendingDefenses, openOccurrences, pendingPackages, etc.) usam `useState` + `useEffect` direto, sem cache. Cada navegação refaz todas as queries.

- Migrar para `useQuery` com `staleTime: 60000` (1 min) para aproveitar o cache global

### Resumo de Impacto

| Otimização | Queries eliminadas por page load |
|---|---|
| UserRole Context | ~8 queries duplicadas |
| PorteiroDashboard consolidação | ~2 queries |
| DashboardLayout consolidação | ~2 queries |
| Remover 4 realtime channels | 4 WebSockets + queries por evento |
| Badges com React Query cache | ~5 queries por navegação |

**Total estimado: redução de ~60-70% do consumo restante.**

### Arquivos a Modificar
- `src/hooks/useUserRole.tsx` → Adicionar Context Provider
- `src/App.tsx` → Wrap com UserRoleProvider
- `src/pages/porteiro/Dashboard.tsx` → Usar dados do context
- `src/components/layouts/DashboardLayout.tsx` → Usar context + React Query para badges, remover realtime
- `src/pages/SuperAdminDashboard.tsx` → Remover realtime de audit_logs
- `src/pages/SindicoInvoices.tsx` → Remover realtime de invoices


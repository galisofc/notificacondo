

## Plano de Otimização do Consumo de Cloud

O projeto está consumindo recursos excessivos por falta de cache global no React Query e por polling agressivo em páginas administrativas. Abaixo, as otimizações organizadas por impacto.

---

### 1. Configurar cache global no QueryClient (MAIOR IMPACTO)

Atualmente em `src/App.tsx` linha 88:
```tsx
const queryClient = new QueryClient();
```

Sem configuração, o React Query usa `staleTime: 0` (toda query é considerada "stale" imediatamente) e `refetchOnWindowFocus: true`. Isso significa que **cada troca de aba ou foco na janela refaz TODAS as queries ativas**.

**Ação**: Configurar defaults globais:
```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 minutos - dados ficam "fresh"
      gcTime: 1000 * 60 * 10,          // 10 minutos no cache
      refetchOnWindowFocus: false,      // NÃO refazer ao focar janela
      refetchOnReconnect: false,        // NÃO refazer ao reconectar
      retry: 1,                         // Só 1 retry em vez de 3
    },
  },
});
```

Isso sozinho pode reduzir 50-70% das queries ao banco.

---

### 2. Remover realtime do useUserRole (IMPACTO MÉDIO)

Em `src/hooks/useUserRole.tsx` linhas 246-277, há uma subscription realtime na tabela `profiles` para detectar mudanças no perfil. Isso mantém uma conexão WebSocket permanente com o banco.

**Ação**: Remover o `useEffect` com `supabase.channel("profile-changes")`. O `refetchProfile()` já existe e pode ser chamado manualmente quando o usuário edita o perfil.

---

### 3. Remover realtime do usePackages para moradores (IMPACTO MÉDIO)

Em `src/pages/resident/Packages.tsx` linha 34, `realtime: true` mantém uma subscription WebSocket ativa. O morador pode simplesmente usar pull-to-refresh.

**Ação**: Mudar para `realtime: false`.

---

### 4. Reduzir polling nas páginas SuperAdmin (IMPACTO BAIXO-MÉDIO)

Quatro locais com `refetchInterval` agressivo:
- `EdgeFunctionLogs.tsx`: 10s → 60s
- `WabaLogs.tsx`: 15s → 60s
- `RlsPoliciesCard.tsx`: 30s → 120s
- `CronJobsMonitor.tsx`: 30s (2 queries) → 120s

**Ação**: Aumentar todos os intervalos e adicionar `refetchIntervalInBackground: false` para pausar polling quando a aba não está visível.

---

### 5. Adicionar staleTime às queries mais chamadas (IMPACTO MÉDIO)

Muitas queries de dados que mudam raramente (condomínios, blocos, apartamentos, categorias) não têm `staleTime`, causando refetch desnecessário a cada mount de componente.

Queries prioritárias para adicionar `staleTime`:
- Condomínios do sindico: `staleTime: 5 min`
- Blocos/Apartamentos: `staleTime: 5 min`
- Package types: `staleTime: 30 min`
- Plans/App settings: `staleTime: 30 min` (useTrialDays já tem 30min)
- Subscription status: já tem 30s, aumentar para `2 min`

---

### 6. useUserRole é chamado em CADA ProtectedRoute

Cada navegação de página invoca `useUserRole()` que faz 2-4 queries ao banco (roles, profile, condominiums, residents). Como não usa React Query, não há cache.

**Ação**: O useUserRole já guarda em state e só refaz quando `user` muda. Não precisa alteração estrutural, mas o item 1 (global staleTime) não cobre isso. Recomendo manter como está, pois é executado uma vez por sessão.

---

### Resumo de Impacto Estimado

| Otimização | Redução estimada |
|---|---|
| Cache global QueryClient | ~50-70% das queries repetidas |
| Remover realtime profiles | 1 WebSocket permanente |
| Remover realtime packages | 1 WebSocket + queries por evento |
| Reduzir polling SuperAdmin | ~80% das queries de polling |
| staleTime em queries comuns | ~30% das queries de navegação |

Todas as mudanças são em arquivos de frontend existentes, sem necessidade de migrações SQL.


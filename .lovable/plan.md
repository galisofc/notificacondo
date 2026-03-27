

## Problem

All queries fetching packages hit Supabase's default 1,000-row limit. The "Total" stat card and all other counters are capped at 1,000, even when the condominium has more packages.

Three queries are affected:
1. **Main packages query** (line 151) — fetches the table data
2. **blockStatsData query** (line 228) — fetches data for block stat cards  
3. **pendingPackages query** (line 257) — fetches pending packages for summary modal

## Plan

### 1. Add separate count queries using Supabase `count`

Create dedicated count queries using `{ count: 'exact', head: true }` for:
- **Total count** (no filters except condominium + date range)
- **Pendente count** (filtered by status)
- **Retirada count** (filtered by status)

These count queries apply the same date/block/status filters as the current query but don't hit the row limit since they only return the count.

### 2. Paginate data-fetching queries

For the main packages list and blockStatsData, add `.range(0, 9999)` or implement pagination to fetch beyond the 1,000 limit. For the table display, we can keep pagination at the UI level while fetching all data for stats.

Alternatively, use a simpler approach: add `.limit(10000)` to the blockStatsData and main queries to raise the cap significantly.

### 3. Use count-based stats instead of array length

Replace `stats.total = packages.length` with the value from the dedicated count query, so the stat cards show the true total even if the table is paginated.

### Technical details

**Files to modify:** `src/pages/sindico/PackagesCondominiumHistory.tsx`

- Add 3 new `useQuery` hooks with `supabase.from("packages").select("*", { count: "exact", head: true })` applying appropriate filters for total/pendente/retirada counts
- Update the `stats` useMemo to use these count values instead of `packages.length`
- The blockStatsData and main packages queries will also get `.range(0, 9999)` to support up to 10,000 rows for detailed stats and PDF export




## Problem

The `packages` table has a `picked_up_by_name` column (denormalized) but no `received_by_name` column. The previous fix removed `received_by_name` from the insert because the column didn't exist, which caused the "Recebido por" field to show "-" on pages where the profile join doesn't resolve (external VPS).

The display code uses: `(pkg as any).received_by_name || pkg.received_by_profile?.full_name || "-"` -- since the column doesn't exist and the profile join may fail on the external VPS, it falls back to "-".

## Plan

### 1. Database Migration
Add `received_by_name` column to the `packages` table:
```sql
ALTER TABLE public.packages ADD COLUMN received_by_name text;
```

Then backfill existing records from profiles:
```sql
UPDATE public.packages p
SET received_by_name = pr.full_name
FROM public.profiles pr
WHERE pr.user_id = p.received_by
AND p.received_by_name IS NULL;
```

### 2. Update RegisterPackage.tsx
In the insert payload (~line 251), fetch the porter's name from profiles before inserting and include `received_by_name` in the insert object. The porter's profile name can be fetched once at the start of the submission or obtained from the existing profile query.

Add to the insert:
```tsx
received_by_name: porterName,
```

Where `porterName` is fetched via:
```tsx
const { data: profileData } = await supabase
  .from("profiles")
  .select("full_name")
  .eq("user_id", user.id)
  .single();
```

This ensures the porter name is denormalized directly into the package record, matching the same pattern used for `picked_up_by_name`.


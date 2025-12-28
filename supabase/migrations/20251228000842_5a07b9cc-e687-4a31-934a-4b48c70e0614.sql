-- Create a function to get RLS status for all public tables
CREATE OR REPLACE FUNCTION public.get_rls_status()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policy_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.relname::text as table_name,
    c.relrowsecurity as rls_enabled,
    COALESCE(p.policy_count, 0) as policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN (
    SELECT 
      polrelid,
      COUNT(*) as policy_count
    FROM pg_policy
    GROUP BY polrelid
  ) p ON p.polrelid = c.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.relname;
$$;
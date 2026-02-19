CREATE OR REPLACE FUNCTION public.get_co_porters(_user_id uuid, _condominium_id uuid)
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name
  FROM public.user_condominiums uc
  JOIN public.profiles p ON p.user_id = uc.user_id
  WHERE uc.condominium_id = _condominium_id
    AND uc.user_id <> _user_id
    AND p.full_name IS NOT NULL
    AND p.full_name <> ''
  ORDER BY p.full_name;
$$;
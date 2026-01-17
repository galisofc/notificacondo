-- Função para confirmar retirada de encomenda com timestamp do servidor
CREATE OR REPLACE FUNCTION public.confirm_package_pickup(
  p_package_id UUID,
  p_picked_up_by UUID,
  p_picked_up_by_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE packages
  SET 
    status = 'retirada',
    picked_up_at = now(),
    picked_up_by = p_picked_up_by,
    picked_up_by_name = p_picked_up_by_name
  WHERE id = p_package_id;
END;
$$;
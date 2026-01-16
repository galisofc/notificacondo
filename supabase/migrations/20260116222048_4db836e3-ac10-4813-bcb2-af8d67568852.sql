-- Allow porters to view residents of their assigned condominiums
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='residents'
      AND policyname='Porters can view residents of assigned condominiums'
  ) THEN
    EXECUTE 'DROP POLICY "Porters can view residents of assigned condominiums" ON public.residents';
  END IF;
END $$;

CREATE POLICY "Porters can view residents of assigned condominiums"
ON public.residents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.apartments a
    JOIN public.blocks b ON b.id = a.block_id
    WHERE a.id = residents.apartment_id
    AND public.user_belongs_to_condominium(auth.uid(), b.condominium_id)
  )
);
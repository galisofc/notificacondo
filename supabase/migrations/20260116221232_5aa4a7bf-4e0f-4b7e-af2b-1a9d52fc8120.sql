-- Allow porters to view blocks of their assigned condominiums
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='blocks'
      AND policyname='Porters can view assigned condominium blocks'
  ) THEN
    EXECUTE 'DROP POLICY "Porters can view assigned condominium blocks" ON public.blocks';
  END IF;
END $$;

CREATE POLICY "Porters can view assigned condominium blocks"
ON public.blocks
FOR SELECT
TO authenticated
USING (public.user_belongs_to_condominium(auth.uid(), condominium_id));

-- Allow porters to view apartments of their assigned condominiums
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='apartments'
      AND policyname='Porters can view assigned condominium apartments'
  ) THEN
    EXECUTE 'DROP POLICY "Porters can view assigned condominium apartments" ON public.apartments';
  END IF;
END $$;

CREATE POLICY "Porters can view assigned condominium apartments"
ON public.apartments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE b.id = apartments.block_id
    AND public.user_belongs_to_condominium(auth.uid(), b.condominium_id)
  )
);
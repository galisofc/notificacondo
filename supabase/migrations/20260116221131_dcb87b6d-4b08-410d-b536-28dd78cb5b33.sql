-- Allow porters to view condominiums they are linked to via user_condominiums
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='condominiums'
      AND policyname='Porters can view assigned condominiums'
  ) THEN
    EXECUTE 'DROP POLICY "Porters can view assigned condominiums" ON public.condominiums';
  END IF;
END $$;

CREATE POLICY "Porters can view assigned condominiums"
ON public.condominiums
FOR SELECT
TO authenticated
USING (public.user_belongs_to_condominium(auth.uid(), id));
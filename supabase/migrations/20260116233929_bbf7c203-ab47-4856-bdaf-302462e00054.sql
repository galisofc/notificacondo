-- Allow porters to insert residents in apartments of their assigned condominiums
CREATE POLICY "Porters can insert residents in assigned condominiums"
ON public.residents
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM apartments a
    JOIN blocks b ON b.id = a.block_id
    WHERE a.id = apartment_id
    AND user_belongs_to_condominium(auth.uid(), b.condominium_id)
  )
);

-- Allow porters to update residents in apartments of their assigned condominiums
CREATE POLICY "Porters can update residents in assigned condominiums"
ON public.residents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM apartments a
    JOIN blocks b ON b.id = a.block_id
    WHERE a.id = residents.apartment_id
    AND user_belongs_to_condominium(auth.uid(), b.condominium_id)
  )
);
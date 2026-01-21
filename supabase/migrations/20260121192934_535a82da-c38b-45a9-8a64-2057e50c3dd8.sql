-- Create DELETE policy for porters to delete residents in assigned condominiums
CREATE POLICY "Porters can delete residents in assigned condominiums"
ON public.residents
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM apartments a
    JOIN blocks b ON b.id = a.block_id
    WHERE a.id = residents.apartment_id
    AND user_belongs_to_condominium(auth.uid(), b.condominium_id)
  )
);
-- Add INSERT policy for condominium owners to create invoices
CREATE POLICY "Condominium owners can create invoices"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.condominiums c
    WHERE c.id = invoices.condominium_id
    AND c.owner_id = auth.uid()
  )
);
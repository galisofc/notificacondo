
-- Allow síndicos to view porter occurrences in their condominiums
CREATE POLICY "Sindicos can view porter occurrences"
ON public.porter_occurrences
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM condominiums c
  WHERE c.id = porter_occurrences.condominium_id AND c.owner_id = auth.uid()
));

-- Allow síndicos to update porter occurrences (resolve/finalize)
CREATE POLICY "Sindicos can update porter occurrences"
ON public.porter_occurrences
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM condominiums c
  WHERE c.id = porter_occurrences.condominium_id AND c.owner_id = auth.uid()
));

-- Allow síndicos to delete porter occurrences
CREATE POLICY "Sindicos can delete porter occurrences"
ON public.porter_occurrences
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM condominiums c
  WHERE c.id = porter_occurrences.condominium_id AND c.owner_id = auth.uid()
));

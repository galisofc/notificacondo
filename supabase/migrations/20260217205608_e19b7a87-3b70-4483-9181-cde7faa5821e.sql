
-- Allow síndicos to delete shift handovers in their condominiums
CREATE POLICY "Sindicos can delete shift handovers in their condominiums"
ON public.shift_handovers FOR DELETE
USING (EXISTS (
  SELECT 1 FROM condominiums c
  WHERE c.id = shift_handovers.condominium_id AND c.owner_id = auth.uid()
));

-- Allow síndicos to delete shift handover items via handover
CREATE POLICY "Sindicos can delete shift handover items"
ON public.shift_handover_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM shift_handovers sh
  JOIN condominiums c ON c.id = sh.condominium_id
  WHERE sh.id = shift_handover_items.handover_id AND c.owner_id = auth.uid()
));

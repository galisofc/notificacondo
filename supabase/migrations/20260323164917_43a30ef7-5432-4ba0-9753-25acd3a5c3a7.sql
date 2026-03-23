ALTER TABLE public.porter_occurrences 
  ADD COLUMN IF NOT EXISTS reporter_block_id uuid REFERENCES public.blocks(id),
  ADD COLUMN IF NOT EXISTS reporter_apartment_id uuid REFERENCES public.apartments(id),
  ADD COLUMN IF NOT EXISTS target_block_id uuid REFERENCES public.blocks(id),
  ADD COLUMN IF NOT EXISTS target_apartment_id uuid REFERENCES public.apartments(id);
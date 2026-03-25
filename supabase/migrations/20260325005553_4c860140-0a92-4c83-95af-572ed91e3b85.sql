ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS bsuid text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_bsuid ON public.residents (bsuid) WHERE bsuid IS NOT NULL;
-- Add short_code column to blocks table for quick search
ALTER TABLE public.blocks 
ADD COLUMN short_code VARCHAR(3) NULL;

-- Create index for faster lookups
CREATE INDEX idx_blocks_short_code ON public.blocks(short_code) WHERE short_code IS NOT NULL;

-- Add unique constraint per condominium (short codes must be unique within a condominium)
CREATE UNIQUE INDEX idx_blocks_short_code_unique 
ON public.blocks(condominium_id, short_code) 
WHERE short_code IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.blocks.short_code IS 'Código curto de 1-3 caracteres para busca rápida (ex: AR=ARMANDO, VI=VILELA)';
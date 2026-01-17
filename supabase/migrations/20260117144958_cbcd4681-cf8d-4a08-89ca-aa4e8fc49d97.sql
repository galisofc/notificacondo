-- Update all existing block names to uppercase
UPDATE public.blocks
SET name = UPPER(name)
WHERE name IS NOT NULL;
-- Update all existing resident names to uppercase
UPDATE public.residents
SET full_name = UPPER(full_name)
WHERE full_name IS NOT NULL;
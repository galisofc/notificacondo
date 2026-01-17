-- Add column to store the name of the person who picked up the package
ALTER TABLE public.packages ADD COLUMN picked_up_by_name text;
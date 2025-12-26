-- Add floors column to blocks table
ALTER TABLE public.blocks ADD COLUMN floors integer NOT NULL DEFAULT 1;
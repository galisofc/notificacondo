-- Add missing columns to condominiums table
ALTER TABLE public.condominiums 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS neighborhood text;
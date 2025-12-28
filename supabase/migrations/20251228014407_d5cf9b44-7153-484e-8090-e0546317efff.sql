-- Add address_number column to condominiums table
ALTER TABLE public.condominiums 
ADD COLUMN address_number VARCHAR(20) NULL;
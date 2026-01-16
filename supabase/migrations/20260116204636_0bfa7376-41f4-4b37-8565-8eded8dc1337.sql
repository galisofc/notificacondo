-- Fix foreign key constraint on magic_link_access_logs to allow occurrence deletion
-- Drop the existing constraint and recreate with ON DELETE SET NULL

ALTER TABLE public.magic_link_access_logs 
DROP CONSTRAINT IF EXISTS magic_link_access_logs_occurrence_id_fkey;

ALTER TABLE public.magic_link_access_logs 
ADD CONSTRAINT magic_link_access_logs_occurrence_id_fkey 
FOREIGN KEY (occurrence_id) 
REFERENCES public.occurrences(id) 
ON DELETE SET NULL;
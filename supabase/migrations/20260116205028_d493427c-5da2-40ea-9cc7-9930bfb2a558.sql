-- Alterar a constraint de magic_link_access_logs para residents
ALTER TABLE public.magic_link_access_logs
DROP CONSTRAINT IF EXISTS magic_link_access_logs_resident_id_fkey;

ALTER TABLE public.magic_link_access_logs
ADD CONSTRAINT magic_link_access_logs_resident_id_fkey
FOREIGN KEY (resident_id)
REFERENCES public.residents(id)
ON DELETE SET NULL;
-- Alterar a foreign key de notifications_sent para SET NULL ao deletar ocorrência
-- Isso preserva o histórico de notificações enviadas para relatórios

-- Primeiro, remover a constraint existente
ALTER TABLE public.notifications_sent 
DROP CONSTRAINT IF EXISTS notifications_sent_occurrence_id_fkey;

-- Adicionar novamente com ON DELETE SET NULL
ALTER TABLE public.notifications_sent 
ADD CONSTRAINT notifications_sent_occurrence_id_fkey 
FOREIGN KEY (occurrence_id) 
REFERENCES public.occurrences(id) 
ON DELETE SET NULL;

-- Tornar a coluna occurrence_id nullable (se ainda não for)
ALTER TABLE public.notifications_sent 
ALTER COLUMN occurrence_id DROP NOT NULL;
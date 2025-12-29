-- First, update any occurrences with 'analisando' status to 'em_defesa' (the previous state)
UPDATE public.occurrences 
SET status = 'em_defesa' 
WHERE status = 'analisando';

-- Remove 'analisando' from the enum by recreating it
-- Step 1: Create new enum without 'analisando'
CREATE TYPE occurrence_status_new AS ENUM (
  'registrada',
  'notificado',
  'em_defesa',
  'arquivada',
  'advertido',
  'multado'
);

-- Step 2: Drop the default on occurrences.status before changing the type
ALTER TABLE public.occurrences ALTER COLUMN status DROP DEFAULT;

-- Step 3: Update the column to use the new enum
ALTER TABLE public.occurrences 
  ALTER COLUMN status TYPE occurrence_status_new 
  USING status::text::occurrence_status_new;

-- Step 4: Restore the default
ALTER TABLE public.occurrences ALTER COLUMN status SET DEFAULT 'registrada'::occurrence_status_new;

-- Step 5: Update the decisions table if it references this enum
ALTER TABLE public.decisions 
  ALTER COLUMN decision TYPE occurrence_status_new 
  USING decision::text::occurrence_status_new;

-- Step 6: Drop old enum and rename new one
DROP TYPE occurrence_status;
ALTER TYPE occurrence_status_new RENAME TO occurrence_status;
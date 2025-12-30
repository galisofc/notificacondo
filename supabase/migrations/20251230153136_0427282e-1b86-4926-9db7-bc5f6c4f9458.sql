-- Add defense deadline days configuration to condominiums table
ALTER TABLE public.condominiums 
ADD COLUMN defense_deadline_days integer NOT NULL DEFAULT 10;

-- Add comment for documentation
COMMENT ON COLUMN public.condominiums.defense_deadline_days IS 'Number of days residents have to submit their defense after receiving a notification';
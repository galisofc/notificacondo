-- Add invoice_number column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN invoice_number VARCHAR(20) NULL;

-- Create a sequence for invoice numbers per year
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER;
  seq_number INTEGER;
  invoice_count INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  
  -- Count existing invoices for this year
  SELECT COUNT(*) + 1 INTO invoice_count
  FROM public.invoices 
  WHERE EXTRACT(YEAR FROM created_at) = current_year
  AND invoice_number IS NOT NULL;
  
  -- Generate the invoice number: FAT-YYYY00000
  NEW.invoice_number := 'FAT-' || current_year || LPAD(invoice_count::TEXT, 5, '0');
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate invoice number on insert
CREATE TRIGGER generate_invoice_number_trigger
BEFORE INSERT ON public.invoices
FOR EACH ROW
WHEN (NEW.invoice_number IS NULL)
EXECUTE FUNCTION public.generate_invoice_number();

-- Update existing invoices with invoice numbers
DO $$
DECLARE
  inv RECORD;
  counter INTEGER := 0;
  current_year INTEGER;
  last_year INTEGER := 0;
BEGIN
  FOR inv IN 
    SELECT id, created_at 
    FROM public.invoices 
    WHERE invoice_number IS NULL
    ORDER BY created_at ASC
  LOOP
    current_year := EXTRACT(YEAR FROM inv.created_at);
    
    -- Reset counter when year changes
    IF current_year != last_year THEN
      counter := 0;
      last_year := current_year;
    END IF;
    
    counter := counter + 1;
    
    UPDATE public.invoices 
    SET invoice_number = 'FAT-' || current_year || LPAD(counter::TEXT, 5, '0')
    WHERE id = inv.id;
  END LOOP;
END $$;
-- Enable realtime for invoices table
ALTER TABLE public.invoices REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
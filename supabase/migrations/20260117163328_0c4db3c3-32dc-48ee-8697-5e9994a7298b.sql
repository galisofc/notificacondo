-- Add is_lifetime column to subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN is_lifetime BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.subscriptions.is_lifetime IS 
  'Quando true, a assinatura é vitalícia, não expira e não gera faturas';
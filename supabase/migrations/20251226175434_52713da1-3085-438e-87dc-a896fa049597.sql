-- Create invoices table for subscription billing per condominium
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date DATE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  payment_reference TEXT,
  description TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Condominium owners can view their invoices
CREATE POLICY "Condominium owners can view invoices"
ON public.invoices
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.condominiums c
  WHERE c.id = invoices.condominium_id AND c.owner_id = auth.uid()
));

-- Condominium owners can update their invoices (for marking as paid)
CREATE POLICY "Condominium owners can update invoices"
ON public.invoices
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.condominiums c
  WHERE c.id = invoices.condominium_id AND c.owner_id = auth.uid()
));

-- Super admins can manage all invoices
CREATE POLICY "Super admins can manage all invoices"
ON public.invoices
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_invoices_condominium_id ON public.invoices(condominium_id);
CREATE INDEX idx_invoices_subscription_id ON public.invoices(subscription_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
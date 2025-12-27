-- Create table to track condominium ownership transfers
CREATE TABLE public.condominium_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  from_owner_id UUID NOT NULL,
  to_owner_id UUID NOT NULL,
  transferred_by UUID NOT NULL,
  transferred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX idx_condominium_transfers_condominium_id ON public.condominium_transfers(condominium_id);
CREATE INDEX idx_condominium_transfers_from_owner ON public.condominium_transfers(from_owner_id);
CREATE INDEX idx_condominium_transfers_to_owner ON public.condominium_transfers(to_owner_id);

-- Enable RLS
ALTER TABLE public.condominium_transfers ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all transfers
CREATE POLICY "Super admins can manage all transfers"
ON public.condominium_transfers
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Sindicos can view transfers involving their condominiums
CREATE POLICY "Sindicos can view own transfers"
ON public.condominium_transfers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.condominiums c
    WHERE c.id = condominium_transfers.condominium_id
    AND c.owner_id = auth.uid()
  )
  OR from_owner_id = auth.uid()
  OR to_owner_id = auth.uid()
);

-- Add comment for documentation
COMMENT ON TABLE public.condominium_transfers IS 'Tracks ownership transfers of condominiums between síndicos';
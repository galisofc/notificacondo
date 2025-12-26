-- Create a table for Mercado Pago configuration
CREATE TABLE public.mercadopago_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token_encrypted TEXT NOT NULL,
  public_key TEXT,
  webhook_secret TEXT,
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT false,
  notification_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.mercadopago_config ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage mercadopago config
CREATE POLICY "Super admins can view mercadopago config" 
ON public.mercadopago_config 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can insert mercadopago config" 
ON public.mercadopago_config 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update mercadopago config" 
ON public.mercadopago_config 
FOR UPDATE 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete mercadopago config" 
ON public.mercadopago_config 
FOR DELETE 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_mercadopago_config_updated_at
BEFORE UPDATE ON public.mercadopago_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add mercadopago_plan_id to plans table for linking with MP subscription plans
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS mercadopago_plan_id TEXT;

-- Add mercadopago_preapproval_id to subscriptions for tracking MP subscriptions
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS mercadopago_preapproval_id TEXT;
-- Create app_settings table for configurable values
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins can manage app settings"
ON public.app_settings
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Everyone can read settings (needed for síndicos to get discount value)
CREATE POLICY "Anyone can read app settings"
ON public.app_settings
FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default value for síndico early trial end discount
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'sindico_early_trial_discount',
  '15',
  'Percentual de desconto aplicado quando o síndico encerra o trial antecipadamente'
);
-- Create plans table for managing subscription plans
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  notifications_limit integer NOT NULL DEFAULT 10,
  warnings_limit integer NOT NULL DEFAULT 10,
  fines_limit integer NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  color text NOT NULL DEFAULT 'bg-gray-500',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Public can view active plans
CREATE POLICY "Anyone can view active plans"
ON public.plans
FOR SELECT
USING (is_active = true);

-- Super admins can manage all plans
CREATE POLICY "Super admins can manage all plans"
ON public.plans
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Insert default plans
INSERT INTO public.plans (slug, name, description, notifications_limit, warnings_limit, fines_limit, price, color, display_order) VALUES
('start', 'Start', 'Plano gratuito para começar', 10, 10, 0, 0, 'bg-gray-500', 1),
('essencial', 'Essencial', 'Para condomínios pequenos', 50, 50, 25, 49.90, 'bg-blue-500', 2),
('profissional', 'Profissional', 'Para condomínios médios', 200, 200, 100, 99.90, 'bg-violet-500', 3),
('enterprise', 'Enterprise', 'Para grandes condomínios', 999999, 999999, 999999, 299.90, 'bg-amber-500', 4);

-- Add trigger for updated_at
CREATE TRIGGER update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
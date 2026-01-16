-- Create package types table (managed by superadmin)
CREATE TABLE public.package_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.package_types ENABLE ROW LEVEL SECURITY;

-- Everyone can read active package types
CREATE POLICY "Anyone can view active package types"
ON public.package_types
FOR SELECT
TO authenticated
USING (is_active = true);

-- Only super_admin can manage package types
CREATE POLICY "Super admins can manage package types"
ON public.package_types
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Add columns to packages table
ALTER TABLE public.packages
ADD COLUMN package_type_id UUID REFERENCES public.package_types(id),
ADD COLUMN tracking_code TEXT;

-- Insert default package types
INSERT INTO public.package_types (name, description, icon, display_order) VALUES
('Correios', 'Encomendas dos Correios', 'mail', 1),
('Transportadora', 'Encomendas de transportadoras diversas', 'truck', 2),
('E-commerce', 'Compras online (Amazon, Mercado Livre, etc)', 'shopping-bag', 3),
('Documento', 'Documentos e correspondências importantes', 'file-text', 4),
('Alimentação', 'Delivery de comida e bebidas', 'utensils', 5),
('Outros', 'Outros tipos de encomendas', 'package', 99);

-- Create trigger for updated_at
CREATE TRIGGER update_package_types_updated_at
BEFORE UPDATE ON public.package_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for custom occurrence categories per condominium
CREATE TABLE public.porter_occurrence_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.porter_occurrence_categories ENABLE ROW LEVEL SECURITY;

-- Síndicos can manage categories for their condominiums
CREATE POLICY "Sindicos can manage occurrence categories"
ON public.porter_occurrence_categories
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.condominiums c
  WHERE c.id = porter_occurrence_categories.condominium_id
    AND c.owner_id = auth.uid()
));

-- Porters can view categories of their assigned condominiums
CREATE POLICY "Porters can view occurrence categories"
ON public.porter_occurrence_categories
FOR SELECT
USING (user_belongs_to_condominium(auth.uid(), condominium_id));

-- Super admins can manage all
CREATE POLICY "Super admins can manage all occurrence categories"
ON public.porter_occurrence_categories
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_porter_occurrence_categories_updated_at
BEFORE UPDATE ON public.porter_occurrence_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

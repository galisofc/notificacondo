-- Table for condominium-specific WhatsApp templates
CREATE TABLE public.condominium_whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  template_slug TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(condominium_id, template_slug)
);

-- Enable RLS
ALTER TABLE public.condominium_whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Policies for condominium owners (síndicos)
CREATE POLICY "Condominium owners can view own templates"
ON public.condominium_whatsapp_templates
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM condominiums c
  WHERE c.id = condominium_whatsapp_templates.condominium_id
  AND c.owner_id = auth.uid()
));

CREATE POLICY "Condominium owners can insert own templates"
ON public.condominium_whatsapp_templates
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM condominiums c
  WHERE c.id = condominium_whatsapp_templates.condominium_id
  AND c.owner_id = auth.uid()
));

CREATE POLICY "Condominium owners can update own templates"
ON public.condominium_whatsapp_templates
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM condominiums c
  WHERE c.id = condominium_whatsapp_templates.condominium_id
  AND c.owner_id = auth.uid()
));

CREATE POLICY "Condominium owners can delete own templates"
ON public.condominium_whatsapp_templates
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM condominiums c
  WHERE c.id = condominium_whatsapp_templates.condominium_id
  AND c.owner_id = auth.uid()
));

-- Super admins can manage all
CREATE POLICY "Super admins can manage all condominium templates"
ON public.condominium_whatsapp_templates
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_condominium_whatsapp_templates_updated_at
BEFORE UPDATE ON public.condominium_whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
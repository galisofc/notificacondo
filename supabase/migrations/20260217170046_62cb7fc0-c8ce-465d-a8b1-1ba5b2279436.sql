
-- =============================================
-- MÓDULO PORTARIA - Tabelas e Políticas RLS
-- =============================================

-- 1. Tabela porter_occurrences
CREATE TABLE public.porter_occurrences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  registered_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outros',
  priority TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'aberta',
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.porter_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Porters can manage occurrences in assigned condominiums"
  ON public.porter_occurrences FOR ALL
  USING (public.user_belongs_to_condominium(auth.uid(), condominium_id));

CREATE POLICY "Sindicos can manage occurrences in their condominiums"
  ON public.porter_occurrences FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.condominiums c
    WHERE c.id = porter_occurrences.condominium_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Super admins can manage all porter occurrences"
  ON public.porter_occurrences FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_porter_occurrences_updated_at
  BEFORE UPDATE ON public.porter_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela shift_checklist_templates
CREATE TABLE public.shift_checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sindicos can manage shift checklist templates"
  ON public.shift_checklist_templates FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.condominiums c
    WHERE c.id = shift_checklist_templates.condominium_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Porters can view shift checklist templates"
  ON public.shift_checklist_templates FOR SELECT
  USING (public.user_belongs_to_condominium(auth.uid(), condominium_id));

CREATE POLICY "Super admins can manage all shift checklist templates"
  ON public.shift_checklist_templates FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_shift_checklist_templates_updated_at
  BEFORE UPDATE ON public.shift_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tabela shift_handovers
CREATE TABLE public.shift_handovers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  outgoing_porter_id UUID NOT NULL,
  incoming_porter_name TEXT NOT NULL,
  shift_ended_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  general_observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Porters can manage shift handovers in assigned condominiums"
  ON public.shift_handovers FOR ALL
  USING (public.user_belongs_to_condominium(auth.uid(), condominium_id));

CREATE POLICY "Sindicos can view shift handovers in their condominiums"
  ON public.shift_handovers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.condominiums c
    WHERE c.id = shift_handovers.condominium_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Super admins can manage all shift handovers"
  ON public.shift_handovers FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 4. Tabela shift_handover_items
CREATE TABLE public.shift_handover_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  handover_id UUID NOT NULL REFERENCES public.shift_handovers(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT,
  is_ok BOOLEAN NOT NULL DEFAULT true,
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_handover_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Porters can manage shift handover items"
  ON public.shift_handover_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.shift_handovers sh
    WHERE sh.id = shift_handover_items.handover_id
      AND public.user_belongs_to_condominium(auth.uid(), sh.condominium_id)
  ));

CREATE POLICY "Sindicos can view shift handover items"
  ON public.shift_handover_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.shift_handovers sh
    JOIN public.condominiums c ON c.id = sh.condominium_id
    WHERE sh.id = shift_handover_items.handover_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Super admins can manage all shift handover items"
  ON public.shift_handover_items FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

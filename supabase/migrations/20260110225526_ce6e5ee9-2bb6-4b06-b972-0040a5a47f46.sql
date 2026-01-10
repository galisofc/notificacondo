-- Criar tabela de configurações do salão de festas
CREATE TABLE public.party_hall_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Salão de Festas',
  rental_fee NUMERIC DEFAULT 0,
  deposit_amount NUMERIC DEFAULT 0,
  rules TEXT,
  advance_days_required INTEGER DEFAULT 3,
  check_in_time TIME DEFAULT '08:00',
  check_out_time TIME DEFAULT '22:00',
  max_guests INTEGER DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de reservas
CREATE TABLE public.party_hall_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  party_hall_setting_id UUID NOT NULL REFERENCES public.party_hall_settings(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmada', 'em_uso', 'finalizada', 'cancelada')),
  deposit_paid BOOLEAN DEFAULT false,
  guest_count INTEGER,
  observations TEXT,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de checklists
CREATE TABLE public.party_hall_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.party_hall_bookings(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  checked_by UUID NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  general_observations TEXT,
  signature_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de itens do checklist
CREATE TABLE public.party_hall_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.party_hall_checklists(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT,
  is_ok BOOLEAN NOT NULL DEFAULT true,
  observation TEXT,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de templates de checklist
CREATE TABLE public.party_hall_checklist_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category TEXT DEFAULT 'Geral',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.party_hall_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_hall_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_hall_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_hall_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_hall_checklist_templates ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para party_hall_settings
CREATE POLICY "Condominium owners can manage party hall settings"
ON public.party_hall_settings
FOR ALL
USING (EXISTS (
  SELECT 1 FROM condominiums c
  WHERE c.id = party_hall_settings.condominium_id AND c.owner_id = auth.uid()
));

CREATE POLICY "Residents can view party hall settings"
ON public.party_hall_settings
FOR SELECT
USING (is_resident_of_condominium(auth.uid(), condominium_id));

CREATE POLICY "Super admins can manage all party hall settings"
ON public.party_hall_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Políticas RLS para party_hall_bookings
CREATE POLICY "Condominium owners can manage bookings"
ON public.party_hall_bookings
FOR ALL
USING (EXISTS (
  SELECT 1 FROM condominiums c
  WHERE c.id = party_hall_bookings.condominium_id AND c.owner_id = auth.uid()
));

CREATE POLICY "Residents can view own bookings"
ON public.party_hall_bookings
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM residents r
  WHERE r.id = party_hall_bookings.resident_id AND r.user_id = auth.uid()
));

CREATE POLICY "Residents can create bookings"
ON public.party_hall_bookings
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM residents r
  WHERE r.id = party_hall_bookings.resident_id AND r.user_id = auth.uid()
));

CREATE POLICY "Super admins can manage all bookings"
ON public.party_hall_bookings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Políticas RLS para party_hall_checklists
CREATE POLICY "Condominium owners can manage checklists"
ON public.party_hall_checklists
FOR ALL
USING (EXISTS (
  SELECT 1 FROM party_hall_bookings b
  JOIN condominiums c ON c.id = b.condominium_id
  WHERE b.id = party_hall_checklists.booking_id AND c.owner_id = auth.uid()
));

CREATE POLICY "Residents can view own checklists"
ON public.party_hall_checklists
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM party_hall_bookings b
  JOIN residents r ON r.id = b.resident_id
  WHERE b.id = party_hall_checklists.booking_id AND r.user_id = auth.uid()
));

CREATE POLICY "Super admins can manage all checklists"
ON public.party_hall_checklists
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Políticas RLS para party_hall_checklist_items
CREATE POLICY "Condominium owners can manage checklist items"
ON public.party_hall_checklist_items
FOR ALL
USING (EXISTS (
  SELECT 1 FROM party_hall_checklists cl
  JOIN party_hall_bookings b ON b.id = cl.booking_id
  JOIN condominiums c ON c.id = b.condominium_id
  WHERE cl.id = party_hall_checklist_items.checklist_id AND c.owner_id = auth.uid()
));

CREATE POLICY "Residents can view own checklist items"
ON public.party_hall_checklist_items
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM party_hall_checklists cl
  JOIN party_hall_bookings b ON b.id = cl.booking_id
  JOIN residents r ON r.id = b.resident_id
  WHERE cl.id = party_hall_checklist_items.checklist_id AND r.user_id = auth.uid()
));

CREATE POLICY "Super admins can manage all checklist items"
ON public.party_hall_checklist_items
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Políticas RLS para party_hall_checklist_templates
CREATE POLICY "Condominium owners can manage templates"
ON public.party_hall_checklist_templates
FOR ALL
USING (EXISTS (
  SELECT 1 FROM condominiums c
  WHERE c.id = party_hall_checklist_templates.condominium_id AND c.owner_id = auth.uid()
));

CREATE POLICY "Residents can view templates"
ON public.party_hall_checklist_templates
FOR SELECT
USING (is_resident_of_condominium(auth.uid(), condominium_id));

CREATE POLICY "Super admins can manage all templates"
ON public.party_hall_checklist_templates
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Triggers para updated_at
CREATE TRIGGER update_party_hall_settings_updated_at
BEFORE UPDATE ON public.party_hall_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_party_hall_bookings_updated_at
BEFORE UPDATE ON public.party_hall_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_party_hall_checklist_templates_updated_at
BEFORE UPDATE ON public.party_hall_checklist_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir template de WhatsApp para lembrete de reserva
INSERT INTO public.whatsapp_templates (name, slug, description, content, variables, is_active)
VALUES (
  'Lembrete de Reserva do Salão',
  'party_hall_reminder',
  'Notificação enviada ao morador lembrando da reserva do salão de festas',
  '🎉 *LEMBRETE DE RESERVA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua reserva do *{espaco}* está confirmada para:
📅 *Data:* {data}
⏰ *Horário:* {horario_inicio} às {horario_fim}

📋 *Lembre-se:*
• Compareça no horário para o checklist de entrada
• Traga documento de identificação
• Respeite as regras do espaço

Em caso de dúvidas, entre em contato com a administração.

Boa festa! 🎊',
  ARRAY['condominio', 'nome', 'espaco', 'data', 'horario_inicio', 'horario_fim'],
  true
);

-- Create enum types
CREATE TYPE public.app_role AS ENUM ('super_admin', 'sindico', 'morador');
CREATE TYPE public.occurrence_type AS ENUM ('advertencia', 'notificacao', 'multa');
CREATE TYPE public.occurrence_status AS ENUM ('registrada', 'notificado', 'em_defesa', 'analisando', 'arquivada', 'advertido', 'multado');
CREATE TYPE public.fine_status AS ENUM ('em_aberto', 'pago', 'vencido');
CREATE TYPE public.plan_type AS ENUM ('start', 'essencial', 'profissional', 'enterprise');

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cpf TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'morador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Subscriptions/Plans table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan plan_type NOT NULL DEFAULT 'start',
  notifications_limit INTEGER NOT NULL DEFAULT 10,
  warnings_limit INTEGER NOT NULL DEFAULT 10,
  fines_limit INTEGER NOT NULL DEFAULT 0,
  notifications_used INTEGER NOT NULL DEFAULT 0,
  warnings_used INTEGER NOT NULL DEFAULT 0,
  fines_used INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  mercado_pago_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Condominiums table
CREATE TABLE public.condominiums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  cnpj TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  convention_url TEXT,
  internal_rules_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blocks table
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID REFERENCES public.condominiums(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apartments/Units table
CREATE TABLE public.apartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES public.blocks(id) ON DELETE CASCADE NOT NULL,
  number TEXT NOT NULL,
  floor INTEGER,
  area_sqm DECIMAL(10,2),
  monthly_fee DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Residents table
CREATE TABLE public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id UUID REFERENCES public.apartments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cpf TEXT,
  is_owner BOOLEAN NOT NULL DEFAULT false,
  is_responsible BOOLEAN NOT NULL DEFAULT false,
  move_in_date DATE,
  move_out_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Occurrences table
CREATE TABLE public.occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID REFERENCES public.condominiums(id) ON DELETE CASCADE NOT NULL,
  block_id UUID REFERENCES public.blocks(id) ON DELETE SET NULL,
  apartment_id UUID REFERENCES public.apartments(id) ON DELETE SET NULL,
  resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  registered_by UUID REFERENCES auth.users(id) NOT NULL,
  type occurrence_type NOT NULL,
  status occurrence_status NOT NULL DEFAULT 'registrada',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  legal_basis TEXT,
  convention_article TEXT,
  internal_rules_article TEXT,
  civil_code_article TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Occurrence evidence/proofs
CREATE TABLE public.occurrence_evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID REFERENCES public.occurrences(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications sent table
CREATE TABLE public.notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID REFERENCES public.occurrences(id) ON DELETE CASCADE NOT NULL,
  resident_id UUID REFERENCES public.residents(id) ON DELETE CASCADE NOT NULL,
  sent_via TEXT NOT NULL DEFAULT 'whatsapp',
  secure_link TEXT NOT NULL,
  secure_link_token TEXT NOT NULL UNIQUE,
  message_content TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,
  location_info JSONB,
  zpro_message_id TEXT,
  zpro_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defenses submitted by residents
CREATE TABLE public.defenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID REFERENCES public.occurrences(id) ON DELETE CASCADE NOT NULL,
  resident_id UUID REFERENCES public.residents(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defense attachments
CREATE TABLE public.defense_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  defense_id UUID REFERENCES public.defenses(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Decisions made by síndico
CREATE TABLE public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID REFERENCES public.occurrences(id) ON DELETE CASCADE NOT NULL,
  decided_by UUID REFERENCES auth.users(id) NOT NULL,
  decision occurrence_status NOT NULL,
  justification TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fines table
CREATE TABLE public.fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID REFERENCES public.occurrences(id) ON DELETE CASCADE NOT NULL,
  resident_id UUID REFERENCES public.residents(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  multiplier INTEGER NOT NULL DEFAULT 1,
  status fine_status NOT NULL DEFAULT 'em_aberto',
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  payment_reference TEXT,
  notified_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log for all important actions
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condominiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occurrence_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defense_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user's condominiums (as owner)
CREATE OR REPLACE FUNCTION public.get_user_condominium_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.condominiums WHERE owner_id = _user_id
$$;

-- Function to check if user is resident of a condominium
CREATE OR REPLACE FUNCTION public.is_resident_of_condominium(_user_id UUID, _condominium_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.residents r
    JOIN public.apartments a ON r.apartment_id = a.id
    JOIN public.blocks b ON a.block_id = b.id
    WHERE r.user_id = _user_id AND b.condominium_id = _condominium_id
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Subscriptions policies
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all subscriptions" ON public.subscriptions
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Condominiums policies
CREATE POLICY "Owners can view own condominiums" ON public.condominiums
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Owners can manage own condominiums" ON public.condominiums
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Residents can view their condominium" ON public.condominiums
  FOR SELECT USING (public.is_resident_of_condominium(auth.uid(), id));

CREATE POLICY "Super admins can manage all condominiums" ON public.condominiums
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Blocks policies
CREATE POLICY "Condominium owners can manage blocks" ON public.blocks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.condominiums c WHERE c.id = condominium_id AND c.owner_id = auth.uid())
  );

CREATE POLICY "Residents can view blocks" ON public.blocks
  FOR SELECT USING (
    public.is_resident_of_condominium(auth.uid(), condominium_id)
  );

-- Apartments policies
CREATE POLICY "Condominium owners can manage apartments" ON public.apartments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.blocks b
      JOIN public.condominiums c ON b.condominium_id = c.id
      WHERE b.id = block_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Residents can view apartments" ON public.apartments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.residents r WHERE r.apartment_id = id AND r.user_id = auth.uid()
    )
  );

-- Residents policies
CREATE POLICY "Condominium owners can manage residents" ON public.residents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.apartments a
      JOIN public.blocks b ON a.block_id = b.id
      JOIN public.condominiums c ON b.condominium_id = c.id
      WHERE a.id = apartment_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own resident profile" ON public.residents
  FOR SELECT USING (auth.uid() = user_id);

-- Occurrences policies
CREATE POLICY "Condominium owners can manage occurrences" ON public.occurrences
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.condominiums c WHERE c.id = condominium_id AND c.owner_id = auth.uid())
  );

CREATE POLICY "Residents can view own occurrences" ON public.occurrences
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.residents r WHERE r.id = resident_id AND r.user_id = auth.uid())
  );

-- Occurrence evidences policies
CREATE POLICY "Condominium owners can manage evidences" ON public.occurrence_evidences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.occurrences o
      JOIN public.condominiums c ON o.condominium_id = c.id
      WHERE o.id = occurrence_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Residents can view evidences of own occurrences" ON public.occurrence_evidences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.occurrences o
      JOIN public.residents r ON o.resident_id = r.id
      WHERE o.id = occurrence_id AND r.user_id = auth.uid()
    )
  );

-- Notifications sent policies
CREATE POLICY "Condominium owners can manage notifications" ON public.notifications_sent
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.occurrences o
      JOIN public.condominiums c ON o.condominium_id = c.id
      WHERE o.id = occurrence_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Residents can view own notifications" ON public.notifications_sent
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.residents r WHERE r.id = resident_id AND r.user_id = auth.uid())
  );

-- Defenses policies
CREATE POLICY "Condominium owners can view defenses" ON public.defenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.occurrences o
      JOIN public.condominiums c ON o.condominium_id = c.id
      WHERE o.id = occurrence_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Residents can manage own defenses" ON public.defenses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.residents r WHERE r.id = resident_id AND r.user_id = auth.uid())
  );

-- Defense attachments policies
CREATE POLICY "Users can manage own defense attachments" ON public.defense_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.defenses d
      JOIN public.residents r ON d.resident_id = r.id
      WHERE d.id = defense_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Condominium owners can view defense attachments" ON public.defense_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.defenses d
      JOIN public.occurrences o ON d.occurrence_id = o.id
      JOIN public.condominiums c ON o.condominium_id = c.id
      WHERE d.id = defense_id AND c.owner_id = auth.uid()
    )
  );

-- Decisions policies
CREATE POLICY "Condominium owners can manage decisions" ON public.decisions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.occurrences o
      JOIN public.condominiums c ON o.condominium_id = c.id
      WHERE o.id = occurrence_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Residents can view decisions on own occurrences" ON public.decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.occurrences o
      JOIN public.residents r ON o.resident_id = r.id
      WHERE o.id = occurrence_id AND r.user_id = auth.uid()
    )
  );

-- Fines policies
CREATE POLICY "Condominium owners can manage fines" ON public.fines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.occurrences o
      JOIN public.condominiums c ON o.condominium_id = c.id
      WHERE o.id = occurrence_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Residents can view own fines" ON public.fines
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.residents r WHERE r.id = resident_id AND r.user_id = auth.uid())
  );

-- Audit logs policies (super admins only)
CREATE POLICY "Super admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'sindico');
  
  INSERT INTO public.subscriptions (user_id, plan, notifications_limit, warnings_limit, fines_limit)
  VALUES (NEW.id, 'start', 10, 10, 0);
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_condominiums_updated_at BEFORE UPDATE ON public.condominiums
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_apartments_updated_at BEFORE UPDATE ON public.apartments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_residents_updated_at BEFORE UPDATE ON public.residents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_occurrences_updated_at BEFORE UPDATE ON public.occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fines_updated_at BEFORE UPDATE ON public.fines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_condominiums_owner ON public.condominiums(owner_id);
CREATE INDEX idx_blocks_condominium ON public.blocks(condominium_id);
CREATE INDEX idx_apartments_block ON public.apartments(block_id);
CREATE INDEX idx_residents_apartment ON public.residents(apartment_id);
CREATE INDEX idx_residents_user ON public.residents(user_id);
CREATE INDEX idx_occurrences_condominium ON public.occurrences(condominium_id);
CREATE INDEX idx_occurrences_resident ON public.occurrences(resident_id);
CREATE INDEX idx_occurrences_status ON public.occurrences(status);
CREATE INDEX idx_notifications_occurrence ON public.notifications_sent(occurrence_id);
CREATE INDEX idx_notifications_token ON public.notifications_sent(secure_link_token);
CREATE INDEX idx_fines_occurrence ON public.fines(occurrence_id);
CREATE INDEX idx_fines_resident ON public.fines(resident_id);
CREATE INDEX idx_fines_status ON public.fines(status);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON public.audit_logs(table_name);

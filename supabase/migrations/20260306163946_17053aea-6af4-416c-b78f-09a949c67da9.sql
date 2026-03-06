
-- Add 'zelador' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'zelador';

-- Create maintenance periodicity enum
CREATE TYPE public.maintenance_periodicity AS ENUM (
  'semanal','quinzenal','mensal','bimestral',
  'trimestral','semestral','anual','personalizado'
);

-- Create maintenance execution status enum
CREATE TYPE public.maintenance_execution_status AS ENUM (
  'concluida','parcial','nao_realizada'
);

-- Create maintenance_categories table
CREATE TABLE public.maintenance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sindicos can manage categories in their condominiums"
  ON public.maintenance_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM condominiums c WHERE c.id = maintenance_categories.condominium_id AND c.owner_id = auth.uid()));

CREATE POLICY "Zeladores can view categories in assigned condominiums"
  ON public.maintenance_categories FOR SELECT TO authenticated
  USING (public.user_belongs_to_condominium(auth.uid(), condominium_id));

CREATE POLICY "Super admins can manage all categories"
  ON public.maintenance_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Create maintenance_tasks table
CREATE TABLE public.maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.maintenance_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'media',
  periodicity public.maintenance_periodicity NOT NULL,
  periodicity_days INTEGER,
  next_due_date DATE NOT NULL,
  last_completed_at TIMESTAMPTZ,
  notification_days_before INTEGER NOT NULL DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'em_dia',
  responsible_notes TEXT,
  estimated_cost NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sindicos can manage tasks in their condominiums"
  ON public.maintenance_tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM condominiums c WHERE c.id = maintenance_tasks.condominium_id AND c.owner_id = auth.uid()));

CREATE POLICY "Zeladores can view tasks in assigned condominiums"
  ON public.maintenance_tasks FOR SELECT TO authenticated
  USING (public.user_belongs_to_condominium(auth.uid(), condominium_id));

CREATE POLICY "Super admins can manage all tasks"
  ON public.maintenance_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_maintenance_tasks_updated_at
  BEFORE UPDATE ON public.maintenance_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create maintenance_executions table
CREATE TABLE public.maintenance_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  executed_by UUID,
  executed_by_name TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observations TEXT,
  cost NUMERIC,
  photos TEXT[] NOT NULL DEFAULT '{}',
  status public.maintenance_execution_status NOT NULL DEFAULT 'concluida',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sindicos can manage executions in their condominiums"
  ON public.maintenance_executions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM condominiums c WHERE c.id = maintenance_executions.condominium_id AND c.owner_id = auth.uid()));

CREATE POLICY "Zeladores can create executions in assigned condominiums"
  ON public.maintenance_executions FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_condominium(auth.uid(), condominium_id));

CREATE POLICY "Zeladores can view executions in assigned condominiums"
  ON public.maintenance_executions FOR SELECT TO authenticated
  USING (public.user_belongs_to_condominium(auth.uid(), condominium_id));

CREATE POLICY "Super admins can manage all executions"
  ON public.maintenance_executions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Update check_conflicting_roles to include zelador
CREATE OR REPLACE FUNCTION public.check_conflicting_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If inserting 'porteiro', check if user already has 'sindico' or 'zelador'
  IF NEW.role = 'porteiro' THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.user_id AND role IN ('sindico', 'zelador')
    ) THEN
      RAISE EXCEPTION 'Usuário já possui role conflitante. Não é permitido ter roles de porteiro com síndico ou zelador.';
    END IF;
  END IF;

  -- If inserting 'sindico', check if user already has 'porteiro' or 'zelador'
  IF NEW.role = 'sindico' THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.user_id AND role IN ('porteiro', 'zelador')
    ) THEN
      RAISE EXCEPTION 'Usuário já possui role conflitante. Não é permitido ter roles de síndico com porteiro ou zelador.';
    END IF;
  END IF;

  -- If inserting 'zelador', check if user already has 'sindico' or 'porteiro'
  IF NEW.role = 'zelador' THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.user_id AND role IN ('sindico', 'porteiro')
    ) THEN
      RAISE EXCEPTION 'Usuário já possui role conflitante. Não é permitido ter roles de zelador com síndico ou porteiro.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create indexes for performance
CREATE INDEX idx_maintenance_categories_condominium ON public.maintenance_categories(condominium_id);
CREATE INDEX idx_maintenance_tasks_condominium ON public.maintenance_tasks(condominium_id);
CREATE INDEX idx_maintenance_tasks_category ON public.maintenance_tasks(category_id);
CREATE INDEX idx_maintenance_tasks_status ON public.maintenance_tasks(status);
CREATE INDEX idx_maintenance_executions_task ON public.maintenance_executions(task_id);
CREATE INDEX idx_maintenance_executions_condominium ON public.maintenance_executions(condominium_id);

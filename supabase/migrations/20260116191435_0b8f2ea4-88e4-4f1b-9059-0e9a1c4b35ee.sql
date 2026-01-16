-- FASE 1: Sistema de Gestão de Encomendas (Versão Corrigida)

-- 1.1 Criar enum para status de encomenda
DO $$ BEGIN
  CREATE TYPE public.package_status AS ENUM ('pendente', 'retirada', 'expirada');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1.2 Criar tabela de vínculo porteiros a condomínios
CREATE TABLE IF NOT EXISTS public.user_condominiums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, condominium_id)
);

-- 1.3 Criar tabela de encomendas
CREATE TABLE IF NOT EXISTS public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  apartment_id uuid NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  resident_id uuid REFERENCES public.residents(id) ON DELETE SET NULL,
  received_by uuid NOT NULL REFERENCES auth.users(id),
  pickup_code text NOT NULL,
  description text,
  photo_url text NOT NULL,
  status public.package_status DEFAULT 'pendente' NOT NULL,
  received_at timestamptz DEFAULT now() NOT NULL,
  picked_up_at timestamptz,
  picked_up_by uuid REFERENCES auth.users(id),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 1.4 Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_packages_condominium ON public.packages(condominium_id);
CREATE INDEX IF NOT EXISTS idx_packages_apartment ON public.packages(apartment_id);
CREATE INDEX IF NOT EXISTS idx_packages_status ON public.packages(status);
CREATE INDEX IF NOT EXISTS idx_packages_pickup_code ON public.packages(pickup_code);
CREATE INDEX IF NOT EXISTS idx_packages_received_at ON public.packages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_condominiums_user ON public.user_condominiums(user_id);
CREATE INDEX IF NOT EXISTS idx_user_condominiums_condo ON public.user_condominiums(condominium_id);

-- 1.5 Criar função para verificar se usuário pertence ao condomínio via user_condominiums
CREATE OR REPLACE FUNCTION public.user_belongs_to_condominium(_user_id uuid, _condominium_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_condominiums
    WHERE user_id = _user_id
      AND condominium_id = _condominium_id
  )
$$;

-- 1.6 Criar função para obter condominium_id de um apartamento
CREATE OR REPLACE FUNCTION public.get_apartment_condominium_id(_apartment_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.apartments a
  JOIN public.blocks b ON a.block_id = b.id
  JOIN public.condominiums c ON b.condominium_id = c.id
  WHERE a.id = _apartment_id
$$;

-- 1.7 Habilitar RLS nas novas tabelas
ALTER TABLE public.user_condominiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- 1.8 Políticas RLS para user_condominiums

-- Super Admin pode gerenciar todos os vínculos
CREATE POLICY "Super admins can manage all user_condominiums"
ON public.user_condominiums
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Usuários podem ver seus próprios vínculos
CREATE POLICY "Users can view own user_condominiums"
ON public.user_condominiums
FOR SELECT
USING (auth.uid() = user_id);

-- Síndicos podem ver e gerenciar porteiros do seu condomínio
CREATE POLICY "Sindicos can manage their condominium porters"
ON public.user_condominiums
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.condominiums c
    WHERE c.id = user_condominiums.condominium_id
    AND c.owner_id = auth.uid()
  )
);

-- 1.9 Políticas RLS para packages

-- Super Admin pode gerenciar todas as encomendas
CREATE POLICY "Super admins can manage all packages"
ON public.packages
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'));

-- Usuários vinculados a condomínios (porteiros) podem gerenciar encomendas
CREATE POLICY "Condominium users can manage packages"
ON public.packages
FOR ALL
USING (
  public.user_belongs_to_condominium(auth.uid(), condominium_id)
);

-- Síndicos podem gerenciar encomendas do seu condomínio
CREATE POLICY "Sindicos can manage packages in their condominiums"
ON public.packages
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.condominiums c
    WHERE c.id = packages.condominium_id
    AND c.owner_id = auth.uid()
  )
);

-- Moradores podem ver encomendas do seu apartamento
CREATE POLICY "Residents can view packages for their apartment"
ON public.packages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.residents r
    WHERE r.apartment_id = packages.apartment_id
    AND r.user_id = auth.uid()
  )
);

-- 1.10 Criar bucket de storage para fotos de encomendas
INSERT INTO storage.buckets (id, name, public)
VALUES ('package-photos', 'package-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 1.11 Políticas de storage para package-photos

-- Permitir visualização pública das fotos
CREATE POLICY "Anyone can view package photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'package-photos');

-- Super Admin pode fazer upload de fotos
CREATE POLICY "Super admins upload package photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'package-photos'
  AND public.has_role(auth.uid(), 'super_admin')
);

-- Síndicos podem fazer upload de fotos
CREATE POLICY "Sindicos upload package photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'package-photos'
  AND public.has_role(auth.uid(), 'sindico')
);

-- Super Admin pode deletar fotos
CREATE POLICY "Super admins delete package photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'package-photos'
  AND public.has_role(auth.uid(), 'super_admin')
);

-- Usuários vinculados a condomínios (porteiros) podem fazer upload
CREATE POLICY "Condominium users upload package photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'package-photos'
  AND EXISTS (
    SELECT 1 FROM public.user_condominiums uc
    WHERE uc.user_id = auth.uid()
  )
);
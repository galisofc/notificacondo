-- Alterar tabela subscriptions para ser por condomínio

-- Primeiro, remover políticas antigas que dependem de user_id
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Super admins can manage all subscriptions" ON public.subscriptions;

-- Adicionar a coluna condominium_id
ALTER TABLE public.subscriptions ADD COLUMN condominium_id uuid REFERENCES public.condominiums(id) ON DELETE CASCADE;

-- Remover a coluna user_id
ALTER TABLE public.subscriptions DROP COLUMN user_id;

-- Adicionar constraint NOT NULL após popular os dados (por enquanto deixamos nullable)
-- ALTER TABLE public.subscriptions ALTER COLUMN condominium_id SET NOT NULL;

-- Adicionar constraint unique para garantir uma assinatura por condomínio
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_condominium_id_key UNIQUE (condominium_id);

-- Criar novas políticas RLS para assinaturas por condomínio
CREATE POLICY "Condominium owners can view subscription"
ON public.subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.condominiums c
    WHERE c.id = subscriptions.condominium_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Condominium owners can update subscription"
ON public.subscriptions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.condominiums c
    WHERE c.id = subscriptions.condominium_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Super admins can manage all subscriptions"
ON public.subscriptions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Atualizar a função handle_new_user para não criar assinatura automaticamente
-- (agora a assinatura será criada quando o condomínio for criado)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  
  RETURN NEW;
END;
$$;

-- Criar trigger para criar assinatura automaticamente quando um condomínio é criado
CREATE OR REPLACE FUNCTION public.handle_new_condominium()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.subscriptions (condominium_id, plan, notifications_limit, warnings_limit, fines_limit)
  VALUES (NEW.id, 'start', 10, 10, 0);
  
  RETURN NEW;
END;
$$;

-- Criar o trigger
CREATE TRIGGER on_condominium_created
  AFTER INSERT ON public.condominiums
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_condominium();
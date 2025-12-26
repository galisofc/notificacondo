-- Create a security definer function to check if user is a resident of apartment
CREATE OR REPLACE FUNCTION public.is_resident_of_apartment(_user_id uuid, _apartment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.residents
    WHERE user_id = _user_id AND apartment_id = _apartment_id
  )
$$;

-- Create a security definer function to check if user owns the condominium of an apartment
CREATE OR REPLACE FUNCTION public.is_owner_of_apartment(_user_id uuid, _apartment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.apartments a
    JOIN public.blocks b ON a.block_id = b.id
    JOIN public.condominiums c ON b.condominium_id = c.id
    WHERE a.id = _apartment_id AND c.owner_id = _user_id
  )
$$;

-- Drop existing problematic policies on apartments
DROP POLICY IF EXISTS "Condominium owners can manage apartments" ON public.apartments;
DROP POLICY IF EXISTS "Residents can view apartments" ON public.apartments;

-- Recreate apartments policies using security definer functions
CREATE POLICY "Condominium owners can manage apartments" 
ON public.apartments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.blocks b
    JOIN public.condominiums c ON b.condominium_id = c.id
    WHERE b.id = apartments.block_id AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Residents can view own apartment" 
ON public.apartments 
FOR SELECT 
USING (public.is_resident_of_apartment(auth.uid(), id));

-- Drop existing problematic policies on residents
DROP POLICY IF EXISTS "Condominium owners can manage residents" ON public.residents;
DROP POLICY IF EXISTS "Users can view own resident profile" ON public.residents;

-- Recreate residents policies using security definer functions
CREATE POLICY "Condominium owners can manage residents" 
ON public.residents 
FOR ALL 
USING (public.is_owner_of_apartment(auth.uid(), apartment_id));

CREATE POLICY "Users can view own resident profile" 
ON public.residents 
FOR SELECT 
USING (auth.uid() = user_id);
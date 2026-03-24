CREATE TABLE public.condominium_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  bg_color text NOT NULL DEFAULT '#3b82f6',
  text_color text NOT NULL DEFAULT '#ffffff',
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.condominium_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sindicos can manage banners of own condominiums"
  ON public.condominium_banners FOR ALL
  USING (EXISTS (
    SELECT 1 FROM condominiums c WHERE c.id = condominium_banners.condominium_id AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Porters can view banners of assigned condominiums"
  ON public.condominium_banners FOR SELECT
  TO authenticated
  USING (user_belongs_to_condominium(auth.uid(), condominium_id));

CREATE POLICY "Super admins can manage all banners"
  ON public.condominium_banners FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));
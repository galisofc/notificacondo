CREATE TABLE public.porter_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.porter_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Porters can manage messages in assigned condominiums"
  ON public.porter_messages FOR ALL
  TO authenticated
  USING (user_belongs_to_condominium(auth.uid(), condominium_id))
  WITH CHECK (user_belongs_to_condominium(auth.uid(), condominium_id));

CREATE POLICY "Sindicos can view messages of own condominiums"
  ON public.porter_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM condominiums c WHERE c.id = porter_messages.condominium_id AND c.owner_id = auth.uid()));

CREATE POLICY "Super admins can manage all messages"
  ON public.porter_messages FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Porters can delete own messages" ON public.porter_messages;

CREATE POLICY "Porters can delete messages in assigned condominiums"
ON public.porter_messages
FOR DELETE
TO authenticated
USING (user_belongs_to_condominium(auth.uid(), condominium_id));

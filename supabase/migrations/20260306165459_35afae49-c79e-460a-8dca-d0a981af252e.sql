
-- The categories policy already exists, just need to fix the tasks policy
-- Drop duplicate if created, then recreate cleanly
DROP POLICY IF EXISTS "Zeladores can manage tasks in assigned condominiums" ON public.maintenance_tasks;

CREATE POLICY "Zeladores can manage tasks in assigned condominiums"
ON public.maintenance_tasks
FOR ALL
TO authenticated
USING (user_belongs_to_condominium(auth.uid(), condominium_id))
WITH CHECK (user_belongs_to_condominium(auth.uid(), condominium_id));

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Residents can view apartments" ON public.apartments;

-- Recreate with correct logic (residents can view their own apartment)
CREATE POLICY "Residents can view apartments" 
ON public.apartments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.residents r
    WHERE r.apartment_id = apartments.id AND r.user_id = auth.uid()
  )
);
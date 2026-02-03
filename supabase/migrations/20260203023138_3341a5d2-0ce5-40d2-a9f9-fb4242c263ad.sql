-- Add policy to allow public (anonymous) access to active plans
CREATE POLICY "Anyone can view active plans"
ON public.plans
FOR SELECT
USING (is_active = true);
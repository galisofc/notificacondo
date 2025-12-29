-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Residents can view decisions on own occurrences" ON public.decisions;

-- Create new permissive policy for residents to view decisions
CREATE POLICY "Residents can view decisions on own occurrences" 
ON public.decisions 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM occurrences o
    JOIN residents r ON o.resident_id = r.id
    WHERE o.id = decisions.occurrence_id 
    AND r.user_id = auth.uid()
  )
);
-- Allow residents to update their own occurrence status (for defense submission)
CREATE POLICY "Residents can update own occurrence status" 
ON public.occurrences 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM residents r
    WHERE r.id = occurrences.resident_id 
    AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM residents r
    WHERE r.id = occurrences.resident_id 
    AND r.user_id = auth.uid()
  )
);
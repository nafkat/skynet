-- Update correction_requests RLS to allow HR to approve/reject (not just Admin)
DROP POLICY IF EXISTS "Admin can update correction requests" ON public.correction_requests;

CREATE POLICY "Elevated roles can update correction requests"
ON public.correction_requests
FOR UPDATE
TO authenticated
USING (has_elevated_role(auth.uid()));
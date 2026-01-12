-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Employees viewable by authenticated users" ON public.employees;

-- Create new restrictive SELECT policy for Admin and HR only
CREATE POLICY "Employees viewable by admin and hr"
ON public.employees
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role)
);
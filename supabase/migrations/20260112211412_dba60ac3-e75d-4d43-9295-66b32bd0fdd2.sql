-- Drop existing policies on specialties
DROP POLICY IF EXISTS "Admin can delete specialties" ON public.specialties;
DROP POLICY IF EXISTS "Admin can insert specialties" ON public.specialties;
DROP POLICY IF EXISTS "Admin can update specialties" ON public.specialties;
DROP POLICY IF EXISTS "Specialties viewable by authenticated users" ON public.specialties;

-- Create new role-based policies

-- SELECT: Admin, HR, and Timekeeper can view specialties
CREATE POLICY "Authenticated users can view specialties"
ON public.specialties
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role) OR
  has_role(auth.uid(), 'timekeeper'::app_role)
);

-- INSERT: Admin and HR can insert specialties
CREATE POLICY "Admin and HR can insert specialties"
ON public.specialties
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role)
);

-- UPDATE: Admin and HR can update specialties
CREATE POLICY "Admin and HR can update specialties"
ON public.specialties
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'hr'::app_role)
);

-- DELETE: Only Admin can delete specialties
CREATE POLICY "Admin can delete specialties"
ON public.specialties
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
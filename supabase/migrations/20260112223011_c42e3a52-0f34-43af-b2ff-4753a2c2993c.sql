-- ==============================================
-- TIMEKEEPER ROLE SECURITY IMPLEMENTATION
-- ==============================================

-- 1. Create a secure view for employees that hides sensitive columns from Timekeeper
-- This view shows only non-sensitive data that Timekeeper needs for time entry

CREATE OR REPLACE VIEW public.employees_limited AS
SELECT 
  id,
  employee_code,
  first_name,
  last_name,
  specialty_id,
  status,
  regular_start_time,
  regular_end_time,
  hire_date,
  phone,
  notes
FROM public.employees;

-- Grant access to the view
GRANT SELECT ON public.employees_limited TO authenticated;

-- 2. Create helper function to check if user is timekeeper ONLY (not admin/hr)
CREATE OR REPLACE FUNCTION public.is_timekeeper_only(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'timekeeper'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'hr')
  )
$$;

-- 3. Update employees RLS - Add policy for Timekeeper to use the limited view
-- First, create a policy allowing Timekeeper to read limited columns
DROP POLICY IF EXISTS "Timekeeper can view limited employee data" ON public.employees;

CREATE POLICY "Timekeeper can view limited employee data"
ON public.employees
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'timekeeper'::app_role) AND
  NOT has_elevated_role(auth.uid())
);

-- 4. Update projects RLS - Timekeeper sees only OPEN projects
DROP POLICY IF EXISTS "Projects viewable by authenticated users" ON public.projects;

CREATE POLICY "Admin and HR can view all projects"
ON public.projects
FOR SELECT
TO authenticated
USING (has_elevated_role(auth.uid()));

CREATE POLICY "Timekeeper can view open projects only"
ON public.projects
FOR SELECT
TO authenticated
USING (
  is_timekeeper_only(auth.uid()) AND
  status = 'OPEN'
);

-- 5. Update specialties RLS - Timekeeper can read specialties
DROP POLICY IF EXISTS "Authenticated users can view specialties" ON public.specialties;

CREATE POLICY "All authenticated can view specialties"
ON public.specialties
FOR SELECT
TO authenticated
USING (true);

-- 6. Update time_entries RLS for Timekeeper restrictions
-- Timekeeper can only see their own entries
DROP POLICY IF EXISTS "Time entries viewable by authorized users" ON public.time_entries;

CREATE POLICY "Elevated roles can view all time entries"
ON public.time_entries
FOR SELECT
TO authenticated
USING (has_elevated_role(auth.uid()));

CREATE POLICY "Timekeeper can view own time entries"
ON public.time_entries
FOR SELECT
TO authenticated
USING (
  is_timekeeper_only(auth.uid()) AND
  created_by = auth.uid()
);

-- 7. Timekeeper can delete own entries within 24 hours
DROP POLICY IF EXISTS "Admin can delete time entries" ON public.time_entries;

CREATE POLICY "Admin can delete any time entry"
ON public.time_entries
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Timekeeper can delete own entries within 24h"
ON public.time_entries
FOR DELETE
TO authenticated
USING (
  is_timekeeper_only(auth.uid()) AND
  created_by = auth.uid() AND
  created_at > (now() - interval '24 hours')
);

-- 8. Update correction_requests for Timekeeper
-- Timekeeper can create and view own requests
DROP POLICY IF EXISTS "Correction requests viewable by elevated or creator" ON public.correction_requests;

CREATE POLICY "Elevated roles view all correction requests"
ON public.correction_requests
FOR SELECT
TO authenticated
USING (has_elevated_role(auth.uid()));

CREATE POLICY "Timekeeper views own correction requests"
ON public.correction_requests
FOR SELECT
TO authenticated
USING (
  is_timekeeper_only(auth.uid()) AND
  requested_by = auth.uid()
);

-- 9. Add AFM validation constraints
ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS valid_project_afm_format;

ALTER TABLE public.projects
ADD CONSTRAINT valid_project_afm_format 
CHECK (
  customer_company_afm IS NULL OR 
  customer_company_afm = '' OR
  (customer_company_afm ~ '^[0-9]{9}$')
);

ALTER TABLE public.employees
DROP CONSTRAINT IF EXISTS valid_employee_afm_format;

ALTER TABLE public.employees
ADD CONSTRAINT valid_employee_afm_format 
CHECK (
  afm IS NULL OR 
  afm = '' OR
  (afm ~ '^[0-9]{9}$')
);
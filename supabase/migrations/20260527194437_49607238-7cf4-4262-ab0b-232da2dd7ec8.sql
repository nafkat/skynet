
-- A) HR access to companies (read) and projects (insert/update)
CREATE POLICY "HR can view companies"
ON public.companies FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "HR can insert projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "HR can update projects"
ON public.projects FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'hr'::app_role));

-- B) Allow elevated roles (admin/hr) to see other users' display names
-- so Daily Recorder column on Employees can resolve names instead of UUIDs.
CREATE POLICY "Elevated roles can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (has_elevated_role(auth.uid()));

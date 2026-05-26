
-- Update can_access_employee to honor employee_recorders (many-to-many) in addition to legacy assigned_user_id
CREATE OR REPLACE FUNCTION public.can_access_employee(_user_id uuid, _employee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.has_elevated_role(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = _employee_id AND e.assigned_user_id = _user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.employee_recorders er
      WHERE er.employee_id = _employee_id AND er.user_id = _user_id
    )
$function$;

-- Replace timekeeper SELECT policy on employees to also include employee_recorders mappings
DROP POLICY IF EXISTS "Timekeeper can view assigned employees only" ON public.employees;

CREATE POLICY "Timekeeper can view assigned employees"
ON public.employees
FOR SELECT
USING (
  has_role(auth.uid(), 'timekeeper'::app_role)
  AND NOT has_elevated_role(auth.uid())
  AND (
    assigned_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.employee_recorders er
      WHERE er.employee_id = employees.id AND er.user_id = auth.uid()
    )
  )
);

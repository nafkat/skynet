-- HR (permission-based) may also insert/update customer details. DELETE stays admin-only.
DROP POLICY IF EXISTS "Admins can insert project customer details" ON public.project_customer_details;
DROP POLICY IF EXISTS "Admins can update project customer details" ON public.project_customer_details;

CREATE POLICY "Elevated users can insert project customer details"
  ON public.project_customer_details FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'timekeeping.employees.manage')
    OR public.has_permission(auth.uid(), 'timekeeping.reports.export')
  );

CREATE POLICY "Elevated users can update project customer details"
  ON public.project_customer_details FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'timekeeping.employees.manage')
    OR public.has_permission(auth.uid(), 'timekeeping.reports.export')
  );
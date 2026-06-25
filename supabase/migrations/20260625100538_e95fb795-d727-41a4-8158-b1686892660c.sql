-- Allow HR to insert, update, delete employees (previously admin-only, causing RLS violation for HR users)
CREATE POLICY "HR can insert employees" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "HR can update employees" ON public.employees
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'hr'::app_role));

CREATE POLICY "HR can delete employees" ON public.employees
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'hr'::app_role));
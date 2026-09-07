CREATE TABLE public.project_customer_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer_company_name text NOT NULL DEFAULT '',
  customer_company_afm text,
  contact_name text,
  contact_email text,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_customer_details_project_unique UNIQUE (project_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_customer_details TO authenticated;
GRANT ALL ON public.project_customer_details TO service_role;

ALTER TABLE public.project_customer_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated users can view project customer details"
  ON public.project_customer_details FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'timekeeping.employees.manage')
    OR public.has_permission(auth.uid(), 'timekeeping.reports.export')
  );

CREATE POLICY "Admins can insert project customer details"
  ON public.project_customer_details FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update project customer details"
  ON public.project_customer_details FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete project customer details"
  ON public.project_customer_details FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_project_customer_details_updated_at
  BEFORE UPDATE ON public.project_customer_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.project_customer_details (project_id, customer_company_name, customer_company_afm)
SELECT id, customer_company_name, customer_company_afm
FROM public.projects
WHERE customer_company_name <> '' OR customer_company_afm IS NOT NULL
ON CONFLICT (project_id) DO NOTHING;

UPDATE public.projects SET customer_company_name = '', customer_company_afm = NULL;
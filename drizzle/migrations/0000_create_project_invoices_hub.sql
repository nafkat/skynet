CREATE TABLE public.project_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
 doc_type text NOT NULL CHECK (doc_type IN ('invoice','receipt','credit_note')),
 source text NOT NULL CHECK (source IN ('paper','electronic')),
 invoice_number text NOT NULL,
 issue_date date NOT NULL,
 currency text NOT NULL DEFAULT 'EUR',
 amount_original numeric(14,2) NOT NULL CHECK (amount_original > 0),
 exchange_rate numeric(12,6) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
 amount_eur numeric(14,2) NOT NULL,
 file_path text NOT NULL,
 notes text,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_invoices TO authenticated;
GRANT ALL ON public.project_invoices TO service_role;
ALTER TABLE public.project_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Elevated users can view project invoices" ON public.project_invoices FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') OR public.has_permission(auth.uid(),'timekeeping.employees.manage') OR public.has_permission(auth.uid(),'timekeeping.reports.export'));
CREATE POLICY "Elevated users can insert project invoices" ON public.project_invoices FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') OR public.has_permission(auth.uid(),'timekeeping.employees.manage') OR public.has_permission(auth.uid(),'timekeeping.reports.export'));
CREATE POLICY "Elevated users can update project invoices" ON public.project_invoices FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') OR public.has_permission(auth.uid(),'timekeeping.employees.manage') OR public.has_permission(auth.uid(),'timekeeping.reports.export')) WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') OR public.has_permission(auth.uid(),'timekeeping.employees.manage') OR public.has_permission(auth.uid(),'timekeeping.reports.export'));
CREATE POLICY "Elevated users can delete project invoices" ON public.project_invoices FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') OR public.has_permission(auth.uid(),'timekeeping.employees.manage') OR public.has_permission(auth.uid(),'timekeeping.reports.export'));
CREATE TRIGGER update_project_invoices_updated_at BEFORE UPDATE ON public.project_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Elevated users can read invoice files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='project-invoices' AND (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') OR public.has_permission(auth.uid(),'timekeeping.employees.manage') OR public.has_permission(auth.uid(),'timekeeping.reports.export')));
CREATE POLICY "Elevated users can upload invoice files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='project-invoices' AND lower(storage.extension(name)) IN ('pdf','jpg','jpeg','png','webp') AND metadata->>'mimetype' IN ('application/pdf','image/jpeg','image/png','image/webp') AND (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') OR public.has_permission(auth.uid(),'timekeeping.employees.manage') OR public.has_permission(auth.uid(),'timekeeping.reports.export')));
CREATE POLICY "Elevated users can update invoice files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='project-invoices' AND (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') OR public.has_permission(auth.uid(),'timekeeping.employees.manage') OR public.has_permission(auth.uid(),'timekeeping.reports.export'))) WITH CHECK (bucket_id='project-invoices' AND lower(storage.extension(name)) IN ('pdf','jpg','jpeg','png','webp') AND metadata->>'mimetype' IN ('application/pdf','image/jpeg','image/png','image/webp') AND (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') OR public.has_permission(auth.uid(),'timekeeping.employees.manage') OR public.has_permission(auth.uid(),'timekeeping.reports.export')));
CREATE POLICY "Elevated users can delete invoice files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='project-invoices' AND (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') OR public.has_permission(auth.uid(),'timekeeping.employees.manage') OR public.has_permission(auth.uid(),'timekeeping.reports.export')));
CREATE POLICY "Elevated users can view suppliers for invoices" ON public.suppliers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') OR public.has_permission(auth.uid(),'timekeeping.employees.manage') OR public.has_permission(auth.uid(),'timekeeping.reports.export'));
CREATE POLICY "Elevated users can add suppliers for invoices" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='admin') OR public.has_permission(auth.uid(),'timekeeping.employees.manage') OR public.has_permission(auth.uid(),'timekeeping.reports.export'));

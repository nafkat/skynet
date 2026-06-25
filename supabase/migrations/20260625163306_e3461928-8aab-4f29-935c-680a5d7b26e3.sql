
-- Section-level attachments for cost reports
CREATE TABLE public.cost_section_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.cost_sections(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_section_attachments TO authenticated;
GRANT ALL ON public.cost_section_attachments TO service_role;

ALTER TABLE public.cost_section_attachments ENABLE ROW LEVEL SECURITY;

-- View: anyone who can view the parent report
CREATE POLICY "View attachments if can view report"
ON public.cost_section_attachments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cost_sections cs
    WHERE cs.id = section_id
      AND public.can_view_cost_report(auth.uid(), cs.report_id)
  )
);

-- Insert: any costing user who can view the report
CREATE POLICY "Insert attachments if can view report"
ON public.cost_section_attachments FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.cost_sections cs
    WHERE cs.id = section_id
      AND public.can_view_cost_report(auth.uid(), cs.report_id)
  )
);

-- Delete: any costing user who can view the report (all three roles per request)
CREATE POLICY "Delete attachments if can view report"
ON public.cost_section_attachments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cost_sections cs
    WHERE cs.id = section_id
      AND public.can_view_cost_report(auth.uid(), cs.report_id)
  )
);

CREATE INDEX idx_cost_section_attachments_section ON public.cost_section_attachments(section_id);

-- Storage policies for cost-attachments bucket
CREATE POLICY "cost-attachments read for authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'cost-attachments');

CREATE POLICY "cost-attachments upload for authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cost-attachments');

CREATE POLICY "cost-attachments delete for authenticated"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'cost-attachments');

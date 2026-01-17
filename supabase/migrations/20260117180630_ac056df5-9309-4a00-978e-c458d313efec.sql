-- Add is_preferred to suppliers table
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_preferred boolean DEFAULT false;

-- Create rfq_attachments table
CREATE TABLE IF NOT EXISTS public.rfq_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  filename text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on rfq_attachments
ALTER TABLE public.rfq_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for rfq_attachments (Admin only)
CREATE POLICY "Admin can manage rfq attachments"
  ON public.rfq_attachments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create procurement storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('procurement', 'procurement', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for procurement bucket
CREATE POLICY "Admin can upload procurement files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'procurement' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admin can view procurement files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'procurement' AND
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admin can delete procurement files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'procurement' AND
    has_role(auth.uid(), 'admin'::app_role)
  );
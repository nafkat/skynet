
-- Create storage bucket for employee attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-attachments', 'employee-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Elevated roles can read employee attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'employee-attachments' AND public.has_elevated_role(auth.uid()));

CREATE POLICY "Anyone can read employee attachments public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'employee-attachments');

CREATE POLICY "Service role can upload employee attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-attachments');

-- Add attachment_name column to employee_messages if not exists
ALTER TABLE public.employee_messages
  ADD COLUMN IF NOT EXISTS attachment_name text;

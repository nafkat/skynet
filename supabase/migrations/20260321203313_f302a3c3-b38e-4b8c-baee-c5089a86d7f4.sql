
-- Add attachment columns to employee_messages
ALTER TABLE public.employee_messages
  ADD COLUMN IF NOT EXISTS admin_attachment_url text,
  ADD COLUMN IF NOT EXISTS admin_attachment_name text,
  ADD COLUMN IF NOT EXISTS admin_attachment_type text;

-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for message-attachments bucket
CREATE POLICY "Elevated roles can upload message attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND public.has_elevated_role(auth.uid())
);

CREATE POLICY "Anyone can read message attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'message-attachments');

CREATE POLICY "Elevated roles can delete message attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND public.has_elevated_role(auth.uid())
);

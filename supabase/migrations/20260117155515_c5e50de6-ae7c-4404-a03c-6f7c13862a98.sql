-- Create announcement status enum
CREATE TYPE public.announcement_status AS ENUM ('draft', 'pending', 'sent', 'partial', 'failed');

-- Create delivery status enum
CREATE TYPE public.delivery_status AS ENUM ('pending', 'sent', 'failed');

-- Create announcements table
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status announcement_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  recipients_snapshot JSONB
);

-- Enable RLS on announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Create announcement_attachments table
CREATE TABLE public.announcement_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on announcement_attachments
ALTER TABLE public.announcement_attachments ENABLE ROW LEVEL SECURITY;

-- Create announcement_recipients table
CREATE TABLE public.announcement_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, employee_id)
);

-- Enable RLS on announcement_recipients
ALTER TABLE public.announcement_recipients ENABLE ROW LEVEL SECURITY;

-- Create announcement_deliveries table
CREATE TABLE public.announcement_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.announcement_recipients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'viber',
  status delivery_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on announcement_deliveries
ALTER TABLE public.announcement_deliveries ENABLE ROW LEVEL SECURITY;

-- Create employee_contact_channels table for viber_user_id mapping
CREATE TABLE public.employee_contact_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL DEFAULT 'viber',
  channel_identifier TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, channel_type)
);

-- Enable RLS on employee_contact_channels
ALTER TABLE public.employee_contact_channels ENABLE ROW LEVEL SECURITY;

-- Create storage bucket for announcements
INSERT INTO storage.buckets (id, name, public) VALUES ('announcements', 'announcements', false);

-- RLS Policies for announcements
CREATE POLICY "Admin and HR can view all announcements"
ON public.announcements FOR SELECT
USING (has_elevated_role(auth.uid()));

CREATE POLICY "Admin and HR can insert announcements"
ON public.announcements FOR INSERT
WITH CHECK (has_elevated_role(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Admin and HR can update draft announcements"
ON public.announcements FOR UPDATE
USING (has_elevated_role(auth.uid()) AND status = 'draft');

CREATE POLICY "Admin and HR can delete draft announcements"
ON public.announcements FOR DELETE
USING (has_elevated_role(auth.uid()) AND status = 'draft');

-- RLS Policies for announcement_attachments
CREATE POLICY "Admin and HR can view all attachments"
ON public.announcement_attachments FOR SELECT
USING (has_elevated_role(auth.uid()));

CREATE POLICY "Admin and HR can insert attachments"
ON public.announcement_attachments FOR INSERT
WITH CHECK (has_elevated_role(auth.uid()));

CREATE POLICY "Admin and HR can delete attachments for drafts"
ON public.announcement_attachments FOR DELETE
USING (has_elevated_role(auth.uid()) AND EXISTS (
  SELECT 1 FROM public.announcements 
  WHERE id = announcement_id AND status = 'draft'
));

-- RLS Policies for announcement_recipients
CREATE POLICY "Admin and HR can view all recipients"
ON public.announcement_recipients FOR SELECT
USING (has_elevated_role(auth.uid()));

CREATE POLICY "Admin and HR can insert recipients"
ON public.announcement_recipients FOR INSERT
WITH CHECK (has_elevated_role(auth.uid()));

CREATE POLICY "Admin and HR can delete recipients for drafts"
ON public.announcement_recipients FOR DELETE
USING (has_elevated_role(auth.uid()) AND EXISTS (
  SELECT 1 FROM public.announcements 
  WHERE id = announcement_id AND status = 'draft'
));

-- RLS Policies for announcement_deliveries
CREATE POLICY "Admin and HR can view all deliveries"
ON public.announcement_deliveries FOR SELECT
USING (has_elevated_role(auth.uid()));

CREATE POLICY "Admin and HR can insert deliveries"
ON public.announcement_deliveries FOR INSERT
WITH CHECK (has_elevated_role(auth.uid()));

CREATE POLICY "Admin and HR can update deliveries"
ON public.announcement_deliveries FOR UPDATE
USING (has_elevated_role(auth.uid()));

-- RLS Policies for employee_contact_channels
CREATE POLICY "Admin and HR can view all contact channels"
ON public.employee_contact_channels FOR SELECT
USING (has_elevated_role(auth.uid()));

CREATE POLICY "Admin can manage contact channels"
ON public.employee_contact_channels FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Storage policies for announcements bucket
CREATE POLICY "Admin and HR can view announcement files"
ON storage.objects FOR SELECT
USING (bucket_id = 'announcements' AND has_elevated_role(auth.uid()));

CREATE POLICY "Admin and HR can upload announcement files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'announcements' AND has_elevated_role(auth.uid()));

CREATE POLICY "Admin and HR can delete announcement files"
ON storage.objects FOR DELETE
USING (bucket_id = 'announcements' AND has_elevated_role(auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcement_deliveries_updated_at
BEFORE UPDATE ON public.announcement_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_contact_channels_updated_at
BEFORE UPDATE ON public.employee_contact_channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
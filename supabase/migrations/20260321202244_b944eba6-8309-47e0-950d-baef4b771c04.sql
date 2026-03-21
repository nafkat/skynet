
-- Create employee_messages table for two-way Telegram messaging
CREATE TABLE public.employee_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL,
  message_text TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  attachment_url TEXT,
  attachment_file_id TEXT,
  status TEXT NOT NULL DEFAULT 'unread',
  admin_reply TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  replied_at TIMESTAMP WITH TIME ZONE,
  replied_by UUID
);

-- Enable RLS
ALTER TABLE public.employee_messages ENABLE ROW LEVEL SECURITY;

-- Admin and HR can view all messages
CREATE POLICY "Elevated roles can view messages"
  ON public.employee_messages
  FOR SELECT
  TO authenticated
  USING (public.has_elevated_role(auth.uid()));

-- Admin and HR can update messages (reply, change status)
CREATE POLICY "Elevated roles can update messages"
  ON public.employee_messages
  FOR UPDATE
  TO authenticated
  USING (public.has_elevated_role(auth.uid()));

-- Service role inserts via edge function (no INSERT policy needed for authenticated users)
-- But allow insert for service role operations
CREATE POLICY "Service role can insert messages"
  ON public.employee_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_elevated_role(auth.uid()));

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_messages;

-- Create indexes
CREATE INDEX idx_employee_messages_employee_id ON public.employee_messages(employee_id);
CREATE INDEX idx_employee_messages_status ON public.employee_messages(status);
CREATE INDEX idx_employee_messages_created_at ON public.employee_messages(created_at DESC);

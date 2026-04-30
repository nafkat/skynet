-- 1) Make message/attachment buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('employee-attachments', 'message-attachments');

-- 2) Remove public read policies; keep elevated-role read policies in place
DROP POLICY IF EXISTS "Anyone can read message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read employee attachments public" ON storage.objects;

-- Add an elevated-role read policy for message-attachments (was relying on the public one)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname = 'Elevated roles can read message attachments'
  ) THEN
    CREATE POLICY "Elevated roles can read message attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'message-attachments' AND public.has_elevated_role(auth.uid()));
  END IF;
END $$;

-- 3) Restrict get_user_email and revoke public execute
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin'::app_role)
    THEN (SELECT email FROM auth.users WHERE id = _user_id)
    ELSE NULL
  END
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_email(uuid) FROM PUBLIC, anon, authenticated;

-- 4) Realtime authorization for employee_messages channel topic
-- Only admin/HR may subscribe to the 'employee_messages' broadcast/presence/postgres_changes topic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'realtime.messages'::regclass
      AND polname = 'Elevated roles can subscribe to employee_messages topic'
  ) THEN
    CREATE POLICY "Elevated roles can subscribe to employee_messages topic"
    ON realtime.messages FOR SELECT
    TO authenticated
    USING (public.has_elevated_role((SELECT auth.uid())));
  END IF;
END $$;
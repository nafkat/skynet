
-- Add archive columns to announcements
ALTER TABLE public.announcements
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_by uuid;

-- Add archive columns to employee_messages
ALTER TABLE public.employee_messages
  ADD COLUMN is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_by uuid;

-- Allow admin to update announcements (for archiving sent ones too)
DROP POLICY IF EXISTS "Admin and HR can update draft announcements" ON public.announcements;
CREATE POLICY "Admin and HR can update announcements"
  ON public.announcements
  FOR UPDATE
  USING (has_elevated_role(auth.uid()));

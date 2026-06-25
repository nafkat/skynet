
-- Add review workflow columns to cost_reports
ALTER TABLE public.cost_reports
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

ALTER TABLE public.cost_reports
  DROP CONSTRAINT IF EXISTS cost_reports_review_status_check;
ALTER TABLE public.cost_reports
  ADD CONSTRAINT cost_reports_review_status_check
  CHECK (review_status IN ('draft','submitted_for_review','changes_requested','approved'));

-- Helper: can approve cost reports (admin or manager-level)
CREATE OR REPLACE FUNCTION public.can_approve_cost_reports(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_permission(_user_id, 'costing.reports.approve');
$$;

-- Review comments thread
CREATE TABLE IF NOT EXISTS public.cost_report_review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.cost_reports(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  comment text NOT NULL,
  action text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crrc_report ON public.cost_report_review_comments(report_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_report_review_comments TO authenticated;
GRANT ALL ON public.cost_report_review_comments TO service_role;
ALTER TABLE public.cost_report_review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY crrc_select ON public.cost_report_review_comments FOR SELECT
USING (public.can_view_cost_report(auth.uid(), report_id));

CREATE POLICY crrc_insert ON public.cost_report_review_comments FOR INSERT
WITH CHECK (
  author_id = auth.uid()
  AND public.can_view_cost_report(auth.uid(), report_id)
);

CREATE POLICY crrc_delete ON public.cost_report_review_comments FOR DELETE
USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Notifications (in-app)
CREATE TABLE IF NOT EXISTS public.cost_report_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.cost_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL,
  message text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crn_user_unread ON public.cost_report_notifications(user_id, read_at, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_report_notifications TO authenticated;
GRANT ALL ON public.cost_report_notifications TO service_role;
ALTER TABLE public.cost_report_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY crn_select ON public.cost_report_notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY crn_update ON public.cost_report_notifications FOR UPDATE
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY crn_insert ON public.cost_report_notifications FOR INSERT
WITH CHECK (true);  -- inserted via trigger / server-side flows

CREATE POLICY crn_delete ON public.cost_report_notifications FOR DELETE
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.cost_report_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cost_report_review_comments;

-- Trigger: enforce external status transitions require approval
CREATE OR REPLACE FUNCTION public.enforce_cost_report_external_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('sent','agreed','invoiced') AND NEW.review_status <> 'approved' THEN
      RAISE EXCEPTION 'Report must be approved before changing status to %', NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_cost_report_external_status ON public.cost_reports;
CREATE TRIGGER trg_enforce_cost_report_external_status
BEFORE UPDATE ON public.cost_reports
FOR EACH ROW EXECUTE FUNCTION public.enforce_cost_report_external_status();

-- Trigger: notifications on review_status change
CREATE OR REPLACE FUNCTION public.notify_cost_report_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_recipient uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.review_status IS DISTINCT FROM OLD.review_status THEN
    IF NEW.review_status = 'submitted_for_review' THEN
      -- Notify all admins + users with approve permission
      FOR v_recipient IN
        SELECT DISTINCT u.user_id FROM (
          SELECT user_id FROM public.user_roles WHERE role = 'admin'
          UNION
          SELECT user_id FROM public.user_permissions
            WHERE permission_key = 'costing.reports.approve' AND allowed = true
        ) u
        WHERE u.user_id <> COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid)
      LOOP
        INSERT INTO public.cost_report_notifications (report_id, user_id, type, message)
        VALUES (NEW.id, v_recipient, 'submitted_for_review', NEW.code || ' submitted for review');
      END LOOP;
    ELSIF NEW.review_status IN ('approved','changes_requested') THEN
      -- Notify the creator
      IF NEW.created_by IS NOT NULL AND NEW.created_by <> COALESCE(v_actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.cost_report_notifications (report_id, user_id, type, message)
        VALUES (NEW.id, NEW.created_by, NEW.review_status,
          NEW.code || CASE WHEN NEW.review_status = 'approved' THEN ' approved' ELSE ' — changes requested' END);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_cost_report_review ON public.cost_reports;
CREATE TRIGGER trg_notify_cost_report_review
AFTER UPDATE ON public.cost_reports
FOR EACH ROW EXECUTE FUNCTION public.notify_cost_report_review();

-- Add approve permission to module_actions catalog if used elsewhere (best-effort, no-op if missing)
-- Grant approve permission to admin templates by inserting into permission_template_permissions
INSERT INTO public.permission_template_permissions (template_id, permission_key, allowed)
SELECT pt.id, 'costing.reports.approve', true
FROM public.permission_templates pt
WHERE pt.base_role = 'admin'
ON CONFLICT DO NOTHING;

-- Recompute permissions so existing admins immediately have the new key
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.user_permission_templates LOOP
    PERFORM public.recompute_user_permissions(r.user_id);
  END LOOP;
END $$;

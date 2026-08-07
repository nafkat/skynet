DROP POLICY IF EXISTS crn_insert ON public.cost_report_notifications;
CREATE POLICY crn_insert ON public.cost_report_notifications
FOR INSERT TO authenticated
WITH CHECK (false);
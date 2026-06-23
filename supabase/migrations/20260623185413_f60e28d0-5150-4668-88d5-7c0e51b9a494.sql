
-- Helper: user has at least one item in a given report (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.user_has_items_in_report(_user_id uuid, _report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cost_items ci
    JOIN public.cost_sections cs ON cs.id = ci.section_id
    WHERE cs.report_id = _report_id
      AND ci.created_by = _user_id
  )
$$;

-- Helper: user can view a report (admin/manager OR creator OR has-own-item)
CREATE OR REPLACE FUNCTION public.can_view_cost_report(_user_id uuid, _report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_view_all_cost_reports(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.cost_reports r
      WHERE r.id = _report_id AND r.created_by = _user_id
    )
    OR (
      public.has_permission(_user_id, 'costing.reports.view_own')
      AND public.user_has_items_in_report(_user_id, _report_id)
    )
$$;

-- Rewrite cost_reports SELECT policy (was recursive via cost_items -> cost_reports)
DROP POLICY IF EXISTS cost_reports_select ON public.cost_reports;
CREATE POLICY cost_reports_select ON public.cost_reports
FOR SELECT
USING (
  public.can_view_all_cost_reports(auth.uid())
  OR created_by = auth.uid()
  OR (
    public.has_permission(auth.uid(), 'costing.reports.view_own')
    AND public.user_has_items_in_report(auth.uid(), id)
  )
);

-- Rewrite cost_sections SELECT policy via SECURITY DEFINER helper (no more cross-table EXISTS at policy time)
DROP POLICY IF EXISTS cost_sections_select ON public.cost_sections;
CREATE POLICY cost_sections_select ON public.cost_sections
FOR SELECT
USING (public.can_view_cost_report(auth.uid(), report_id));

-- Rewrite cost_items SELECT policy: drop the join back to cost_reports (recursive). Owner-of-report case is covered by can_view_all_cost_reports for elevated roles; non-elevated creators of a report can still see their items via created_by = auth.uid() on the report and via user_has_items_in_report on the report itself.
DROP POLICY IF EXISTS cost_items_select ON public.cost_items;
CREATE POLICY cost_items_select ON public.cost_items
FOR SELECT
USING (
  public.can_view_all_cost_reports(auth.uid())
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.cost_sections cs
    WHERE cs.id = cost_items.section_id
      AND public.can_view_cost_report(auth.uid(), cs.report_id)
  )
);


-- Add created_by to cost_items & cost_item_photos for ownership-based RLS
ALTER TABLE public.cost_items
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.cost_item_photos
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Permission templates
INSERT INTO public.permission_templates (id, name, description, base_role)
VALUES
  ('77777777-7777-7777-7777-777777777777', 'Costing – Admin',     'Full costing access: reports, items, costs, delete, approve', 'admin'::app_role),
  ('88888888-8888-8888-8888-888888888888', 'Costing – Manager',   'Manage reports & items, view/edit costs, approve, delete reports', 'timekeeper'::app_role),
  ('99999999-9999-9999-9999-999999999999', 'Costing – Field User','Mobile field entry: add items & photos, no cost visibility', 'timekeeper'::app_role)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, base_role=EXCLUDED.base_role;

DELETE FROM public.permission_template_permissions
WHERE template_id IN (
  '77777777-7777-7777-7777-777777777777',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999'
);

INSERT INTO public.permission_template_permissions (template_id, permission_key, allowed) VALUES
  ('77777777-7777-7777-7777-777777777777','module.costing',true),
  ('77777777-7777-7777-7777-777777777777','costing.reports.view_all',true),
  ('77777777-7777-7777-7777-777777777777','costing.reports.create',true),
  ('77777777-7777-7777-7777-777777777777','costing.reports.edit',true),
  ('77777777-7777-7777-7777-777777777777','costing.reports.delete',true),
  ('77777777-7777-7777-7777-777777777777','costing.reports.change_status',true),
  ('77777777-7777-7777-7777-777777777777','costing.items.create',true),
  ('77777777-7777-7777-7777-777777777777','costing.items.edit',true),
  ('77777777-7777-7777-7777-777777777777','costing.items.delete',true),
  ('77777777-7777-7777-7777-777777777777','costing.costs.view',true),
  ('77777777-7777-7777-7777-777777777777','costing.costs.edit',true),
  ('77777777-7777-7777-7777-777777777777','costing.field_entry',true),

  ('88888888-8888-8888-8888-888888888888','module.costing',true),
  ('88888888-8888-8888-8888-888888888888','costing.reports.view_all',true),
  ('88888888-8888-8888-8888-888888888888','costing.reports.create',true),
  ('88888888-8888-8888-8888-888888888888','costing.reports.edit',true),
  ('88888888-8888-8888-8888-888888888888','costing.reports.delete',true),
  ('88888888-8888-8888-8888-888888888888','costing.reports.change_status',true),
  ('88888888-8888-8888-8888-888888888888','costing.items.create',true),
  ('88888888-8888-8888-8888-888888888888','costing.items.edit',true),
  ('88888888-8888-8888-8888-888888888888','costing.items.delete',true),
  ('88888888-8888-8888-8888-888888888888','costing.costs.view',true),
  ('88888888-8888-8888-8888-888888888888','costing.costs.edit',true),
  ('88888888-8888-8888-8888-888888888888','costing.field_entry',true),

  ('99999999-9999-9999-9999-999999999999','module.costing',true),
  ('99999999-9999-9999-9999-999999999999','costing.reports.view_own',true),
  ('99999999-9999-9999-9999-999999999999','costing.items.create',true),
  ('99999999-9999-9999-9999-999999999999','costing.items.edit_own',true),
  ('99999999-9999-9999-9999-999999999999','costing.items.delete_own',true),
  ('99999999-9999-9999-9999-999999999999','costing.field_entry',true);

-- Helpers
CREATE OR REPLACE FUNCTION public.can_view_all_cost_reports(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_elevated_role(_user_id) OR public.has_permission(_user_id,'costing.reports.view_all');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_cost_reports(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_elevated_role(_user_id)
      OR public.has_permission(_user_id,'costing.reports.create')
      OR public.has_permission(_user_id,'costing.reports.edit');
$$;

CREATE OR REPLACE FUNCTION public.can_delete_cost_reports(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_elevated_role(_user_id) OR public.has_permission(_user_id,'costing.reports.delete');
$$;

CREATE OR REPLACE FUNCTION public.can_add_cost_items(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_elevated_role(_user_id) OR public.has_permission(_user_id,'costing.items.create');
$$;

-- Replace RLS
DROP POLICY IF EXISTS "Elevated and costing users can manage cost reports"  ON public.cost_reports;
DROP POLICY IF EXISTS "Elevated and costing users can manage cost sections" ON public.cost_sections;
DROP POLICY IF EXISTS "Elevated and costing users can manage cost items"    ON public.cost_items;
DROP POLICY IF EXISTS "Elevated and costing users can manage cost photos"   ON public.cost_item_photos;

-- COST_REPORTS
CREATE POLICY "cost_reports_select" ON public.cost_reports FOR SELECT TO authenticated
USING (
  public.can_view_all_cost_reports(auth.uid())
  OR created_by = auth.uid()
  OR (
    public.has_permission(auth.uid(),'costing.reports.view_own')
    AND EXISTS (
      SELECT 1 FROM public.cost_items ci
      JOIN public.cost_sections cs ON cs.id = ci.section_id
      WHERE cs.report_id = cost_reports.id AND ci.created_by = auth.uid()
    )
  )
);

CREATE POLICY "cost_reports_insert" ON public.cost_reports FOR INSERT TO authenticated
WITH CHECK (public.can_manage_cost_reports(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "cost_reports_update" ON public.cost_reports FOR UPDATE TO authenticated
USING (public.can_manage_cost_reports(auth.uid()))
WITH CHECK (public.can_manage_cost_reports(auth.uid()));

CREATE POLICY "cost_reports_delete" ON public.cost_reports FOR DELETE TO authenticated
USING (public.can_delete_cost_reports(auth.uid()));

-- COST_SECTIONS (visible if parent report is visible)
CREATE POLICY "cost_sections_select" ON public.cost_sections FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cost_reports r WHERE r.id = cost_sections.report_id));

CREATE POLICY "cost_sections_modify" ON public.cost_sections FOR ALL TO authenticated
USING (public.can_manage_cost_reports(auth.uid()))
WITH CHECK (public.can_manage_cost_reports(auth.uid()));

-- COST_ITEMS
CREATE POLICY "cost_items_select" ON public.cost_items FOR SELECT TO authenticated
USING (
  public.can_view_all_cost_reports(auth.uid())
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.cost_sections cs
    JOIN public.cost_reports r ON r.id = cs.report_id
    WHERE cs.id = cost_items.section_id AND r.created_by = auth.uid()
  )
);

CREATE POLICY "cost_items_insert" ON public.cost_items FOR INSERT TO authenticated
WITH CHECK (public.can_add_cost_items(auth.uid()) AND (created_by IS NULL OR created_by = auth.uid()));

CREATE POLICY "cost_items_update" ON public.cost_items FOR UPDATE TO authenticated
USING (
  public.has_elevated_role(auth.uid())
  OR public.has_permission(auth.uid(),'costing.items.edit')
  OR (public.has_permission(auth.uid(),'costing.items.edit_own') AND created_by = auth.uid())
)
WITH CHECK (
  public.has_elevated_role(auth.uid())
  OR public.has_permission(auth.uid(),'costing.items.edit')
  OR (public.has_permission(auth.uid(),'costing.items.edit_own') AND created_by = auth.uid())
);

CREATE POLICY "cost_items_delete" ON public.cost_items FOR DELETE TO authenticated
USING (
  public.has_elevated_role(auth.uid())
  OR public.has_permission(auth.uid(),'costing.items.delete')
  OR (public.has_permission(auth.uid(),'costing.items.delete_own') AND created_by = auth.uid())
);

-- COST_ITEM_PHOTOS
CREATE POLICY "cost_photos_select" ON public.cost_item_photos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cost_items ci WHERE ci.id = cost_item_photos.item_id));

CREATE POLICY "cost_photos_insert" ON public.cost_item_photos FOR INSERT TO authenticated
WITH CHECK (public.can_add_cost_items(auth.uid()) AND (created_by IS NULL OR created_by = auth.uid()));

CREATE POLICY "cost_photos_delete" ON public.cost_item_photos FOR DELETE TO authenticated
USING (
  public.has_elevated_role(auth.uid())
  OR public.has_permission(auth.uid(),'costing.items.delete')
  OR (created_by = auth.uid() AND public.has_permission(auth.uid(),'costing.items.delete_own'))
);

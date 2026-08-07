DROP POLICY IF EXISTS cost_photos_select ON public.cost_item_photos;
CREATE POLICY cost_photos_select ON public.cost_item_photos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cost_items ci
    JOIN public.cost_sections cs ON cs.id = ci.section_id
    WHERE ci.id = cost_item_photos.item_id
      AND public.can_view_cost_report(auth.uid(), cs.report_id)
  )
);

DROP POLICY IF EXISTS cost_photos_insert ON public.cost_item_photos;
CREATE POLICY cost_photos_insert ON public.cost_item_photos
FOR INSERT TO authenticated
WITH CHECK (
  public.can_add_cost_items(auth.uid())
  AND ((created_by IS NULL) OR (created_by = auth.uid()))
  AND EXISTS (
    SELECT 1
    FROM public.cost_items ci
    JOIN public.cost_sections cs ON cs.id = ci.section_id
    WHERE ci.id = cost_item_photos.item_id
      AND (
        public.can_view_cost_report(auth.uid(), cs.report_id)
        OR ci.created_by = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS cost_photos_delete ON public.cost_item_photos;
CREATE POLICY cost_photos_delete ON public.cost_item_photos
FOR DELETE TO authenticated
USING (
  (
    public.has_elevated_role(auth.uid())
    OR public.has_permission(auth.uid(), 'costing.items.delete')
    OR (created_by = auth.uid() AND public.has_permission(auth.uid(), 'costing.items.delete_own'))
  )
  AND EXISTS (
    SELECT 1
    FROM public.cost_items ci
    JOIN public.cost_sections cs ON cs.id = ci.section_id
    WHERE ci.id = cost_item_photos.item_id
      AND (
        public.can_view_cost_report(auth.uid(), cs.report_id)
        OR ci.created_by = auth.uid()
      )
  )
);

GRANT SELECT, INSERT, DELETE ON public.cost_item_photos TO authenticated;
GRANT ALL ON public.cost_item_photos TO service_role;
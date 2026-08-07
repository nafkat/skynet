CREATE OR REPLACE FUNCTION public.safe_uuid(_txt text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _txt ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN _txt::uuid
    ELSE NULL
  END
$$;

-- Photos: '<report_id>/<item_id>/file' or 'covers/<report_id>/file'
CREATE OR REPLACE FUNCTION public.cost_photo_report_id(_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT CASE
    WHEN (storage.foldername(_name))[1] = 'covers'
      THEN public.safe_uuid((storage.foldername(_name))[2])
    ELSE public.safe_uuid((storage.foldername(_name))[1])
  END
$$;

-- Attachments: '<section_id>/file'
CREATE OR REPLACE FUNCTION public.cost_attachment_report_id(_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT cs.report_id
  FROM public.cost_sections cs
  WHERE cs.id = public.safe_uuid((storage.foldername(_name))[1])
$$;

-- cost-photos policies
DROP POLICY IF EXISTS "Authenticated can view cost-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload cost-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete cost-photos" ON storage.objects;

CREATE POLICY "cost-photos view with report access"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cost-photos'
  AND public.can_view_cost_report(auth.uid(), public.cost_photo_report_id(name))
);

CREATE POLICY "cost-photos upload with report access"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cost-photos'
  AND public.can_view_cost_report(auth.uid(), public.cost_photo_report_id(name))
  AND (
    public.can_add_cost_items(auth.uid())
    OR public.can_manage_cost_reports(auth.uid())
  )
);

CREATE POLICY "cost-photos delete with report access"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cost-photos'
  AND public.can_view_cost_report(auth.uid(), public.cost_photo_report_id(name))
  AND (
    public.can_add_cost_items(auth.uid())
    OR public.can_manage_cost_reports(auth.uid())
    OR public.can_delete_cost_reports(auth.uid())
  )
);

-- cost-attachments policies
DROP POLICY IF EXISTS "cost-attachments read for authenticated" ON storage.objects;
DROP POLICY IF EXISTS "cost-attachments upload for authenticated" ON storage.objects;
DROP POLICY IF EXISTS "cost-attachments delete for authenticated" ON storage.objects;

CREATE POLICY "cost-attachments view with report access"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cost-attachments'
  AND public.can_view_cost_report(auth.uid(), public.cost_attachment_report_id(name))
);

CREATE POLICY "cost-attachments upload with report access"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cost-attachments'
  AND public.can_view_cost_report(auth.uid(), public.cost_attachment_report_id(name))
  AND (
    public.can_add_cost_items(auth.uid())
    OR public.can_manage_cost_reports(auth.uid())
  )
);

CREATE POLICY "cost-attachments delete with report access"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cost-attachments'
  AND public.can_view_cost_report(auth.uid(), public.cost_attachment_report_id(name))
  AND (
    public.can_add_cost_items(auth.uid())
    OR public.can_manage_cost_reports(auth.uid())
    OR public.can_delete_cost_reports(auth.uid())
  )
);
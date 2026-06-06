-- COST REPORTS
CREATE TABLE public.cost_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL DEFAULT '',
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL DEFAULT 1,
  parent_report_id UUID REFERENCES public.cost_reports(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','agreed','invoiced')),
  version_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_reports TO authenticated;
GRANT ALL ON public.cost_reports TO service_role;

CREATE SEQUENCE public.cost_report_seq START 1;
GRANT USAGE ON SEQUENCE public.cost_report_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_cost_report_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'CR-' || LPAD(nextval('public.cost_report_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cost_report_code
BEFORE INSERT ON public.cost_reports
FOR EACH ROW EXECUTE FUNCTION public.generate_cost_report_code();

CREATE TRIGGER trg_cost_reports_updated_at
BEFORE UPDATE ON public.cost_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- COST SECTIONS
CREATE TABLE public.cost_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.cost_reports(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_sections TO authenticated;
GRANT ALL ON public.cost_sections TO service_role;

-- COST ITEMS
CREATE TABLE public.cost_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.cost_sections(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  voice_note_text TEXT,
  calculation_type TEXT NOT NULL DEFAULT 'unit'
    CHECK (calculation_type IN ('unit','lumpsum','area','linear','weight')),
  quantity NUMERIC(12,3),
  unit TEXT,
  unit_price NUMERIC(12,2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_items TO authenticated;
GRANT ALL ON public.cost_items TO service_role;

-- COST ITEM PHOTOS
CREATE TABLE public.cost_item_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.cost_items(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_item_photos TO authenticated;
GRANT ALL ON public.cost_item_photos TO service_role;

-- RLS
ALTER TABLE public.cost_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_item_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated and costing users can manage cost reports"
ON public.cost_reports FOR ALL TO authenticated
USING (
  public.has_elevated_role(auth.uid()) OR
  public.has_permission(auth.uid(), 'costing.create')
)
WITH CHECK (
  public.has_elevated_role(auth.uid()) OR
  public.has_permission(auth.uid(), 'costing.create')
);

CREATE POLICY "Elevated and costing users can manage cost sections"
ON public.cost_sections FOR ALL TO authenticated
USING (
  public.has_elevated_role(auth.uid()) OR
  public.has_permission(auth.uid(), 'costing.create')
)
WITH CHECK (
  public.has_elevated_role(auth.uid()) OR
  public.has_permission(auth.uid(), 'costing.create')
);

CREATE POLICY "Elevated and costing users can manage cost items"
ON public.cost_items FOR ALL TO authenticated
USING (
  public.has_elevated_role(auth.uid()) OR
  public.has_permission(auth.uid(), 'costing.create')
)
WITH CHECK (
  public.has_elevated_role(auth.uid()) OR
  public.has_permission(auth.uid(), 'costing.create')
);

CREATE POLICY "Elevated and costing users can manage cost photos"
ON public.cost_item_photos FOR ALL TO authenticated
USING (
  public.has_elevated_role(auth.uid()) OR
  public.has_permission(auth.uid(), 'costing.create')
)
WITH CHECK (
  public.has_elevated_role(auth.uid()) OR
  public.has_permission(auth.uid(), 'costing.create')
);
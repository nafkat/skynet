
-- 1. Add project_id column to request_offers
ALTER TABLE public.request_offers
ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

-- 2. Create request_offer_items table
CREATE TABLE IF NOT EXISTS public.request_offer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_offer_id uuid NOT NULL REFERENCES public.request_offers(id) ON DELETE CASCADE,
  item_number integer NOT NULL,
  description text NOT NULL,
  qty numeric,
  uom text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS on request_offer_items
ALTER TABLE public.request_offer_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for request_offer_items
CREATE POLICY "Admins can view all request_offer_items"
  ON public.request_offer_items FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create request_offer_items"
  ON public.request_offer_items FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update request_offer_items"
  ON public.request_offer_items FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete request_offer_items"
  ON public.request_offer_items FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Update existing NULLs before setting NOT NULL
UPDATE public.request_offers SET delivery_location = '' WHERE delivery_location IS NULL;
UPDATE public.request_offers SET contact_person = '' WHERE contact_person IS NULL;
UPDATE public.request_offers SET contact_phone = '' WHERE contact_phone IS NULL;

-- 6. Make fields NOT NULL
ALTER TABLE public.request_offers
  ALTER COLUMN delivery_location SET NOT NULL,
  ALTER COLUMN delivery_location SET DEFAULT '',
  ALTER COLUMN contact_person SET NOT NULL,
  ALTER COLUMN contact_person SET DEFAULT '',
  ALTER COLUMN contact_phone SET NOT NULL,
  ALTER COLUMN contact_phone SET DEFAULT '';

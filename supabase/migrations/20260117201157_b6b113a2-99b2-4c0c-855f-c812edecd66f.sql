-- Procurement V1 Database Schema

-- 1. Update suppliers table: add supplier_type, vat_number, and unique constraint
ALTER TABLE public.suppliers 
  ADD COLUMN IF NOT EXISTS supplier_type text DEFAULT 'supplier' CHECK (supplier_type IN ('supplier', 'subcontractor', 'both')),
  ADD COLUMN IF NOT EXISTS vat_number text;

-- Make country NOT NULL with default empty string for existing rows
UPDATE public.suppliers SET country = '' WHERE country IS NULL;
ALTER TABLE public.suppliers ALTER COLUMN country SET NOT NULL;
ALTER TABLE public.suppliers ALTER COLUMN country SET DEFAULT '';

-- Make vat_number NOT NULL with default empty string for existing rows  
UPDATE public.suppliers SET vat_number = '' WHERE vat_number IS NULL;
ALTER TABLE public.suppliers ALTER COLUMN vat_number SET NOT NULL;
ALTER TABLE public.suppliers ALTER COLUMN vat_number SET DEFAULT '';

-- Add unique constraint on country + vat_number (only when both are non-empty)
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_country_vat_unique 
  ON public.suppliers (country, vat_number) 
  WHERE country != '' AND vat_number != '';

-- 2. Create sequence for RO numbers
CREATE SEQUENCE IF NOT EXISTS public.ro_number_seq START 1;

-- 3. Create request_offers table
CREATE TABLE IF NOT EXISTS public.request_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ro_number text UNIQUE,
  type text NOT NULL CHECK (type IN ('material', 'service')),
  project_name text,
  vessel_or_job text,
  title text NOT NULL,
  description text NOT NULL,
  qty numeric,
  uom text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'closed')),
  message_to_recipients text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Create trigger for auto-generating RO number
CREATE OR REPLACE FUNCTION public.generate_ro_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  SELECT nextval('public.ro_number_seq') INTO next_seq;
  NEW.ro_number := 'RO-' || LPAD(next_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_ro_number ON public.request_offers;
CREATE TRIGGER set_ro_number
  BEFORE INSERT ON public.request_offers
  FOR EACH ROW
  WHEN (NEW.ro_number IS NULL)
  EXECUTE FUNCTION public.generate_ro_number();

-- 4. Create request_offer_recipients table
CREATE TABLE IF NOT EXISTS public.request_offer_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_offer_id uuid REFERENCES public.request_offers(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id),
  email_used text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text
);

-- 5. Create request_offer_attachments table
CREATE TABLE IF NOT EXISTS public.request_offer_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_offer_id uuid REFERENCES public.request_offers(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  filename text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- 6. Enable RLS on all new tables
ALTER TABLE public.request_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_offer_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_offer_attachments ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies - Admin only access

-- request_offers policies
CREATE POLICY "Admins can view all request_offers" 
  ON public.request_offers FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create request_offers" 
  ON public.request_offers FOR INSERT 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update request_offers" 
  ON public.request_offers FOR UPDATE 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete request_offers" 
  ON public.request_offers FOR DELETE 
  USING (public.has_role(auth.uid(), 'admin'));

-- request_offer_recipients policies
CREATE POLICY "Admins can view all request_offer_recipients" 
  ON public.request_offer_recipients FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create request_offer_recipients" 
  ON public.request_offer_recipients FOR INSERT 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update request_offer_recipients" 
  ON public.request_offer_recipients FOR UPDATE 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete request_offer_recipients" 
  ON public.request_offer_recipients FOR DELETE 
  USING (public.has_role(auth.uid(), 'admin'));

-- request_offer_attachments policies
CREATE POLICY "Admins can view all request_offer_attachments" 
  ON public.request_offer_attachments FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create request_offer_attachments" 
  ON public.request_offer_attachments FOR INSERT 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update request_offer_attachments" 
  ON public.request_offer_attachments FOR UPDATE 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete request_offer_attachments" 
  ON public.request_offer_attachments FOR DELETE 
  USING (public.has_role(auth.uid(), 'admin'));
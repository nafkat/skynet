-- =====================================================
-- PART B: PERMISSION TEMPLATES
-- =====================================================

-- TABLE: permission_templates
CREATE TABLE IF NOT EXISTS public.permission_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- TABLE: permission_template_modules
CREATE TABLE IF NOT EXISTS public.permission_template_modules (
  template_id uuid REFERENCES public.permission_templates(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  can_access boolean NOT NULL DEFAULT false,
  PRIMARY KEY (template_id, module_key)
);

-- TABLE: permission_template_actions
CREATE TABLE IF NOT EXISTS public.permission_template_actions (
  template_id uuid REFERENCES public.permission_templates(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (template_id, action_key)
);

-- Enable RLS on template tables
ALTER TABLE public.permission_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_template_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_template_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permission_templates
CREATE POLICY "Admin can manage permission templates"
ON public.permission_templates
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for permission_template_modules
CREATE POLICY "Admin can manage template modules"
ON public.permission_template_modules
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for permission_template_actions
CREATE POLICY "Admin can manage template actions"
ON public.permission_template_actions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Update trigger for permission_templates
CREATE TRIGGER update_permission_templates_updated_at
  BEFORE UPDATE ON public.permission_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PART C: PROCUREMENT MODULE TABLES
-- =====================================================

-- TABLE: suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text NULL,
  email text NULL,
  phone text NULL,
  country text NULL,
  category text CHECK (category IN ('materials', 'services', 'both')) DEFAULT 'materials',
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TABLE: purchase_requests
CREATE TABLE IF NOT EXISTS public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('material', 'service')),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  vessel_or_job text NULL,
  description text NOT NULL,
  qty numeric NULL,
  uom text NULL,
  scope_of_work text NULL,
  pricing_model text CHECK (pricing_model IN ('lump_sum', 'unit_rate', 'day_rate')),
  priority text CHECK (priority IN ('normal', 'urgent')) DEFAULT 'normal',
  needed_by date NULL,
  status text NOT NULL CHECK (status IN (
    'draft', 'submitted', 'approved', 'rejected',
    'rfq_sent', 'offers_received', 'awarded',
    'po_issued', 'closed', 'cancelled'
  )) DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create sequence for PR numbers
CREATE SEQUENCE IF NOT EXISTS public.pr_number_seq START 1;

-- Function to generate PR number
CREATE OR REPLACE FUNCTION public.generate_pr_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  SELECT nextval('public.pr_number_seq') INTO next_seq;
  NEW.pr_number := 'PR-' || LPAD(next_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

-- Trigger for auto-generating PR number
DROP TRIGGER IF EXISTS generate_pr_number_trigger ON public.purchase_requests;
CREATE TRIGGER generate_pr_number_trigger
  BEFORE INSERT ON public.purchase_requests
  FOR EACH ROW
  WHEN (NEW.pr_number IS NULL OR NEW.pr_number = '')
  EXECUTE FUNCTION public.generate_pr_number();

-- TABLE: pr_attachments
CREATE TABLE IF NOT EXISTS public.pr_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  filename text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TABLE: rfqs
CREATE TABLE IF NOT EXISTS public.rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number text UNIQUE NOT NULL,
  pr_id uuid NOT NULL REFERENCES public.purchase_requests(id),
  deadline date NULL,
  status text NOT NULL CHECK (status IN ('draft', 'sent', 'partially_received', 'received', 'closed')) DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create sequence for RFQ numbers
CREATE SEQUENCE IF NOT EXISTS public.rfq_number_seq START 1;

-- Function to generate RFQ number
CREATE OR REPLACE FUNCTION public.generate_rfq_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  SELECT nextval('public.rfq_number_seq') INTO next_seq;
  NEW.rfq_number := 'RFQ-' || LPAD(next_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

-- Trigger for auto-generating RFQ number
DROP TRIGGER IF EXISTS generate_rfq_number_trigger ON public.rfqs;
CREATE TRIGGER generate_rfq_number_trigger
  BEFORE INSERT ON public.rfqs
  FOR EACH ROW
  WHEN (NEW.rfq_number IS NULL OR NEW.rfq_number = '')
  EXECUTE FUNCTION public.generate_rfq_number();

-- TABLE: rfq_suppliers
CREATE TABLE IF NOT EXISTS public.rfq_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  status text CHECK (status IN ('sent', 'offer_received')) DEFAULT 'sent'
);

-- TABLE: offers
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  price numeric NULL,
  lead_time text NULL,
  validity_date date NULL,
  notes text NULL,
  is_winner boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TABLE: purchase_orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  pr_id uuid NOT NULL REFERENCES public.purchase_requests(id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  status text NOT NULL CHECK (status IN (
    'draft', 'issued', 'partially_received', 'received', 'closed', 'cancelled'
  )) DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create sequence for PO numbers
CREATE SEQUENCE IF NOT EXISTS public.po_number_seq START 1;

-- Function to generate PO number
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  SELECT nextval('public.po_number_seq') INTO next_seq;
  NEW.po_number := 'PO-' || LPAD(next_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

-- Trigger for auto-generating PO number
DROP TRIGGER IF EXISTS generate_po_number_trigger ON public.purchase_orders;
CREATE TRIGGER generate_po_number_trigger
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL OR NEW.po_number = '')
  EXECUTE FUNCTION public.generate_po_number();

-- TABLE: po_lines
CREATE TABLE IF NOT EXISTS public.po_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  qty numeric NULL,
  uom text NULL
);

-- TABLE: receiving
CREATE TABLE IF NOT EXISTS public.receiving (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_line_id uuid NOT NULL REFERENCES public.po_lines(id),
  received_qty numeric NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid NOT NULL REFERENCES auth.users(id),
  notes text NULL
);

-- TABLE: service_acceptance
CREATE TABLE IF NOT EXISTS public.service_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  accepted boolean DEFAULT false,
  accepted_at timestamptz NULL,
  notes text NULL
);

-- =====================================================
-- RLS POLICIES FOR PROCUREMENT (ADMIN ONLY)
-- =====================================================

-- Enable RLS on all procurement tables
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_acceptance ENABLE ROW LEVEL SECURITY;

-- Suppliers policies (Admin only)
CREATE POLICY "Admin can manage suppliers" ON public.suppliers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Purchase requests policies (Admin only)
CREATE POLICY "Admin can manage purchase requests" ON public.purchase_requests FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- PR attachments policies (Admin only)
CREATE POLICY "Admin can manage pr attachments" ON public.pr_attachments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RFQs policies (Admin only)
CREATE POLICY "Admin can manage rfqs" ON public.rfqs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RFQ suppliers policies (Admin only)
CREATE POLICY "Admin can manage rfq suppliers" ON public.rfq_suppliers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Offers policies (Admin only)
CREATE POLICY "Admin can manage offers" ON public.offers FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Purchase orders policies (Admin only)
CREATE POLICY "Admin can manage purchase orders" ON public.purchase_orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- PO lines policies (Admin only)
CREATE POLICY "Admin can manage po lines" ON public.po_lines FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Receiving policies (Admin only)
CREATE POLICY "Admin can manage receiving" ON public.receiving FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Service acceptance policies (Admin only)
CREATE POLICY "Admin can manage service acceptance" ON public.service_acceptance FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- STORAGE BUCKET FOR PR ATTACHMENTS
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('pr-attachments', 'pr-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pr-attachments (Admin only)
CREATE POLICY "Admin can upload pr attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pr-attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can view pr attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'pr-attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete pr attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'pr-attachments' AND public.has_role(auth.uid(), 'admin'));
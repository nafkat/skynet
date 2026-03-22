
-- Drop unused procurement tables and related objects
-- Order: child tables first to respect foreign keys

DROP TABLE IF EXISTS public.receiving CASCADE;
DROP TABLE IF EXISTS public.po_lines CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.offers CASCADE;
DROP TABLE IF EXISTS public.rfq_attachments CASCADE;
DROP TABLE IF EXISTS public.rfq_suppliers CASCADE;
DROP TABLE IF EXISTS public.rfqs CASCADE;
DROP TABLE IF EXISTS public.pr_attachments CASCADE;
DROP TABLE IF EXISTS public.purchase_requests CASCADE;
DROP TABLE IF EXISTS public.service_acceptance CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS public.pr_number_seq CASCADE;
DROP SEQUENCE IF EXISTS public.rfq_number_seq CASCADE;
DROP SEQUENCE IF EXISTS public.po_number_seq CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.generate_pr_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_rfq_number() CASCADE;
DROP FUNCTION IF EXISTS public.generate_po_number() CASCADE;


ALTER TABLE public.request_offers 
DROP CONSTRAINT IF EXISTS request_offers_status_check;

ALTER TABLE public.request_offers
ADD CONSTRAINT request_offers_status_check 
CHECK (status IN ('draft', 'sent', 'closed', 'reopened'));

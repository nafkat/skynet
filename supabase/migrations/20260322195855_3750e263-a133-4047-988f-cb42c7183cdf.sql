ALTER TABLE public.request_offers
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS response_deadline date,
ADD COLUMN IF NOT EXISTS needed_by date,
ADD COLUMN IF NOT EXISTS delivery_location text,
ADD COLUMN IF NOT EXISTS contact_person text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS special_instructions text;
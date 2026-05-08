ALTER TABLE public.suppliers ADD COLUMN trade_name TEXT NOT NULL DEFAULT '';
UPDATE public.suppliers SET trade_name = name WHERE trade_name = '';
ALTER TABLE public.suppliers ALTER COLUMN trade_name DROP DEFAULT;
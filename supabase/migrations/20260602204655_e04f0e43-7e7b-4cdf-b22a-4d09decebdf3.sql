ALTER TABLE public.employees
  ALTER COLUMN regular_hourly_rate TYPE numeric(10,3),
  ALTER COLUMN overtime_hourly_rate TYPE numeric(10,3);
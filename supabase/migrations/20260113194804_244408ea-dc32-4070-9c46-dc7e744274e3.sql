-- Add regular_rate_all_in column to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS regular_rate_all_in NUMERIC NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.employees.regular_rate_all_in IS 'Regular all-in hourly rate (€/hr) including all costs';

-- Create function to validate employee pay rates before time entry
CREATE OR REPLACE FUNCTION public.check_employee_pay_rates()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = NEW.employee_id
      AND (
        e.regular_hourly_rate IS NULL OR e.regular_hourly_rate <= 0
        OR e.regular_rate_all_in IS NULL OR e.regular_rate_all_in <= 0
        OR e.overtime_hourly_rate IS NULL OR e.overtime_hourly_rate <= 0
      )
  ) THEN
    RAISE EXCEPTION 'Time entry blocked: employee pay rates (Regular / Regular All-in / Overtime) are incomplete.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_check_employee_pay_rates ON public.time_entries;

CREATE TRIGGER trg_check_employee_pay_rates
BEFORE INSERT OR UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.check_employee_pay_rates();
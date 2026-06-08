ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS weekend_overtime BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.calculate_time_entry_durations()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  emp_regular_start TIME;
  emp_regular_end TIME;
  emp_weekend_overtime BOOLEAN;
  entry_start TIMESTAMP;
  entry_end TIMESTAMP;
  reg_start TIMESTAMP;
  reg_end TIMESTAMP;
  total_mins INTEGER;
  regular_mins INTEGER := 0;
  day_of_week INTEGER;
BEGIN
  SELECT regular_start_time, regular_end_time, weekend_overtime
  INTO emp_regular_start, emp_regular_end, emp_weekend_overtime
  FROM public.employees
  WHERE id = NEW.employee_id;

  IF NEW.end_time < NEW.start_time THEN
    total_mins := EXTRACT(EPOCH FROM (NEW.end_time + INTERVAL '24 hours' - NEW.start_time)) / 60;
  ELSE
    total_mins := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
  END IF;

  day_of_week := EXTRACT(DOW FROM NEW.entry_date);

  IF emp_weekend_overtime = true AND day_of_week IN (0, 6) THEN
    regular_mins := 0;
  ELSE
    entry_start := NEW.entry_date + NEW.start_time;
    IF NEW.end_time < NEW.start_time THEN
      entry_end := (NEW.entry_date + INTERVAL '1 day') + NEW.end_time;
    ELSE
      entry_end := NEW.entry_date + NEW.end_time;
    END IF;
    reg_start := NEW.entry_date + emp_regular_start;
    reg_end := NEW.entry_date + emp_regular_end;
    IF entry_end > reg_start AND entry_start < reg_end THEN
      regular_mins := EXTRACT(EPOCH FROM (
        LEAST(entry_end, reg_end) - GREATEST(entry_start, reg_start)
      )) / 60;
      IF regular_mins < 0 THEN
        regular_mins := 0;
      END IF;
    END IF;
  END IF;

  NEW.duration_minutes := total_mins;
  NEW.regular_minutes := regular_mins;
  NEW.overtime_minutes := total_mins - regular_mins;

  RETURN NEW;
END;
$$;
-- PART A: Add assigned_user_id column to employees table
-- This column references the user who is responsible for recording time entries for this employee

ALTER TABLE public.employees
ADD COLUMN assigned_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create an index for faster lookups
CREATE INDEX idx_employees_assigned_user_id ON public.employees(assigned_user_id);

-- PART B: Create trigger function to prevent overlapping time entries
-- Overlap = same employee, same date, new_start < existing_end AND new_end > existing_start
-- Adjacent entries (start == end or end == start) are ALLOWED

CREATE OR REPLACE FUNCTION public.prevent_overlapping_time_entries()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip check if entry is being soft-deleted
  IF NEW.is_deleted = true THEN
    RETURN NEW;
  END IF;

  -- Check for overlapping entries
  IF EXISTS (
    SELECT 1
    FROM public.time_entries te
    WHERE te.employee_id = NEW.employee_id
      AND te.entry_date = NEW.entry_date
      AND te.is_deleted = false
      AND te.id != NEW.id  -- Exclude current row on UPDATE
      AND NEW.start_time < te.end_time
      AND NEW.end_time > te.start_time
  ) THEN
    RAISE EXCEPTION 'Overlap detected: employee already has a time entry during this period.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER check_time_entry_overlap
BEFORE INSERT OR UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.prevent_overlapping_time_entries();

-- PART A (continued): Create function to check if timekeeper can access employee
CREATE OR REPLACE FUNCTION public.can_access_employee(_user_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Elevated roles can access all employees
    public.has_elevated_role(_user_id)
    OR
    -- Timekeeper can only access assigned employees
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = _employee_id
        AND e.assigned_user_id = _user_id
    )
$$;

-- Update RLS policy for employees table - Timekeeper sees only assigned employees
DROP POLICY IF EXISTS "Timekeeper can view limited employee data" ON public.employees;

CREATE POLICY "Timekeeper can view assigned employees only"
ON public.employees
FOR SELECT
USING (
  has_role(auth.uid(), 'timekeeper'::app_role)
  AND NOT has_elevated_role(auth.uid())
  AND assigned_user_id = auth.uid()
);

-- Update time_entries RLS policies - Timekeeper can only create entries for assigned employees
DROP POLICY IF EXISTS "Authenticated users can insert time entries" ON public.time_entries;

CREATE POLICY "Users can insert time entries for accessible employees"
ON public.time_entries
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND public.can_access_employee(auth.uid(), employee_id)
);

-- Add policy for Timekeeper update - must be for assigned employees
DROP POLICY IF EXISTS "Creator can update own entries within 24h" ON public.time_entries;

CREATE POLICY "Creator can update own entries within 24h for accessible employees"
ON public.time_entries
FOR UPDATE
USING (
  auth.uid() = created_by
  AND created_at > (now() - '24:00:00'::interval)
  AND public.can_access_employee(auth.uid(), employee_id)
);
-- Add soft delete columns to time_entries
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS deleted_by uuid NULL,
ADD COLUMN IF NOT EXISTS delete_reason text NULL;

-- Add request_type column to correction_requests (EDIT or DELETE)
ALTER TABLE public.correction_requests 
ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'EDIT';

-- Add constraint to enforce valid request_type values
ALTER TABLE public.correction_requests
ADD CONSTRAINT correction_requests_request_type_check 
CHECK (request_type IN ('EDIT', 'DELETE'));

-- Create function to check if date is today in Europe/Athens timezone
CREATE OR REPLACE FUNCTION public.is_today_athens(_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _date = (now() AT TIME ZONE 'Europe/Athens')::date
$$;

-- Create trigger function to enforce same-day delete rule for timekeepers
CREATE OR REPLACE FUNCTION public.enforce_timekeeper_delete_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only check when is_deleted is being set to true
  IF NEW.is_deleted = true AND (OLD.is_deleted = false OR OLD.is_deleted IS NULL) THEN
    -- If user has elevated role (admin or hr), allow delete anytime
    IF public.has_elevated_role(auth.uid()) THEN
      RETURN NEW;
    END IF;
    
    -- For timekeepers, only allow delete if entry_date is today (Europe/Athens)
    IF NOT public.is_today_athens(OLD.entry_date) THEN
      RAISE EXCEPTION 'Timekeepers can only delete entries from today (Europe/Athens timezone). For older entries, please submit a deletion request.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for delete enforcement
DROP TRIGGER IF EXISTS enforce_timekeeper_delete_trigger ON public.time_entries;
CREATE TRIGGER enforce_timekeeper_delete_trigger
BEFORE UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_timekeeper_delete_rule();

-- Create index for faster queries on non-deleted entries
CREATE INDEX IF NOT EXISTS idx_time_entries_is_deleted ON public.time_entries(is_deleted) WHERE is_deleted = false;
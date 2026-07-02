CREATE OR REPLACE FUNCTION public.prevent_admin_recorder_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow cascading cleanup when the employee itself is being deleted.
  -- This keeps the "admins are always assigned" rule for normal recorder edits,
  -- but prevents it from blocking employee deletion.
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE id = OLD.employee_id
  ) THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = OLD.user_id AND role = 'admin'::app_role
  ) THEN
    RAISE EXCEPTION 'Cannot remove an admin from employee recorders. Admins are always assigned.';
  END IF;

  RETURN OLD;
END;
$$;
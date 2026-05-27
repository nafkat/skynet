
-- 1) Block deletion of admin recorder rows
CREATE OR REPLACE FUNCTION public.prevent_admin_recorder_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = OLD.user_id AND role = 'admin'::app_role
  ) THEN
    RAISE EXCEPTION 'Cannot remove an admin from employee recorders. Admins are always assigned.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_admin_recorder_removal ON public.employee_recorders;
CREATE TRIGGER trg_prevent_admin_recorder_removal
  BEFORE DELETE ON public.employee_recorders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_recorder_removal();

-- 2) Auto-assign all admins when a new employee is created
CREATE OR REPLACE FUNCTION public.auto_assign_admin_recorders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.employee_recorders (employee_id, user_id)
  SELECT NEW.id, ur.user_id
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::app_role
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_admin_recorders ON public.employees;
CREATE TRIGGER trg_auto_assign_admin_recorders
  AFTER INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_admin_recorders();

-- 3) Backfill: ensure every existing employee has all admins assigned
INSERT INTO public.employee_recorders (employee_id, user_id)
SELECT e.id, ur.user_id
FROM public.employees e
CROSS JOIN public.user_roles ur
WHERE ur.role = 'admin'::app_role
ON CONFLICT DO NOTHING;

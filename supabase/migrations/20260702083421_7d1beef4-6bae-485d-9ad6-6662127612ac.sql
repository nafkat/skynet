CREATE OR REPLACE FUNCTION public.audit_employees()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_action_type TEXT;
  v_actor_user_id UUID;
  v_details JSONB;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (action_type, actor_user_id, employee_id, details)
    VALUES ('EMPLOYEE_CREATE', v_actor_user_id, NEW.id,
      jsonb_build_object('employee_code', NEW.employee_code, 'first_name', NEW.first_name, 'last_name', NEW.last_name, 'specialty_id', NEW.specialty_id, 'status', NEW.status));

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.audit_logs (action_type, actor_user_id, employee_id, details)
      VALUES ('EMPLOYEE_STATUS_CHANGE', v_actor_user_id, NEW.id,
        jsonb_build_object('employee_code', NEW.employee_code, 'old_status', OLD.status, 'new_status', NEW.status));
    END IF;
    IF OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id THEN
      INSERT INTO public.audit_logs (action_type, actor_user_id, employee_id, details)
      VALUES ('EMPLOYEE_ASSIGN_RECORDER', v_actor_user_id, NEW.id,
        jsonb_build_object('employee_code', NEW.employee_code, 'old_assigned_user_id', OLD.assigned_user_id, 'new_assigned_user_id', NEW.assigned_user_id));
    END IF;
    IF OLD.first_name IS DISTINCT FROM NEW.first_name OR OLD.last_name IS DISTINCT FROM NEW.last_name OR OLD.specialty_id IS DISTINCT FROM NEW.specialty_id OR OLD.regular_hourly_rate IS DISTINCT FROM NEW.regular_hourly_rate OR OLD.overtime_hourly_rate IS DISTINCT FROM NEW.overtime_hourly_rate OR OLD.regular_rate_all_in IS DISTINCT FROM NEW.regular_rate_all_in OR OLD.regular_start_time IS DISTINCT FROM NEW.regular_start_time OR OLD.regular_end_time IS DISTINCT FROM NEW.regular_end_time OR OLD.hire_date IS DISTINCT FROM NEW.hire_date OR OLD.phone IS DISTINCT FROM NEW.phone OR OLD.afm IS DISTINCT FROM NEW.afm OR OLD.id_type IS DISTINCT FROM NEW.id_type OR OLD.id_number IS DISTINCT FROM NEW.id_number OR OLD.bank_name IS DISTINCT FROM NEW.bank_name OR OLD.iban IS DISTINCT FROM NEW.iban THEN
      INSERT INTO public.audit_logs (action_type, actor_user_id, employee_id, details)
      VALUES ('EMPLOYEE_EDIT', v_actor_user_id, NEW.id,
        jsonb_build_object('employee_code', NEW.employee_code, 'changes', 'multiple fields changed'));
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    -- Employee row is gone by AFTER DELETE; do NOT set employee_id (FK would fail).
    INSERT INTO public.audit_logs (action_type, actor_user_id, employee_id, details)
    VALUES ('EMPLOYEE_EDIT', v_actor_user_id, NULL,
      jsonb_build_object('employee_code', OLD.employee_code, 'employee_id', OLD.id, 'first_name', OLD.first_name, 'last_name', OLD.last_name, 'action', 'deleted'));
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;
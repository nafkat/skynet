-- =============================================
-- AUDIT LOGGING TRIGGERS FOR TIME ENTRIES AND EMPLOYEES
-- =============================================

-- Update audit_logs table to remove the invalid CHECK constraint and add new action types support
-- The existing check constraint may be too restrictive, let's drop and recreate with expanded types

-- First, drop the existing constraint if it exists
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;

-- Add a more comprehensive check constraint for all action types
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_type_check 
CHECK (action_type IN (
  -- Time Entry actions
  'TIME_ENTRY_CREATE',
  'TIME_ENTRY_EDIT', 
  'TIME_ENTRY_DELETE',
  'TIME_ENTRY_DELETE_REQUEST',
  'TIME_ENTRY_APPROVE',
  'TIME_ENTRY_REJECT',
  -- Employee actions
  'EMPLOYEE_CREATE',
  'EMPLOYEE_EDIT',
  'EMPLOYEE_STATUS_CHANGE',
  'EMPLOYEE_ASSIGN_RECORDER',
  -- Legacy action types (for backward compatibility)
  'CREATE_ENTRY',
  'EDIT_ENTRY',
  'DELETE_ENTRY',
  'DELETE_REQUEST',
  'APPROVE',
  'REJECT'
));

-- =============================================
-- TIME ENTRIES AUDIT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.audit_time_entries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action_type TEXT;
  v_actor_user_id UUID;
  v_details JSONB;
BEGIN
  -- Get the actor (current user)
  v_actor_user_id := auth.uid();
  
  -- Skip if no authenticated user (shouldn't happen with RLS)
  IF v_actor_user_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'TIME_ENTRY_CREATE';
    v_details := jsonb_build_object(
      'entry_date', NEW.entry_date,
      'start_time', NEW.start_time::TEXT,
      'end_time', NEW.end_time::TEXT,
      'duration_minutes', NEW.duration_minutes,
      'regular_minutes', NEW.regular_minutes,
      'overtime_minutes', NEW.overtime_minutes
    );
    
    INSERT INTO public.audit_logs (
      action_type, actor_user_id, employee_id, project_id, time_entry_id, details
    ) VALUES (
      v_action_type, v_actor_user_id, NEW.employee_id, NEW.project_id, NEW.id, v_details
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if this is a soft delete
    IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
      v_action_type := 'TIME_ENTRY_DELETE';
      v_details := jsonb_build_object(
        'entry_date', OLD.entry_date,
        'start_time', OLD.start_time::TEXT,
        'end_time', OLD.end_time::TEXT,
        'delete_reason', NEW.delete_reason
      );
    ELSE
      -- Regular edit
      v_action_type := 'TIME_ENTRY_EDIT';
      v_details := jsonb_build_object(
        'old_entry_date', OLD.entry_date,
        'old_start_time', OLD.start_time::TEXT,
        'old_end_time', OLD.end_time::TEXT,
        'new_entry_date', NEW.entry_date,
        'new_start_time', NEW.start_time::TEXT,
        'new_end_time', NEW.end_time::TEXT,
        'old_project_id', OLD.project_id,
        'new_project_id', NEW.project_id
      );
    END IF;
    
    INSERT INTO public.audit_logs (
      action_type, actor_user_id, employee_id, project_id, time_entry_id, details
    ) VALUES (
      v_action_type, v_actor_user_id, NEW.employee_id, NEW.project_id, NEW.id, v_details
    );
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'TIME_ENTRY_DELETE';
    v_details := jsonb_build_object(
      'entry_date', OLD.entry_date,
      'start_time', OLD.start_time::TEXT,
      'end_time', OLD.end_time::TEXT,
      'hard_delete', true
    );
    
    INSERT INTO public.audit_logs (
      action_type, actor_user_id, employee_id, project_id, time_entry_id, details
    ) VALUES (
      v_action_type, v_actor_user_id, OLD.employee_id, OLD.project_id, OLD.id, v_details
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for time_entries
DROP TRIGGER IF EXISTS trigger_audit_time_entries ON public.time_entries;
CREATE TRIGGER trigger_audit_time_entries
AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.audit_time_entries();

-- =============================================
-- EMPLOYEES AUDIT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.audit_employees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action_type TEXT;
  v_actor_user_id UUID;
  v_details JSONB;
BEGIN
  -- Get the actor (current user)
  v_actor_user_id := auth.uid();
  
  -- Skip if no authenticated user
  IF v_actor_user_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'EMPLOYEE_CREATE';
    v_details := jsonb_build_object(
      'employee_code', NEW.employee_code,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name,
      'specialty_id', NEW.specialty_id,
      'status', NEW.status
    );
    
    INSERT INTO public.audit_logs (
      action_type, actor_user_id, employee_id, details
    ) VALUES (
      v_action_type, v_actor_user_id, NEW.id, v_details
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if status changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action_type := 'EMPLOYEE_STATUS_CHANGE';
      v_details := jsonb_build_object(
        'employee_code', NEW.employee_code,
        'old_status', OLD.status,
        'new_status', NEW.status
      );
      
      INSERT INTO public.audit_logs (
        action_type, actor_user_id, employee_id, details
      ) VALUES (
        v_action_type, v_actor_user_id, NEW.id, v_details
      );
    END IF;
    
    -- Check if assigned_user_id changed
    IF OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id THEN
      v_action_type := 'EMPLOYEE_ASSIGN_RECORDER';
      v_details := jsonb_build_object(
        'employee_code', NEW.employee_code,
        'old_assigned_user_id', OLD.assigned_user_id,
        'new_assigned_user_id', NEW.assigned_user_id
      );
      
      INSERT INTO public.audit_logs (
        action_type, actor_user_id, employee_id, details
      ) VALUES (
        v_action_type, v_actor_user_id, NEW.id, v_details
      );
    END IF;
    
    -- General edit (if any other field changed and it's not just status/assignment)
    IF OLD.first_name IS DISTINCT FROM NEW.first_name OR
       OLD.last_name IS DISTINCT FROM NEW.last_name OR
       OLD.specialty_id IS DISTINCT FROM NEW.specialty_id OR
       OLD.regular_hourly_rate IS DISTINCT FROM NEW.regular_hourly_rate OR
       OLD.overtime_hourly_rate IS DISTINCT FROM NEW.overtime_hourly_rate OR
       OLD.regular_rate_all_in IS DISTINCT FROM NEW.regular_rate_all_in OR
       OLD.regular_start_time IS DISTINCT FROM NEW.regular_start_time OR
       OLD.regular_end_time IS DISTINCT FROM NEW.regular_end_time OR
       OLD.hire_date IS DISTINCT FROM NEW.hire_date OR
       OLD.phone IS DISTINCT FROM NEW.phone OR
       OLD.afm IS DISTINCT FROM NEW.afm OR
       OLD.id_type IS DISTINCT FROM NEW.id_type OR
       OLD.id_number IS DISTINCT FROM NEW.id_number OR
       OLD.bank_name IS DISTINCT FROM NEW.bank_name OR
       OLD.iban IS DISTINCT FROM NEW.iban THEN
      
      v_action_type := 'EMPLOYEE_EDIT';
      v_details := jsonb_build_object(
        'employee_code', NEW.employee_code,
        'changes', jsonb_build_object(
          'first_name', CASE WHEN OLD.first_name IS DISTINCT FROM NEW.first_name THEN jsonb_build_object('old', OLD.first_name, 'new', NEW.first_name) ELSE NULL END,
          'last_name', CASE WHEN OLD.last_name IS DISTINCT FROM NEW.last_name THEN jsonb_build_object('old', OLD.last_name, 'new', NEW.last_name) ELSE NULL END,
          'specialty_id', CASE WHEN OLD.specialty_id IS DISTINCT FROM NEW.specialty_id THEN jsonb_build_object('old', OLD.specialty_id, 'new', NEW.specialty_id) ELSE NULL END,
          'regular_hourly_rate', CASE WHEN OLD.regular_hourly_rate IS DISTINCT FROM NEW.regular_hourly_rate THEN jsonb_build_object('old', OLD.regular_hourly_rate, 'new', NEW.regular_hourly_rate) ELSE NULL END,
          'overtime_hourly_rate', CASE WHEN OLD.overtime_hourly_rate IS DISTINCT FROM NEW.overtime_hourly_rate THEN jsonb_build_object('old', OLD.overtime_hourly_rate, 'new', NEW.overtime_hourly_rate) ELSE NULL END
        )
      );
      
      INSERT INTO public.audit_logs (
        action_type, actor_user_id, employee_id, details
      ) VALUES (
        v_action_type, v_actor_user_id, NEW.id, v_details
      );
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Employee delete is rare but should be logged
    v_action_type := 'EMPLOYEE_EDIT';
    v_details := jsonb_build_object(
      'employee_code', OLD.employee_code,
      'first_name', OLD.first_name,
      'last_name', OLD.last_name,
      'action', 'deleted'
    );
    
    INSERT INTO public.audit_logs (
      action_type, actor_user_id, employee_id, details
    ) VALUES (
      v_action_type, v_actor_user_id, OLD.id, v_details
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for employees
DROP TRIGGER IF EXISTS trigger_audit_employees ON public.employees;
CREATE TRIGGER trigger_audit_employees
AFTER INSERT OR UPDATE OR DELETE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.audit_employees();

-- =============================================
-- CORRECTION REQUESTS AUDIT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.audit_correction_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action_type TEXT;
  v_actor_user_id UUID;
  v_details JSONB;
  v_employee_id UUID;
  v_project_id UUID;
BEGIN
  -- Get the actor (current user)
  v_actor_user_id := auth.uid();
  
  -- Skip if no authenticated user
  IF v_actor_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get related time entry info
  SELECT employee_id, project_id INTO v_employee_id, v_project_id
  FROM public.time_entries
  WHERE id = NEW.time_entry_id;
  
  IF TG_OP = 'INSERT' THEN
    -- New correction request created
    IF NEW.request_type = 'DELETE' THEN
      v_action_type := 'TIME_ENTRY_DELETE_REQUEST';
    ELSE
      v_action_type := 'TIME_ENTRY_DELETE_REQUEST'; -- Could differentiate edit requests
    END IF;
    
    v_details := jsonb_build_object(
      'request_type', NEW.request_type,
      'request_reason', NEW.request_reason,
      'new_entry_date', NEW.new_entry_date,
      'new_start_time', NEW.new_start_time::TEXT,
      'new_end_time', NEW.new_end_time::TEXT
    );
    
    INSERT INTO public.audit_logs (
      action_type, actor_user_id, employee_id, project_id, time_entry_id, correction_request_id, details
    ) VALUES (
      v_action_type, v_actor_user_id, v_employee_id, v_project_id, NEW.time_entry_id, NEW.id, v_details
    );
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if status changed (approval/rejection)
    IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
      v_action_type := 'TIME_ENTRY_APPROVE';
      v_details := jsonb_build_object(
        'request_type', NEW.request_type,
        'review_notes', NEW.review_notes
      );
      
      INSERT INTO public.audit_logs (
        action_type, actor_user_id, employee_id, project_id, time_entry_id, correction_request_id, details
      ) VALUES (
        v_action_type, v_actor_user_id, v_employee_id, v_project_id, NEW.time_entry_id, NEW.id, v_details
      );
      
    ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
      v_action_type := 'TIME_ENTRY_REJECT';
      v_details := jsonb_build_object(
        'request_type', NEW.request_type,
        'review_notes', NEW.review_notes
      );
      
      INSERT INTO public.audit_logs (
        action_type, actor_user_id, employee_id, project_id, time_entry_id, correction_request_id, details
      ) VALUES (
        v_action_type, v_actor_user_id, v_employee_id, v_project_id, NEW.time_entry_id, NEW.id, v_details
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for correction_requests
DROP TRIGGER IF EXISTS trigger_audit_correction_requests ON public.correction_requests;
CREATE TRIGGER trigger_audit_correction_requests
AFTER INSERT OR UPDATE ON public.correction_requests
FOR EACH ROW
EXECUTE FUNCTION public.audit_correction_requests();
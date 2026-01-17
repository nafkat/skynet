-- Create audit_logs table for tracking all system actions
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  actor_user_id uuid NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  time_entry_id uuid REFERENCES public.time_entries(id) ON DELETE SET NULL,
  correction_request_id uuid REFERENCES public.correction_requests(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient date-based queries (Europe/Athens timezone)
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX idx_audit_logs_actor_user_id ON public.audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_employee_id ON public.audit_logs(employee_id);
CREATE INDEX idx_audit_logs_project_id ON public.audit_logs(project_id);

-- Add constraint for valid action types
ALTER TABLE public.audit_logs
ADD CONSTRAINT audit_logs_action_type_check 
CHECK (action_type IN ('CREATE_ENTRY', 'EDIT_ENTRY', 'DELETE_ENTRY', 'DELETE_REQUEST', 'APPROVE', 'REJECT'));

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only Admin and HR can view audit logs
CREATE POLICY "Elevated roles can view audit logs"
ON public.audit_logs
FOR SELECT
USING (public.has_elevated_role(auth.uid()));

-- Any authenticated user can insert audit logs (system records actions)
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- No updates or deletes allowed on audit logs (immutable)
-- (No policies = no access for UPDATE/DELETE)
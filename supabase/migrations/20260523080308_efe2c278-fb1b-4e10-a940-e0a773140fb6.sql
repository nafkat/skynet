
-- 1. audit_logs: restrict INSERT to elevated roles + actor must be self
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Elevated roles can insert their own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_elevated_role(auth.uid())
  AND actor_user_id = auth.uid()
);

-- 2. employee_allowed_projects: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view employee allowed projects" ON public.employee_allowed_projects;
CREATE POLICY "Users can view relevant employee allowed projects"
ON public.employee_allowed_projects
FOR SELECT
TO authenticated
USING (
  public.has_elevated_role(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = employee_allowed_projects.employee_id
      AND e.assigned_user_id = auth.uid()
  )
);

-- 3. employee-attachments storage bucket: restrict INSERT/UPDATE/DELETE to elevated roles
DROP POLICY IF EXISTS "Service role can upload employee attachments" ON storage.objects;
CREATE POLICY "Elevated roles can upload employee attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'employee-attachments'
  AND public.has_elevated_role(auth.uid())
);

CREATE POLICY "Elevated roles can update employee attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'employee-attachments'
  AND public.has_elevated_role(auth.uid())
)
WITH CHECK (
  bucket_id = 'employee-attachments'
  AND public.has_elevated_role(auth.uid())
);

CREATE POLICY "Elevated roles can delete employee attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'employee-attachments'
  AND public.has_elevated_role(auth.uid())
);

-- 4. SECURITY DEFINER functions: revoke from anon/public, restrict admin-only ones
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_elevated_role(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_action_permission(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_module_access(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_user_active(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_today_athens(date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_employee(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_base_role(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_timekeeper_only(uuid) FROM anon, public;

-- Admin / privileged functions: lock down to authenticated only (they self-check admin inside)
REVOKE EXECUTE ON FUNCTION public.get_user_email(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_all_users_with_profiles() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_permission_audit_logs(integer) FROM anon, public;

-- Mutating permission functions: revoke from clients entirely (called server-side / by admins via RPC with internal check)
REVOKE EXECUTE ON FUNCTION public.recompute_user_permissions(uuid) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.initialize_user_permissions(uuid, app_role, uuid) FROM anon, public, authenticated;

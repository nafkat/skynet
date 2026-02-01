-- Drop the old policy
DROP POLICY IF EXISTS "Admin can view permission audit logs" ON public.permission_audit_logs;

-- Create a new policy checking user_roles directly
CREATE POLICY "Admin can view permission audit logs"
ON public.permission_audit_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);
-- Create a function to fetch audit logs (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_permission_audit_logs(
  _limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  actor_user_id uuid,
  target_user_id uuid,
  change_type text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.actor_user_id,
    p.target_user_id,
    p.change_type,
    p.details,
    p.created_at
  FROM permission_audit_logs p
  ORDER BY p.created_at DESC
  LIMIT _limit;
END;
$$;
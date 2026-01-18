-- Drop and recreate the get_all_users_with_profiles function to include last_sign_in_at
-- This is the primary indicator for whether a user has activated their account

DROP FUNCTION IF EXISTS public.get_all_users_with_profiles();

CREATE FUNCTION public.get_all_users_with_profiles()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  display_name text,
  is_active boolean,
  created_at timestamptz,
  role text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id as user_id,
    u.email,
    p.full_name,
    p.display_name,
    COALESCE(p.is_active, true) as is_active,
    p.created_at,
    r.role::text,
    u.email_confirmed_at,
    u.last_sign_in_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.user_roles r ON r.user_id = u.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY u.created_at DESC
$$;
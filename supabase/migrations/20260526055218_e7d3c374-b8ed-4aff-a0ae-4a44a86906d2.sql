-- Fix: Re-grant permission recompute functions to authenticated role
-- These were incorrectly revoked in the previous security migration
-- Both functions are SECURITY DEFINER and check admin role internally before making changes

GRANT EXECUTE ON FUNCTION public.recompute_user_permissions(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.initialize_user_permissions(uuid, public.app_role, uuid) TO authenticated;
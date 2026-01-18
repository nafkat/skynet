-- Step 1: Update the app_role enum to include 'admin' and 'employee' only
-- First drop the old enum values and add new ones
-- Note: We'll use the existing user_roles table structure

-- Step 2: Remove base_role column from profiles (security fix)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS base_role;

-- Step 3: Ensure user_roles table has proper structure with updated enum
-- The existing user_roles table already references auth.users, which is correct

-- Step 4: Update the is_admin function to use user_roles table
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'::app_role
  )
$$;

-- Step 5: Create function to get user's base role from user_roles
CREATE OR REPLACE FUNCTION public.get_user_base_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Step 6: Update nafkat@gmail.com to have admin role in user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'nafkat@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
-- Fix 1: employees table - Ensure only authenticated admin/hr can access
-- Drop and recreate with explicit TO authenticated
DROP POLICY IF EXISTS "Employees viewable by admin and hr" ON public.employees;

CREATE POLICY "Employees viewable by admin and hr"
ON public.employees
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'hr'::app_role)
);

-- Fix 2: profiles table - Ensure only authenticated users can access
-- Drop existing SELECT policies and recreate with proper restrictions
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 3: time_entries table - Restrict to elevated roles or entry creator
DROP POLICY IF EXISTS "Time entries viewable by authenticated" ON public.time_entries;

CREATE POLICY "Time entries viewable by authorized users"
ON public.time_entries
FOR SELECT
TO authenticated
USING (
  has_elevated_role(auth.uid()) OR 
  auth.uid() = created_by
);
-- Fix the security definer view warning by explicitly setting SECURITY INVOKER
-- and adding RLS to restrict what the view can return based on user role

DROP VIEW IF EXISTS public.employees_limited;

-- Create view with SECURITY INVOKER (respects caller's RLS)
CREATE VIEW public.employees_limited
WITH (security_invoker = true)
AS
SELECT 
  id,
  employee_code,
  first_name,
  last_name,
  specialty_id,
  status,
  regular_start_time,
  regular_end_time,
  hire_date,
  phone,
  notes
FROM public.employees;

-- Grant access to the view
GRANT SELECT ON public.employees_limited TO authenticated;
-- Fix RLS for employees_limited view
-- Views inherit RLS from their underlying tables, but we need to ensure proper access control

-- First, drop the existing view
DROP VIEW IF EXISTS public.employees_limited;

-- Recreate the view with SECURITY INVOKER (default) to respect RLS on the underlying employees table
-- The view already only exposes non-sensitive fields (excludes financial data like hourly rates, AFM, IBAN)
CREATE VIEW public.employees_limited
WITH (security_invoker = true)
AS
SELECT 
  id,
  specialty_id,
  status,
  regular_start_time,
  regular_end_time,
  hire_date,
  employee_code,
  first_name,
  last_name,
  phone,
  notes
FROM public.employees;

-- Grant SELECT on the view to authenticated users (access still controlled by underlying table's RLS)
GRANT SELECT ON public.employees_limited TO authenticated;

-- Add a comment explaining the security model
COMMENT ON VIEW public.employees_limited IS 'Limited employee view excluding sensitive financial data. Access is controlled by RLS policies on the underlying employees table via security_invoker setting.';
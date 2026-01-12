-- Add new columns to employees table for HR, payroll, and legal information
ALTER TABLE public.employees
ADD COLUMN phone TEXT,
ADD COLUMN hire_date DATE,
ADD COLUMN notes TEXT,
ADD COLUMN afm TEXT,
ADD COLUMN id_type TEXT,
ADD COLUMN id_number TEXT,
ADD COLUMN iban TEXT,
ADD COLUMN bank_name TEXT;

-- Create junction table for employee allowed projects
CREATE TABLE public.employee_allowed_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, project_id)
);

-- Enable RLS on the junction table
ALTER TABLE public.employee_allowed_projects ENABLE ROW LEVEL SECURITY;

-- RLS policies for employee_allowed_projects
-- SELECT: All authenticated users can view (needed for time entry project filtering)
CREATE POLICY "Authenticated users can view employee allowed projects"
ON public.employee_allowed_projects
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Only Admin can manage project access
CREATE POLICY "Admin can insert employee allowed projects"
ON public.employee_allowed_projects
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- UPDATE: Only Admin can manage project access
CREATE POLICY "Admin can update employee allowed projects"
ON public.employee_allowed_projects
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- DELETE: Only Admin can manage project access
CREATE POLICY "Admin can delete employee allowed projects"
ON public.employee_allowed_projects
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for faster lookups
CREATE INDEX idx_employee_allowed_projects_employee_id ON public.employee_allowed_projects(employee_id);
CREATE INDEX idx_employee_allowed_projects_project_id ON public.employee_allowed_projects(project_id);
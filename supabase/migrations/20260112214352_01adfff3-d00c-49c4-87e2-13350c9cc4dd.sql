-- Add new columns to projects table
ALTER TABLE public.projects
ADD COLUMN customer_company_name TEXT NOT NULL DEFAULT '',
ADD COLUMN customer_company_afm TEXT,
ADD COLUMN assigned_shipyard_company TEXT NOT NULL DEFAULT '';

-- Create sequence for project codes
CREATE SEQUENCE IF NOT EXISTS public.project_code_seq START 1;

-- Create function to auto-generate project code
CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  -- Get next sequence value
  SELECT nextval('public.project_code_seq') INTO next_seq;
  
  -- Set project code
  NEW.project_code := 'PRJ-' || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate project code on insert
CREATE TRIGGER trigger_generate_project_code
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.generate_project_code();

-- Add unique constraint on project_code
ALTER TABLE public.projects
ADD CONSTRAINT projects_project_code_unique UNIQUE (project_code);

-- Update existing projects with sequential codes if any exist without proper format
DO $$
DECLARE
  proj RECORD;
  seq_num INTEGER := 0;
BEGIN
  -- First, set the sequence to be higher than existing count
  SELECT COALESCE(MAX(
    CASE 
      WHEN project_code ~ '^PRJ-[0-9]+$' 
      THEN CAST(SUBSTRING(project_code FROM 5) AS INTEGER)
      ELSE 0 
    END
  ), 0) INTO seq_num FROM public.projects;
  
  -- Reset sequence to continue from highest existing number
  IF seq_num > 0 THEN
    PERFORM setval('public.project_code_seq', seq_num);
  END IF;
END;
$$;
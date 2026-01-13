-- Add new columns to correction_requests for full edit capability
ALTER TABLE public.correction_requests 
ADD COLUMN IF NOT EXISTS new_entry_date date,
ADD COLUMN IF NOT EXISTS new_project_id uuid REFERENCES public.projects(id);

-- Add comment for clarity
COMMENT ON COLUMN public.correction_requests.new_entry_date IS 'Requested new date for the time entry';
COMMENT ON COLUMN public.correction_requests.new_project_id IS 'Requested new project for the time entry';
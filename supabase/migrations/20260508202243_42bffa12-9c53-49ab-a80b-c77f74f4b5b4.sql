ALTER TABLE public.time_entries
ADD COLUMN specialty_id UUID REFERENCES public.specialties(id);

UPDATE public.time_entries te
SET specialty_id = e.specialty_id
FROM public.employees e
WHERE te.employee_id = e.id;
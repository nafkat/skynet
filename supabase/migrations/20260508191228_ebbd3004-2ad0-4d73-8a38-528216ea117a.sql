CREATE TABLE public.employee_recorders (
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, user_id)
);

INSERT INTO public.employee_recorders (employee_id, user_id)
SELECT id, assigned_user_id
FROM public.employees
WHERE assigned_user_id IS NOT NULL;

ALTER TABLE public.employee_recorders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated roles can manage employee_recorders"
ON public.employee_recorders
FOR ALL
TO authenticated
USING (public.has_elevated_role(auth.uid()));

CREATE POLICY "Users can view their own recorder assignments"
ON public.employee_recorders
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
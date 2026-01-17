-- Create viber_link_codes table for employee-to-Viber account linking
CREATE TABLE public.viber_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  used_by_viber_user_id text NULL
);

-- Create indexes
CREATE INDEX idx_viber_link_codes_employee_id ON public.viber_link_codes(employee_id);
CREATE INDEX idx_viber_link_codes_expires_at ON public.viber_link_codes(expires_at);

-- Enable RLS
ALTER TABLE public.viber_link_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for viber_link_codes
CREATE POLICY "Admin and HR can view link codes"
ON public.viber_link_codes FOR SELECT
USING (has_elevated_role(auth.uid()));

CREATE POLICY "Admin and HR can insert link codes"
ON public.viber_link_codes FOR INSERT
WITH CHECK (has_elevated_role(auth.uid()));

CREATE POLICY "Admin and HR can update link codes"
ON public.viber_link_codes FOR UPDATE
USING (has_elevated_role(auth.uid()));

CREATE POLICY "Admin and HR can delete link codes"
ON public.viber_link_codes FOR DELETE
USING (has_elevated_role(auth.uid()));
-- Create table to track which custom roles (permission templates) are assigned to users
CREATE TABLE public.user_permission_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES public.permission_templates(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID,
  UNIQUE(user_id, template_id)
);

-- Enable RLS
ALTER TABLE public.user_permission_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage user template assignments
CREATE POLICY "Admins can manage user template assignments"
ON public.user_permission_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
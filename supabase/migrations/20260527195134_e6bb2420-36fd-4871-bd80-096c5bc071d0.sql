CREATE POLICY "Elevated roles can view all user roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_elevated_role(auth.uid()));
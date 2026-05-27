
-- Allow timekeepers to read locked periods so client can warn before submitting
CREATE POLICY "Timekeepers can view active locked periods"
ON public.locked_periods
FOR SELECT
TO authenticated
USING (is_timekeeper_only(auth.uid()) AND is_active = true);

-- Allow authenticated users to read permission templates (needed for UI)
CREATE POLICY "Authenticated users can view permission templates"
ON public.permission_templates
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Allow users to read their own template assignments
CREATE POLICY "Users can view own template assignments"
ON public.user_permission_templates
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

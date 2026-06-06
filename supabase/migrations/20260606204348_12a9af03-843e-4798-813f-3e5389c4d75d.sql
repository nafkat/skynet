CREATE POLICY "Elevated roles can subscribe to entry_review_flags realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'entry_review_flags%'
  AND public.has_elevated_role(auth.uid())
);
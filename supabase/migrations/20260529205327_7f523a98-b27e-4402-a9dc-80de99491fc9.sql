-- Comments thread for entry review flags
CREATE TABLE public.entry_review_flag_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_id UUID NOT NULL REFERENCES public.entry_review_flags(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.entry_review_flag_comments TO authenticated;
GRANT ALL ON public.entry_review_flag_comments TO service_role;

ALTER TABLE public.entry_review_flag_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated roles can view flag comments"
ON public.entry_review_flag_comments
FOR SELECT
TO authenticated
USING (public.has_elevated_role(auth.uid()));

CREATE POLICY "Elevated roles can insert flag comments"
ON public.entry_review_flag_comments
FOR INSERT
TO authenticated
WITH CHECK (public.has_elevated_role(auth.uid()) AND author_id = auth.uid());

CREATE INDEX idx_entry_review_flag_comments_flag_id
  ON public.entry_review_flag_comments(flag_id, created_at);

CREATE INDEX IF NOT EXISTS idx_entry_review_flags_status_created
  ON public.entry_review_flags(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entry_review_flags_resolved_at
  ON public.entry_review_flags(resolved_at DESC) WHERE status = 'resolved';
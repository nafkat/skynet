-- New table for Admin↔HR review flags on time entries
-- Additive only: no changes to existing tables, columns, or policies

CREATE TABLE public.entry_review_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL,
  raised_by UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'resolved'
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_entry_review_flags_time_entry ON public.entry_review_flags(time_entry_id);
CREATE INDEX idx_entry_review_flags_status ON public.entry_review_flags(status) WHERE status = 'open';
CREATE INDEX idx_entry_review_flags_raised_by ON public.entry_review_flags(raised_by);

-- Grants: only Admin/HR (elevated) use this table; service_role for triggers
GRANT SELECT, INSERT, UPDATE ON public.entry_review_flags TO authenticated;
GRANT ALL ON public.entry_review_flags TO service_role;

-- Enable RLS
ALTER TABLE public.entry_review_flags ENABLE ROW LEVEL SECURITY;

-- Policies: only elevated roles (Admin/HR) can view/create/update flags
CREATE POLICY "Elevated roles can view review flags"
  ON public.entry_review_flags
  FOR SELECT
  TO authenticated
  USING (public.has_elevated_role(auth.uid()));

CREATE POLICY "Elevated roles can create review flags"
  ON public.entry_review_flags
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_elevated_role(auth.uid()) AND raised_by = auth.uid());

CREATE POLICY "Elevated roles can update review flags"
  ON public.entry_review_flags
  FOR UPDATE
  TO authenticated
  USING (public.has_elevated_role(auth.uid()));

-- updated_at trigger
CREATE TRIGGER update_entry_review_flags_updated_at
  BEFORE UPDATE ON public.entry_review_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-resolve trigger: when a time_entry is edited or soft-deleted by an elevated user,
-- close any open flags on that entry with a system note.
CREATE OR REPLACE FUNCTION public.auto_resolve_entry_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_note TEXT;
BEGIN
  v_actor := auth.uid();

  -- Only auto-resolve when the actor is an elevated user (Admin/HR)
  IF v_actor IS NULL OR NOT public.has_elevated_role(v_actor) THEN
    RETURN NEW;
  END IF;

  -- Determine note text based on the change
  IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
    v_note := 'Auto-resolved: entry deleted';
  ELSIF OLD.entry_date IS DISTINCT FROM NEW.entry_date
     OR OLD.start_time IS DISTINCT FROM NEW.start_time
     OR OLD.end_time IS DISTINCT FROM NEW.end_time
     OR OLD.project_id IS DISTINCT FROM NEW.project_id
     OR OLD.specialty_id IS DISTINCT FROM NEW.specialty_id THEN
    v_note := 'Auto-resolved: entry edited';
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.entry_review_flags
  SET status = 'resolved',
      resolved_by = v_actor,
      resolved_at = now(),
      resolution_notes = v_note,
      updated_at = now()
  WHERE time_entry_id = NEW.id
    AND status = 'open';

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_resolve_entry_flags
  AFTER UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_resolve_entry_flags();

-- Enable realtime for bell-icon notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.entry_review_flags;
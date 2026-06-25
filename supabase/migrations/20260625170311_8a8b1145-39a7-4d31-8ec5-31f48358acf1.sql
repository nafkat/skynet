-- Soft delete for cost_reports with 15-day retention
ALTER TABLE public.cost_reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.cost_reports ADD COLUMN IF NOT EXISTS deleted_by UUID;
CREATE INDEX IF NOT EXISTS idx_cost_reports_deleted_at ON public.cost_reports(deleted_at);

-- Function to purge reports soft-deleted more than 15 days ago
CREATE OR REPLACE FUNCTION public.purge_old_deleted_cost_reports()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH del AS (
    DELETE FROM public.cost_reports
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - INTERVAL '15 days'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM del;
  RETURN v_count;
END;
$$;

-- Enable pg_cron + pg_net if not already
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily purge at 03:00 UTC
SELECT cron.unschedule('purge-old-deleted-cost-reports') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-old-deleted-cost-reports');

SELECT cron.schedule(
  'purge-old-deleted-cost-reports',
  '0 3 * * *',
  $$ SELECT public.purge_old_deleted_cost_reports(); $$
);
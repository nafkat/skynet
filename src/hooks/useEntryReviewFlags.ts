import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface EntryReviewFlag {
  id: string;
  time_entry_id: string;
  raised_by: string;
  reason: string;
  status: 'open' | 'resolved';
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches all OPEN review flags + total count, subscribes to realtime changes.
 * Used by both the bell-icon and per-row badges across dashboards/reports.
 */
export function useEntryReviewFlags() {
  const { hasElevatedRole } = useAuth();
  const [flags, setFlags] = useState<EntryReviewFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    if (!hasElevatedRole) {
      setFlags([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('entry_review_flags')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFlags(data as EntryReviewFlag[]);
    }
    setLoading(false);
  }, [hasElevatedRole]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  // Realtime subscription
  useEffect(() => {
    if (!hasElevatedRole) return;

    const channel = supabase
      .channel('entry_review_flags_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entry_review_flags' },
        () => {
          fetchFlags();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasElevatedRole, fetchFlags]);

  // Helper: get open flags for one or many entry IDs
  const getFlagsForEntries = useCallback(
    (entryIds: string[]) => {
      const set = new Set(entryIds);
      return flags.filter((f) => set.has(f.time_entry_id));
    },
    [flags]
  );

  const hasOpenFlags = useCallback(
    (entryIds: string[]) => getFlagsForEntries(entryIds).length > 0,
    [getFlagsForEntries]
  );

  return {
    flags,
    openCount: flags.length,
    loading,
    refetch: fetchFlags,
    getFlagsForEntries,
    hasOpenFlags,
  };
}

/**
 * Raises a review flag for one or many time_entry IDs.
 * Returns count of flags created.
 */
export async function raiseEntryReviewFlag(
  timeEntryIds: string[],
  reason: string,
  raisedBy: string
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!reason.trim() || timeEntryIds.length === 0) {
    return { success: false, count: 0, error: 'Missing reason or entry IDs' };
  }

  const rows = timeEntryIds.map((id) => ({
    time_entry_id: id,
    raised_by: raisedBy,
    reason: reason.trim(),
    status: 'open',
  }));

  const { error, data } = await supabase
    .from('entry_review_flags')
    .insert(rows)
    .select('id');

  if (error) {
    return { success: false, count: 0, error: error.message };
  }
  return { success: true, count: data?.length ?? 0 };
}

/**
 * Manually mark a flag as resolved (alternative to auto-resolve trigger).
 */
export async function resolveEntryReviewFlag(
  flagId: string,
  resolvedBy: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('entry_review_flags')
    .update({
      status: 'resolved',
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes?.trim() || 'Manually resolved',
    })
    .eq('id', flagId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

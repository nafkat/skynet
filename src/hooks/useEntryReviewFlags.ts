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

export interface EntryReviewFlagComment {
  id: string;
  flag_id: string;
  author_id: string;
  comment: string;
  created_at: string;
}

const RESOLVED_WINDOW_HOURS = 72;

/**
 * Fetches OPEN flags + recently RESOLVED flags (last 72h), subscribes to realtime.
 */
export function useEntryReviewFlags() {
  const { hasElevatedRole } = useAuth();
  const [flags, setFlags] = useState<EntryReviewFlag[]>([]);
  const [resolvedRecent, setResolvedRecent] = useState<EntryReviewFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    if (!hasElevatedRole) {
      setFlags([]);
      setResolvedRecent([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const sinceISO = new Date(
      Date.now() - RESOLVED_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    const [openRes, resolvedRes] = await Promise.all([
      supabase
        .from('entry_review_flags')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
      supabase
        .from('entry_review_flags')
        .select('*')
        .eq('status', 'resolved')
        .gte('resolved_at', sinceISO)
        .order('resolved_at', { ascending: false }),
    ]);

    if (!openRes.error && openRes.data) setFlags(openRes.data as EntryReviewFlag[]);
    if (!resolvedRes.error && resolvedRes.data)
      setResolvedRecent(resolvedRes.data as EntryReviewFlag[]);
    setLoading(false);
  }, [hasElevatedRole]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  useEffect(() => {
    if (!hasElevatedRole) return;
    const channel = supabase
      .channel('entry_review_flags_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entry_review_flags' },
        () => fetchFlags()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasElevatedRole, fetchFlags]);

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
    resolvedRecent,
    openCount: flags.length,
    resolvedRecentCount: resolvedRecent.length,
    loading,
    refetch: fetchFlags,
    getFlagsForEntries,
    hasOpenFlags,
  };
}

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
  if (error) return { success: false, count: 0, error: error.message };
  return { success: true, count: data?.length ?? 0 };
}

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

export async function fetchFlagComments(
  flagId: string
): Promise<EntryReviewFlagComment[]> {
  const { data, error } = await supabase
    .from('entry_review_flag_comments')
    .select('*')
    .eq('flag_id', flagId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as EntryReviewFlagComment[];
}

export async function addFlagComment(
  flagId: string,
  authorId: string,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  if (!comment.trim()) return { success: false, error: 'Empty comment' };
  const { error } = await supabase.from('entry_review_flag_comments').insert({
    flag_id: flagId,
    author_id: authorId,
    comment: comment.trim(),
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

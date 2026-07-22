import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  useEntryReviewFlags,
  resolveEntryReviewFlag,
  fetchFlagComments,
  addFlagComment,
  type EntryReviewFlag,
  type EntryReviewFlagComment,
} from '@/hooks/useEntryReviewFlags';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Flag, CheckCircle2, MessageSquare, ChevronDown, Clock, Pencil, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MainLayout } from '@/components/layout/MainLayout';

interface EntryInfo {
  id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  regular_minutes: number;
  overtime_minutes: number;
  employee_id: string;
  project_id: string;
  is_deleted: boolean;
}

interface EmployeeInfo { id: string; first_name: string; last_name: string; employee_code: string; }
interface ProjectInfo { id: string; project_code: string; project_name: string; }
interface ProfileInfo { user_id: string; full_name: string | null; display_name: string | null; }

interface Segment {
  id: string | null; // null = new (insert), string = existing (update)
  project_id: string;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  is_flagged: boolean; // the originally flagged entry
  _pending_delete?: boolean;
}

export default function ReviewFlagsPage() {
  const { language } = useLanguage();
  const { user, hasElevatedRole } = useAuth();
  const { flags, resolvedRecent, openCount, resolvedRecentCount, refetch, loading } =
    useEntryReviewFlags();

  const [entries, setEntries] = useState<Record<string, EntryInfo>>({});
  const [employees, setEmployees] = useState<Record<string, EmployeeInfo>>({});
  const [projects, setProjects] = useState<Record<string, ProjectInfo>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [commentsByFlag, setCommentsByFlag] = useState<Record<string, EntryReviewFlagComment[]>>({});
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<EntryReviewFlag | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [newCommentByFlag, setNewCommentByFlag] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Split-edit dialog state
  const [allProjects, setAllProjects] = useState<ProjectInfo[]>([]);
  const [editTarget, setEditTarget] = useState<EntryReviewFlag | null>(null);
  const [editDate, setEditDate] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [editReason, setEditReason] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [confirmDeleteFlagged, setConfirmDeleteFlagged] = useState<number | null>(null);

  // Delete-entry dialog state (option B: direct delete of the flagged entry)
  const [deleteTarget, setDeleteTarget] = useState<EntryReviewFlag | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);


  const dateLocale = language === 'el' ? el : enUS;
  const t = (en: string, gr: string) => (language === 'el' ? gr : en);

  const allFlags = useMemo(() => [...flags, ...resolvedRecent], [flags, resolvedRecent]);

  // Fetch related entries/employees/projects/profiles whenever flag list changes
  useEffect(() => {
    if (!hasElevatedRole || allFlags.length === 0) return;
    const entryIds = Array.from(new Set(allFlags.map((f) => f.time_entry_id)));
    const userIds = Array.from(
      new Set(
        allFlags.flatMap((f) => [f.raised_by, f.resolved_by].filter(Boolean) as string[])
      )
    );

    (async () => {
      const { data: entryData } = await supabase
        .from('time_entries')
        .select('id, entry_date, start_time, end_time, regular_minutes, overtime_minutes, employee_id, project_id, is_deleted')
        .in('id', entryIds);

      const entriesMap: Record<string, EntryInfo> = {};
      const empIds = new Set<string>();
      const projIds = new Set<string>();
      (entryData || []).forEach((e: any) => {
        entriesMap[e.id] = e;
        empIds.add(e.employee_id);
        projIds.add(e.project_id);
      });
      setEntries(entriesMap);

      if (empIds.size) {
        const { data: empData } = await supabase
          .from('employees')
          .select('id, first_name, last_name, employee_code')
          .in('id', Array.from(empIds));
        const m: Record<string, EmployeeInfo> = {};
        (empData || []).forEach((e: any) => (m[e.id] = e));
        setEmployees(m);
      }

      if (projIds.size) {
        const { data: projData } = await supabase
          .from('projects')
          .select('id, project_code, project_name')
          .in('id', Array.from(projIds));
        const m: Record<string, ProjectInfo> = {};
        (projData || []).forEach((p: any) => (m[p.id] = p));
        setProjects(m);
      }

      if (userIds.length) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('user_id, full_name, display_name')
          .in('user_id', userIds);
        const m: Record<string, ProfileInfo> = {};
        (profData || []).forEach((p: any) => (m[p.user_id] = p));
        setProfiles(m);
      }
    })();
  }, [allFlags, hasElevatedRole]);

  const loadComments = async (flagId: string) => {
    const list = await fetchFlagComments(flagId);
    setCommentsByFlag((prev) => ({ ...prev, [flagId]: list }));
  };

  const handleExpand = (flagId: string) => {
    const next = expandedFlag === flagId ? null : flagId;
    setExpandedFlag(next);
    if (next && !commentsByFlag[next]) loadComments(next);
  };

  const handleAddComment = async (flagId: string) => {
    const text = (newCommentByFlag[flagId] || '').trim();
    if (!text || !user) return;
    setSubmitting(true);
    const res = await addFlagComment(flagId, user.id, text);
    setSubmitting(false);
    if (res.success) {
      setNewCommentByFlag((p) => ({ ...p, [flagId]: '' }));
      loadComments(flagId);
      toast.success(t('Comment added', 'Σχόλιο προστέθηκε'));
    } else {
      toast.error(res.error || t('Failed', 'Αποτυχία'));
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget || !user) return;
    if (!resolveNotes.trim()) {
      toast.error(t('Please provide a reason', 'Παρακαλώ συμπληρώστε αιτιολογία'));
      return;
    }
    setSubmitting(true);
    const res = await resolveEntryReviewFlag(resolveTarget.id, user.id, resolveNotes);
    setSubmitting(false);
    if (res.success) {
      toast.success(t('Flag marked as resolved', 'Η σημαία επιλύθηκε'));
      setResolveTarget(null);
      setResolveNotes('');
      refetch();
    } else {
      toast.error(res.error || t('Failed', 'Αποτυχία'));
    }
  };

  // Load all projects once for the edit selector (Admin/HR see all)
  useEffect(() => {
    if (!hasElevatedRole) return;
    (async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, project_code, project_name')
        .order('project_code');
      setAllProjects((data as ProjectInfo[]) || []);
    })();
  }, [hasElevatedRole]);

  const openEdit = async (f: EntryReviewFlag) => {
    const entry = entries[f.time_entry_id];
    if (!entry) {
      toast.error(t('Entry not loaded yet', 'Η καταχώρηση δεν φορτώθηκε'));
      return;
    }
    // Load ALL entries for this employee on this date
    const { data, error } = await supabase
      .from('time_entries')
      .select('id, project_id, start_time, end_time')
      .eq('employee_id', entry.employee_id)
      .eq('entry_date', entry.entry_date)
      .eq('is_deleted', false)
      .order('start_time');

    if (error) {
      toast.error(error.message);
      return;
    }

    const segs: Segment[] = (data || []).map((e: any) => ({
      id: e.id,
      project_id: e.project_id,
      start_time: (e.start_time as string).slice(0, 5),
      end_time: (e.end_time as string).slice(0, 5),
      is_flagged: e.id === entry.id,
    }));

    setEditTarget(f);
    setEditDate(entry.entry_date);
    setSegments(segs);
    setEditReason('');
  };

  const addSegment = () => {
    const lastEnd = segments
      .filter((s) => !s._pending_delete)
      .reduce((max, s) => (s.end_time > max ? s.end_time : max), '');
    setSegments([
      ...segments,
      {
        id: null,
        project_id: '',
        start_time: lastEnd || '',
        end_time: '',
        is_flagged: false,
      },
    ]);
  };

  const updateSegment = (idx: number, patch: Partial<Segment>) => {
    setSegments((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeSegment = (idx: number) => {
    const seg = segments[idx];
    if (seg.is_flagged) {
      // Require extra confirmation for the flagged entry
      setConfirmDeleteFlagged(idx);
      return;
    }
    setSegments((prev) => {
      // If it had an id (existing row), mark for delete; if it was new, drop it
      if (prev[idx].id) {
        return prev.map((s, i) => (i === idx ? { ...s, _pending_delete: true } : s));
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const confirmRemoveFlagged = () => {
    if (confirmDeleteFlagged === null) return;
    const idx = confirmDeleteFlagged;
    setSegments((prev) => prev.map((s, i) => (i === idx ? { ...s, _pending_delete: true } : s)));
    setConfirmDeleteFlagged(null);
  };

  const handleSplitSave = async () => {
    if (!editTarget || !user) return;
    if (!editReason.trim()) {
      toast.error(t('Reason is required', 'Η αιτιολογία είναι υποχρεωτική'));
      return;
    }

    const active = segments.filter((s) => !s._pending_delete);
    if (active.length === 0) {
      toast.error(t('At least one segment is required', 'Απαιτείται τουλάχιστον ένα τμήμα'));
      return;
    }

    // Per-row validation
    for (const s of active) {
      if (!s.project_id || !s.start_time || !s.end_time) {
        toast.error(t('Fill all fields in every segment', 'Συμπληρώστε όλα τα πεδία σε κάθε τμήμα'));
        return;
      }
      if (s.start_time >= s.end_time) {
        toast.error(t('End must be after start in every segment', 'Η λήξη πρέπει να είναι μετά την έναρξη'));
        return;
      }
    }

    // Overlap check between active segments
    const sorted = [...active].sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start_time < sorted[i - 1].end_time) {
        toast.error(t('Segments overlap', 'Τα τμήματα επικαλύπτονται'));
        return;
      }
    }

    setEditSubmitting(true);
    try {
      const entry = entries[editTarget.time_entry_id];

      // DELETE (soft) segments marked for deletion
      const toDelete = segments.filter((s) => s._pending_delete && s.id);
      for (const s of toDelete) {
        const { error } = await supabase
          .from('time_entries')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: user.id,
            delete_reason: `[SPLIT] ${editReason.trim()}`,
          })
          .eq('id', s.id!);
        if (error) throw error;
      }

      // UPDATE existing kept segments
      const toUpdate = segments.filter((s) => !s._pending_delete && s.id);
      for (const s of toUpdate) {
        const { error } = await supabase
          .from('time_entries')
          .update({
            project_id: s.project_id,
            start_time: s.start_time,
            end_time: s.end_time,
          })
          .eq('id', s.id!);
        if (error) throw error;
      }

      // INSERT new segments — created_by = current admin/hr (B1)
      const toInsert = segments.filter((s) => !s._pending_delete && !s.id);
      if (toInsert.length > 0) {
        const rows = toInsert.map((s) => ({
          employee_id: entry.employee_id,
          project_id: s.project_id,
          entry_date: editDate,
          start_time: s.start_time,
          end_time: s.end_time,
          created_by: user.id,
        }));
        const { error } = await supabase.from('time_entries').insert(rows);
        if (error) throw error;
      }

      // Add reason as a comment on the flag (audit trail visible in UI)
      await addFlagComment(editTarget.id, user.id, `[SPLIT] ${editReason.trim()}`);

      toast.success(
        t('Entries updated. Flag stays open until manually resolved.',
          'Οι καταχωρήσεις ενημερώθηκαν. Η σημαία παραμένει ανοιχτή μέχρι χειροκίνητη επίλυση.')
      );
      setEditTarget(null);
      setSegments([]);
      setEditReason('');
      refetch();
      // Refresh comments if this flag is expanded
      if (expandedFlag === editTarget.id) loadComments(editTarget.id);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Overlap detected')) {
        toast.error(t('Overlap detected with existing entries', 'Επικάλυψη με υπάρχουσες καταχωρήσεις'));
      } else {
        toast.error(msg || t('Failed', 'Αποτυχία'));
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const userName = (id: string | null) => {
    if (!id) return '—';
    const p = profiles[id];
    return p?.full_name || p?.display_name || id.slice(0, 8);
  };

  const renderFlagCard = (f: EntryReviewFlag) => {
    const entry = entries[f.time_entry_id];
    const employee = entry ? employees[entry.employee_id] : null;
    const project = entry ? projects[entry.project_id] : null;
    const isResolved = f.status === 'resolved';
    const isExpanded = expandedFlag === f.id;
    const commentCount = commentsByFlag[f.id]?.length ?? 0;

    return (
      <Card key={f.id} className={cn('border-l-4', isResolved ? 'border-l-green-500' : 'border-l-orange-500')}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              {isResolved ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <Flag className="h-5 w-5 text-orange-500 fill-orange-200 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">
                    {employee
                      ? `${employee.last_name} ${employee.first_name}`
                      : t('Unknown employee', 'Άγνωστος εργαζόμενος')}
                  </span>
                  {employee && (
                    <Badge variant="outline" className="text-xs">{employee.employee_code}</Badge>
                  )}
                  {entry?.is_deleted && (
                    <Badge variant="destructive" className="text-xs">
                      {t('Deleted entry', 'Διαγραμμένη καταχώρηση')}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {project ? `${project.project_code} — ${project.project_name}` : ''}
                  {entry && (
                    <span className="ml-2">
                      • {format(new Date(entry.entry_date), 'dd/MM/yyyy', { locale: dateLocale })}{' '}
                      {entry.start_time}–{entry.end_time}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {isResolved ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
                {t('Resolved', 'Επιλύθηκε')}
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                {!entry?.is_deleted && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(f)}
                  >
                    <Pencil className="h-4 w-4 mr-1.5" />
                    {t('Edit entry', 'Επεξεργασία')}
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => { setResolveTarget(f); setResolveNotes(''); }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  {t('Mark as resolved', 'Επίλυση')}
                </Button>
              </div>
            )}
          </div>

          <div className="bg-muted/40 rounded-md p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">
              {t('Raised by', 'Σήμανση από')} <strong>{userName(f.raised_by)}</strong> •{' '}
              {format(new Date(f.created_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}
            </p>
            <p className="whitespace-pre-wrap break-words">{f.reason}</p>
          </div>

          {isResolved && f.resolution_notes && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm">
              <p className="text-xs text-green-800 mb-1">
                {t('Resolved by', 'Επιλύθηκε από')} <strong>{userName(f.resolved_by)}</strong>
                {f.resolved_at && (
                  <> • {format(new Date(f.resolved_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}</>
                )}
              </p>
              <p className="whitespace-pre-wrap break-words text-green-900">{f.resolution_notes}</p>
            </div>
          )}

          <Collapsible open={isExpanded} onOpenChange={() => handleExpand(f.id)}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                {t('Comments', 'Σχόλια')}
                {commentCount > 0 && <Badge variant="secondary" className="h-4 px-1.5">{commentCount}</Badge>}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {(commentsByFlag[f.id] || []).map((c) => (
                <div key={c.id} className="border rounded-md p-2 text-sm bg-background">
                  <p className="text-xs text-muted-foreground mb-1">
                    <strong>{userName(c.author_id)}</strong> •{' '}
                    {format(new Date(c.created_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{c.comment}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <Textarea
                  value={newCommentByFlag[f.id] || ''}
                  onChange={(e) => setNewCommentByFlag((p) => ({ ...p, [f.id]: e.target.value }))}
                  placeholder={t('Add a comment…', 'Προσθέστε σχόλιο…')}
                  rows={2}
                  maxLength={500}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => handleAddComment(f.id)}
                  disabled={!(newCommentByFlag[f.id] || '').trim() || submitting}
                >
                  {t('Post', 'Αποστολή')}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    );
  };

  // Group OPEN flags by entry_date
  const openGrouped = useMemo(() => {
    const groups: Record<string, EntryReviewFlag[]> = {};
    flags.forEach((f) => {
      const date = entries[f.time_entry_id]?.entry_date || 'unknown';
      (groups[date] ||= []).push(f);
    });
    return Object.entries(groups).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [flags, entries]);

  if (!hasElevatedRole) {
    return <div className="p-6">Access denied</div>;
  }

  const activeSegments = segments.filter((s) => !s._pending_delete);

  return (
    <MainLayout>
    <div className="container mx-auto p-6 max-w-5xl space-y-6 relative z-10">
      <div className="bg-background/95 backdrop-blur rounded-lg p-6 shadow-lg">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6 text-orange-500" />
            {t('Pending Reviews', 'Εκκρεμή Επανελέγχου')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              'All open review flags across all dates. Resolved flags from the last 72 hours are also shown.',
              'Όλες οι ανοιχτές σημαίες επανελέγχου, ανεξαρτήτως ημερομηνίας. Επιλυμένες σημαίες των τελευταίων 72 ωρών εμφανίζονται επίσης.'
            )}
          </p>
        </div>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open" className="gap-2">
            <Flag className="h-4 w-4" />
            {t('Open', 'Ανοιχτές')}
            <Badge variant="secondary">{openCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {t('Recently resolved (72h)', 'Επιλύθηκαν πρόσφατα (72ώ)')}
            <Badge variant="secondary">{resolvedRecentCount}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4 space-y-6">
          {loading ? (
            <p className="text-muted-foreground">{t('Loading…', 'Φόρτωση…')}</p>
          ) : openGrouped.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                🎉 {t('No open review flags', 'Καμία ανοιχτή σημαία')}
              </CardContent>
            </Card>
          ) : (
            openGrouped.map(([date, items]) => (
              <div key={date} className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold">
                    {date === 'unknown'
                      ? t('Unknown date', 'Άγνωστη ημερομηνία')
                      : format(new Date(date), 'EEEE, dd/MM/yyyy', { locale: dateLocale })}
                  </h2>
                  <Badge variant="outline">{items.length}</Badge>
                </div>
                {items.map(renderFlagCard)}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="resolved" className="mt-4 space-y-3">
          {resolvedRecent.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                {t('No recently resolved flags', 'Καμία πρόσφατα επιλυμένη σημαία')}
              </CardContent>
            </Card>
          ) : (
            resolvedRecent.map(renderFlagCard)
          )}
        </TabsContent>
      </Tabs>

      {/* MARK AS RESOLVED dialog */}
      <Dialog open={!!resolveTarget} onOpenChange={(o) => !o && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Mark flag as resolved', 'Επίλυση σημαίας')}</DialogTitle>
            <DialogDescription>
              {t(
                'Close this review flag. Use after all needed edits and comments are done.',
                'Κλείσιμο της σημαίας επανελέγχου. Χρησιμοποιήστε αφού γίνουν όλες οι απαραίτητες διορθώσεις και σχόλια.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolve-notes">
              {t('Resolution note', 'Σημείωση επίλυσης')} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="resolve-notes"
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder={t('Short summary of the outcome…', 'Σύντομη περιγραφή του αποτελέσματος…')}
              rows={4}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)} disabled={submitting}>
              {t('Cancel', 'Άκυρο')}
            </Button>
            <Button onClick={handleResolve} disabled={!resolveNotes.trim() || submitting}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {t('Mark as resolved', 'Επίλυση')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SPLIT EDIT dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) { setEditTarget(null); setSegments([]); setEditReason(''); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('Edit time entries', 'Επεξεργασία καταχωρήσεων')}</DialogTitle>
            <DialogDescription>
              {(() => {
                const e = editTarget ? entries[editTarget.time_entry_id] : null;
                const emp = e ? employees[e.employee_id] : null;
                return emp
                  ? `${emp.last_name} ${emp.first_name} (${emp.employee_code}) — ${format(new Date(editDate || e!.entry_date), 'dd/MM/yyyy', { locale: dateLocale })}`
                  : '';
              })()}
              <span className="block text-xs mt-1 text-muted-foreground">
                {t(
                  'Add, edit or remove segments. The flag stays open until you manually mark it resolved.',
                  'Προσθέστε, επεξεργαστείτε ή διαγράψτε τμήματα. Η σημαία παραμένει ανοιχτή μέχρι να την επιλύσετε χειροκίνητα.'
                )}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {segments.map((seg, idx) => {
              if (seg._pending_delete) {
                return (
                  <div key={idx} className="border border-dashed border-destructive/50 rounded-md p-2 text-xs text-destructive flex items-center justify-between bg-destructive/5">
                    <span className="line-through">
                      {(allProjects.find((p) => p.id === seg.project_id)?.project_code) || '—'} {seg.start_time}–{seg.end_time}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => updateSegment(idx, { _pending_delete: false })}
                    >
                      {t('Undo', 'Αναίρεση')}
                    </Button>
                  </div>
                );
              }
              return (
                <div
                  key={idx}
                  className={cn(
                    'grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end border rounded-md p-2',
                    seg.is_flagged && 'border-orange-300 bg-orange-50/30'
                  )}
                >
                  <div className="space-y-1 min-w-0">
                    {seg.is_flagged && (
                      <Badge variant="outline" className="text-[10px] h-4 border-orange-400 text-orange-700">
                        <Flag className="h-2.5 w-2.5 mr-1" />
                        {t('Flagged', 'Σημαία')}
                      </Badge>
                    )}
                    <Select value={seg.project_id} onValueChange={(v) => updateSegment(idx, { project_id: v })}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={t('Select project', 'Επιλέξτε έργο')} />
                      </SelectTrigger>
                      <SelectContent>
                        {allProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.project_code} — {p.project_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="time"
                    value={seg.start_time}
                    onChange={(e) => updateSegment(idx, { start_time: e.target.value })}
                    className="h-9 w-28"
                  />
                  <Input
                    type="time"
                    value={seg.end_time}
                    onChange={(e) => updateSegment(idx, { end_time: e.target.value })}
                    className="h-9 w-28"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    onClick={() => removeSegment(idx)}
                    title={t('Remove segment', 'Αφαίρεση τμήματος')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            <Button variant="outline" size="sm" onClick={addSegment} className="w-full">
              <Plus className="h-4 w-4 mr-1.5" />
              {t('Add segment', 'Προσθήκη τμήματος')}
            </Button>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="edit-reason">
              {t('Reason for change', 'Αιτιολογία αλλαγής')} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="edit-reason"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder={t('Why are these changes being made?', 'Γιατί γίνονται αυτές οι αλλαγές;')}
              rows={2}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {t('This reason will be added as a comment on the flag.', 'Η αιτιολογία θα προστεθεί ως σχόλιο στη σημαία.')}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editSubmitting}>
              {t('Cancel', 'Άκυρο')}
            </Button>
            <Button onClick={handleSplitSave} disabled={editSubmitting || activeSegments.length === 0 || !editReason.trim()}>
              <Pencil className="h-4 w-4 mr-1.5" />
              {t('Save changes', 'Αποθήκευση')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation for deleting the FLAGGED entry */}
      <AlertDialog open={confirmDeleteFlagged !== null} onOpenChange={(o) => !o && setConfirmDeleteFlagged(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('Delete the flagged entry?', 'Διαγραφή της σημανθείσας καταχώρησης;')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'You are about to delete the entry that was originally flagged for review. This will be logged in the audit trail. Continue?',
                'Πρόκειται να διαγράψετε την καταχώρηση που σημάνθηκε για επανέλεγχο. Η ενέργεια θα καταγραφεί στο audit log. Συνέχεια;'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Άκυρο')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveFlagged} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('Yes, delete', 'Ναι, διαγραφή')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      </div>
    </div>
    </MainLayout>
  );
}

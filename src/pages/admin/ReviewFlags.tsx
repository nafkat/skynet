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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Flag, CheckCircle2, MessageSquare, ChevronDown, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { el, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
      toast.success(t('Flag resolved', 'Η σημαία επιλύθηκε'));
      setResolveTarget(null);
      setResolveNotes('');
      refetch();
    } else {
      toast.error(res.error || t('Failed', 'Αποτυχία'));
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setResolveTarget(f); setResolveNotes(''); }}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                {t('Resolve (no change needed)', 'Επίλυση (χωρίς αλλαγή)')}
              </Button>
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

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
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

      <Dialog open={!!resolveTarget} onOpenChange={(o) => !o && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Resolve flag (no change needed)', 'Επίλυση σημαίας (χωρίς αλλαγή)')}</DialogTitle>
            <DialogDescription>
              {t(
                'Use this when the entry was reviewed and no edit is required. The raiser will see your note.',
                'Χρησιμοποιήστε όταν η καταχώρηση ελέγχθηκε και δεν χρειάζεται διόρθωση. Ο raiser θα δει την σημείωσή σας.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolve-notes">
              {t('Reason', 'Αιτιολογία')} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="resolve-notes"
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder={t('Why no change is needed…', 'Γιατί δεν χρειάζεται αλλαγή…')}
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
              {t('Resolve', 'Επίλυση')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

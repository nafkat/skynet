import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { CheckCircle, Send, Undo2, MessageSquare, Clock, AlertCircle, Loader2 } from 'lucide-react';

export type ReviewStatus = 'draft' | 'submitted_for_review' | 'changes_requested' | 'approved';

export const REVIEW_STATUS_CONFIG: Record<
  ReviewStatus,
  { labelEn: string; labelEl: string; color: string }
> = {
  draft: { labelEn: 'Draft', labelEl: 'Πρόχειρο', color: 'bg-yellow-100 text-yellow-800' },
  submitted_for_review: {
    labelEn: 'Pending Review',
    labelEl: 'Προς Έλεγχο',
    color: 'bg-blue-100 text-blue-800',
  },
  changes_requested: {
    labelEn: 'Changes Requested',
    labelEl: 'Ζητήθηκαν Αλλαγές',
    color: 'bg-amber-100 text-amber-900',
  },
  approved: { labelEn: 'Approved', labelEl: 'Εγκρίθηκε', color: 'bg-green-100 text-green-800' },
};

interface Comment {
  id: string;
  author_id: string;
  author_name?: string;
  comment: string;
  action: string | null;
  created_at: string;
}

interface Props {
  reportId: string;
  reportCode: string;
  reviewStatus: ReviewStatus;
  createdBy: string | null;
  onChanged: (newStatus: ReviewStatus) => void;
}

export default function ReviewWorkflow({
  reportId,
  reportCode,
  reviewStatus,
  createdBy,
  onChanged,
}: Props) {
  const { user, isAdmin, hasPermission } = useAuth();
  const { language } = useLanguage();
  const t = (en: string, el: string) => (language === 'el' ? el : en);

  const canApprove = isAdmin || hasPermission('costing.reports.approve');
  const isOwner = !!user && createdBy === user.id;
  // Submit if owner OR has create/edit permission for the report
  const canSubmit =
    (isOwner || hasPermission('costing.reports.create') || hasPermission('costing.reports.edit')) &&
    (reviewStatus === 'draft' || reviewStatus === 'changes_requested');

  const [comments, setComments] = useState<Comment[]>([]);
  const [actionDialog, setActionDialog] = useState<null | 'submit' | 'request_changes' | 'approve'>(
    null,
  );
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [showThread, setShowThread] = useState(false);

  const cfg = REVIEW_STATUS_CONFIG[reviewStatus];

  const fetchComments = async () => {
    const { data } = await supabase
      .from('cost_report_review_comments')
      .select('id, author_id, comment, action, created_at')
      .eq('report_id', reportId)
      .order('created_at', { ascending: false });
    const rows = (data || []) as Comment[];
    // Fetch author names
    const ids = Array.from(new Set(rows.map((r) => r.author_id)));
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, display_name')
        .in('user_id', ids);
      const nameMap = new Map<string, string>();
      (profiles || []).forEach((p: any) =>
        nameMap.set(p.user_id, p.display_name || p.full_name || ''),
      );
      rows.forEach((r) => (r.author_name = nameMap.get(r.author_id) || ''));
    }
    setComments(rows);
  };

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, reviewStatus]);

  const openDialog = (a: 'submit' | 'request_changes' | 'approve') => {
    setComment('');
    setActionDialog(a);
  };

  const performAction = async () => {
    if (!user) return;
    if (actionDialog === 'request_changes' && !comment.trim()) {
      toast.error(t('A comment is required', 'Απαιτείται σχόλιο'));
      return;
    }
    setBusy(true);
    try {
      let newStatus: ReviewStatus = reviewStatus;
      let updateFields: Record<string, any> = { updated_at: new Date().toISOString() };

      if (actionDialog === 'submit') {
        newStatus = 'submitted_for_review';
        updateFields = {
          ...updateFields,
          review_status: newStatus,
          submitted_at: new Date().toISOString(),
          submitted_by: user.id,
        };
      } else if (actionDialog === 'approve') {
        newStatus = 'approved';
        updateFields = {
          ...updateFields,
          review_status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        };
      } else if (actionDialog === 'request_changes') {
        newStatus = 'changes_requested';
        updateFields = {
          ...updateFields,
          review_status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        };
      }

      const { error } = await supabase
        .from('cost_reports')
        .update(updateFields)
        .eq('id', reportId);
      if (error) throw error;

      if (comment.trim()) {
        await supabase.from('cost_report_review_comments').insert({
          report_id: reportId,
          author_id: user.id,
          comment: comment.trim(),
          action: actionDialog,
        });
      }

      const labels: Record<string, [string, string]> = {
        submit: ['Submitted for review', 'Υποβλήθηκε προς έλεγχο'],
        approve: ['Report approved', 'Η αναφορά εγκρίθηκε'],
        request_changes: ['Changes requested', 'Ζητήθηκαν αλλαγές'],
      };
      const [en, el] = labels[actionDialog!];
      toast.success(t(en, el));
      onChanged(newStatus);
      setActionDialog(null);
      setShowThread(true);
      fetchComments();
    } catch (e: any) {
      toast.error(e.message || t('Action failed', 'Αποτυχία ενέργειας'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('Review', 'Έλεγχος')}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}
          >
            {reviewStatus === 'approved' ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : reviewStatus === 'submitted_for_review' ? (
              <Clock className="h-3.5 w-3.5" />
            ) : reviewStatus === 'changes_requested' ? (
              <AlertCircle className="h-3.5 w-3.5" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            {language === 'el' ? cfg.labelEl : cfg.labelEn}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canSubmit && (
            <Button size="sm" onClick={() => openDialog('submit')}>
              <Send className="h-4 w-4 mr-1.5" />
              {t('Submit for Review', 'Υποβολή προς Έλεγχο')}
            </Button>
          )}
          {canApprove && reviewStatus === 'submitted_for_review' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openDialog('request_changes')}
                className="border-amber-400 text-amber-700 hover:bg-amber-50"
              >
                <Undo2 className="h-4 w-4 mr-1.5" />
                {t('Request Changes', 'Ζήτηση Αλλαγών')}
              </Button>
              <Button
                size="sm"
                onClick={() => openDialog('approve')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                {t('Approve', 'Έγκριση')}
              </Button>
            </>
          )}
          {canApprove && reviewStatus === 'approved' && (
            <Button size="sm" variant="outline" onClick={() => openDialog('request_changes')}>
              <Undo2 className="h-4 w-4 mr-1.5" />
              {t('Reopen / Request Changes', 'Επανάνοιγμα / Αλλαγές')}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowThread((s) => !s)}
            className="text-muted-foreground"
          >
            <MessageSquare className="h-4 w-4 mr-1.5" />
            {t('Comments', 'Σχόλια')} ({comments.length})
          </Button>
        </div>
      </div>

      {showThread && (
        <div className="border-t pt-3 space-y-2 max-h-64 overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              {t('No comments yet.', 'Δεν υπάρχουν σχόλια.')}
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="text-sm border-l-2 border-primary/30 pl-3 py-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">{c.author_name || '—'}</span>
                  {c.action && (
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase">
                      {c.action}
                    </span>
                  )}
                  <span>{new Date(c.created_at).toLocaleString('el-GR')}</span>
                </div>
                <p className="whitespace-pre-wrap mt-0.5">{c.comment}</p>
              </div>
            ))
          )}
        </div>
      )}

      <Dialog open={!!actionDialog} onOpenChange={(o) => !o && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === 'submit' &&
                t('Submit report for review', 'Υποβολή αναφοράς προς έλεγχο')}
              {actionDialog === 'approve' && t('Approve report', 'Έγκριση αναφοράς')}
              {actionDialog === 'request_changes' &&
                t('Request changes', 'Ζήτηση αλλαγών')}
            </DialogTitle>
            <DialogDescription>
              {reportCode}
              {actionDialog === 'request_changes' &&
                ' — ' + t('Comment is required.', 'Το σχόλιο είναι υποχρεωτικό.')}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              actionDialog === 'request_changes'
                ? t('Describe what needs to change…', 'Περιγράψτε τι χρειάζεται αλλαγή…')
                : t('Optional comment…', 'Προαιρετικό σχόλιο…')
            }
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActionDialog(null)} disabled={busy}>
              {t('Cancel', 'Άκυρο')}
            </Button>
            <Button onClick={performAction} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {t('Confirm', 'Επιβεβαίωση')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

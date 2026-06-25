import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Navigate } from 'react-router-dom';

interface DeletedReport {
  id: string;
  code: string;
  status: string;
  deleted_at: string;
  projects: { project_code: string; project_name: string } | null;
}

export default function CostingTrash() {
  const { language } = useLanguage();
  const { isAdmin } = useAuth();
  const t = (en: string, el: string) => (language === 'el' ? el : en);
  const [rows, setRows] = useState<DeletedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [purgeId, setPurgeId] = useState<string | null>(null);

  if (!isAdmin) return <Navigate to="/costing" replace />;

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cost_reports')
      .select('id, code, status, deleted_at, projects(project_code, project_name)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const handleRestore = async (id: string) => {
    const { error } = await supabase
      .from('cost_reports')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', id);
    if (error) toast.error(t('Restore failed', 'Αποτυχία επαναφοράς'));
    else { toast.success(t('Report restored', 'Η αναφορά επαναφέρθηκε')); fetch(); }
  };

  const handlePurge = async () => {
    if (!purgeId) return;
    const { error } = await supabase.from('cost_reports').delete().eq('id', purgeId);
    setPurgeId(null);
    if (error) toast.error(t('Permanent delete failed', 'Αποτυχία οριστικής διαγραφής'));
    else { toast.success(t('Permanently deleted', 'Διαγράφηκε οριστικά')); fetch(); }
  };

  const daysLeft = (deletedAt: string) => {
    const expiry = new Date(deletedAt).getTime() + 15 * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trash2 className="h-6 w-6" />
          {t('Trash', 'Κάδος Ανακύκλωσης')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('Reports are kept for 15 days, then permanently deleted.', 'Οι αναφορές διατηρούνται για 15 ημέρες και μετά διαγράφονται οριστικά.')}
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t('Loading...', 'Φόρτωση...')}</p>
      ) : rows.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border rounded-lg">
          {t('Trash is empty.', 'Ο κάδος είναι άδειος.')}
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {rows.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium">{r.code}</div>
                <div className="text-sm text-muted-foreground truncate">
                  {r.projects ? `${r.projects.project_code} — ${r.projects.project_name}` : '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t('Deleted', 'Διαγράφηκε')}: {new Date(r.deleted_at).toLocaleDateString(language === 'el' ? 'el-GR' : 'en-GB')}
                  {' · '}
                  <span className={daysLeft(r.deleted_at) <= 3 ? 'text-destructive font-medium' : ''}>
                    {daysLeft(r.deleted_at)} {t('days left', 'ημέρες απομένουν')}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => handleRestore(r.id)}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('Restore', 'Επαναφορά')}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setPurgeId(r.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('Delete forever', 'Οριστική διαγραφή')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!purgeId} onOpenChange={(o) => !o && setPurgeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Permanently delete?', 'Οριστική διαγραφή;')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This cannot be undone. All sections, items, photos and attachments will be removed.',
                 'Δεν αναιρείται. Όλα τα τμήματα, εργασίες, φωτογραφίες και συνημμένα θα διαγραφούν.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Άκυρο')}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePurge} className="bg-destructive text-destructive-foreground">
              {t('Delete forever', 'Οριστική διαγραφή')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

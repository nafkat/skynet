import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FileText, Plus, Search, RefreshCw } from 'lucide-react';

interface Report {
  id: string;
  code: string;
  version_number: number;
  status: string;
  created_at: string;
  version_notes: string | null;
  projects: {
    project_code: string;
    project_name: string;
    customer_company_name: string;
    assigned_shipyard_company: string;
  } | null;
}

type StatusKey = 'all' | 'draft' | 'sent' | 'agreed' | 'invoiced';

export default function CostingReportsList() {
  const { language } = useLanguage();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
  const t = (en: string, el: string) => (language === 'el' ? el : en);
  const canCreate = hasPermission('costing.reports.create');

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cost_reports')
      .select(
        'id, code, version_number, status, created_at, version_notes, projects(project_code, project_name, customer_company_name, assigned_shipyard_company)'
      )
      .order('created_at', { ascending: false });
    setReports((data as Report[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filtered = reports.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.code.toLowerCase().includes(q) ||
      r.projects?.project_name.toLowerCase().includes(q) ||
      r.projects?.customer_company_name.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-purple-100 text-purple-800',
      agreed: 'bg-green-100 text-green-800',
      invoiced: 'bg-orange-100 text-orange-800',
    };
    const labels: Record<string, [string, string]> = {
      draft: ['Draft', 'Πρόχειρο'],
      sent: ['Sent', 'Απεστάλη'],
      agreed: ['Agreed', 'Συμφωνήθηκε'],
      invoiced: ['Invoiced', 'Τιμολογήθηκε'],
    };
    const [en, el] = labels[status] || [status, status];
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-800'}`}>
        {language === 'el' ? el : en}
      </span>
    );
  };

  const statusLabel = (s: StatusKey) =>
    s === 'all'
      ? t('All', 'Όλα')
      : s === 'draft'
      ? t('Draft', 'Πρόχειρα')
      : s === 'sent'
      ? t('Sent', 'Απεστάλησαν')
      : s === 'agreed'
      ? t('Agreed', 'Συμφωνήθηκαν')
      : t('Invoiced', 'Τιμολογήθηκαν');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold text-white">
          {t('Cost Reports', 'Αναφορές Κόστους')}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('Refresh', 'Ανανέωση')}
          </Button>
          {canCreate && (
            <Button onClick={() => navigate('/costing/new')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('New Report', 'Νέα Αναφορά')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('Search code, project, client…', 'Αναζήτηση κωδικού, έργου, πελάτη…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {(['all', 'draft', 'sent', 'agreed', 'invoiced'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}
          >
            {statusLabel(s)}
          </Button>
        ))}
      </div>

      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4">
        {loading ? (
          <div className="text-center py-8 text-white/60">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-white/30 mx-auto mb-3" />
            <p className="text-white/70">{t('No reports found', 'Δεν βρέθηκαν αναφορές')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <div
                key={r.id}
                onClick={() => navigate(`/costing/reports/${r.id}`)}
                className={cn(
                  'flex items-start justify-between gap-4 p-4 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors'
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-white">
                    <span className="font-semibold">{r.code}</span>
                    <span className="text-white/50 text-sm">v{r.version_number}</span>
                  </div>
                  {r.projects && (
                    <p className="text-sm text-white/80">
                      {r.projects.project_code} — {r.projects.project_name}
                    </p>
                  )}
                  {r.projects && (
                    <p className="text-xs text-white/60">
                      {t('Client:', 'Πελάτης:')} {r.projects.customer_company_name}
                      {' · '}
                      {t('Company:', 'Εταιρεία:')} {r.projects.assigned_shipyard_company}
                    </p>
                  )}
                  {r.version_notes && (
                    <p className="text-xs italic text-white/50">"{r.version_notes}"</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {statusBadge(r.status)}
                  <span className="text-xs text-white/50">
                    {new Date(r.created_at).toLocaleDateString('el-GR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

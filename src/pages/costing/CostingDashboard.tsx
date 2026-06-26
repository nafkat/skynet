import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Plus, Clock, CheckCircle, Send, Receipt, RefreshCw, Search, X } from 'lucide-react';

interface Stats {
  total: number;
  draft: number;
  sent: number;
  agreed: number;
  invoiced: number;
}

interface ReportRow {
  id: string;
  code: string;
  version_number: number;
  status: string;
  review_status: string;
  created_at: string;
  projects: {
    project_code: string;
    project_name: string;
    customer_company_name: string | null;
    assigned_shipyard_company: string | null;
  } | null;
}

export default function CostingDashboard() {
  const { language } = useLanguage();
  const { hasElevatedRole, hasPermission } = useAuth();
  const navigate = useNavigate();
  const canCreateReport = hasElevatedRole || hasPermission('costing.reports.create');
  const [stats, setStats] = useState<Stats>({ total: 0, draft: 0, sent: 0, agreed: 0, invoiced: 0 });
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const t = (en: string, el: string) => (language === 'el' ? el : en);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery.trim().toLowerCase()), 250);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('cost_reports')
        .select('id, code, version_number, status, review_status, created_at, projects(project_code, project_name, customer_company_name, assigned_shipyard_company)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (data) {
        const rows = data as unknown as ReportRow[];
        setReports(rows);
        setStats({
          total: rows.length,
          draft: rows.filter((r) => r.status === 'draft').length,
          sent: rows.filter((r) => r.status === 'sent').length,
          agreed: rows.filter((r) => r.status === 'agreed').length,
          invoiced: rows.filter((r) => r.status === 'invoiced').length,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const statusLabels: Record<string, [string, string]> = {
    draft: ['draft', 'πρόχειρο'],
    sent: ['sent', 'απεστάλη'],
    agreed: ['agreed', 'συμφωνήθηκε'],
    invoiced: ['invoiced', 'τιμολογήθηκε'],
  };

  const filtered = useMemo(() => {
    if (!debouncedQuery) return reports.slice(0, 5);
    const q = debouncedQuery;
    return reports
      .filter((r) => {
        const dateEl = new Date(r.created_at).toLocaleDateString('el-GR');
        const dateIso = r.created_at.slice(0, 10);
        const [en, el] = statusLabels[r.status] || [r.status, r.status];
        const haystack = [
          r.code,
          `v${r.version_number}`,
          r.projects?.project_code,
          r.projects?.project_name,
          r.projects?.customer_company_name,
          r.projects?.assigned_shipyard_company,
          en,
          el,
          dateEl,
          dateIso,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 50);
  }, [reports, debouncedQuery]);

  const statCards = [
    { label: t('Total', 'Σύνολο'), value: stats.total, icon: FileText, color: 'text-blue-400' },
    { label: t('Draft', 'Πρόχειρα'), value: stats.draft, icon: Clock, color: 'text-yellow-400' },
    { label: t('Sent', 'Απεστάλησαν'), value: stats.sent, icon: Send, color: 'text-purple-400' },
    { label: t('Agreed', 'Συμφωνήθηκαν'), value: stats.agreed, icon: CheckCircle, color: 'text-green-400' },
    { label: t('Invoiced', 'Τιμολογήθηκαν'), value: stats.invoiced, icon: Receipt, color: 'text-orange-400' },
  ];

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

  const reviewBadge = (rs: string) => {
    const map: Record<string, { c: string; en: string; el: string }> = {
      draft: { c: 'bg-gray-200 text-gray-800', en: 'Draft', el: 'Πρόχειρο' },
      submitted_for_review: { c: 'bg-blue-100 text-blue-800', en: 'Pending Review', el: 'Προς Έλεγχο' },
      changes_requested: { c: 'bg-amber-100 text-amber-900', en: 'Changes', el: 'Αλλαγές' },
      approved: { c: 'bg-green-100 text-green-800', en: 'Approved', el: 'Εγκρίθηκε' },
    };
    const m = map[rs] || map.draft;
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${m.c}`}>
        {language === 'el' ? m.el : m.en}
      </span>
    );
  };

  const isSearching = debouncedQuery.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-white break-words">
            {t('Costing Dashboard', 'Πίνακας Κοστολόγησης')}
          </h1>
          <p className="text-white/70 mt-1 text-sm sm:text-base">
            {t('Overview of cost reports', 'Επισκόπηση αναφορών κόστους')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('Refresh', 'Ανανέωση')}
          </Button>
          {canCreateReport && (
            <Button onClick={() => navigate('/costing/new')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('New Report', 'Νέα Αναφορά')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <span className="text-xs text-white/70">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-4 sm:p-6 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-white min-w-0">
            {isSearching
              ? t('Search Results', 'Αποτελέσματα Αναζήτησης')
              : t('Recent Reports', 'Πρόσφατες Αναφορές')}
            {isSearching && (
              <span className="ml-2 text-sm font-normal text-white/60">({filtered.length})</span>
            )}
          </h2>
          <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-initial sm:min-w-[260px] sm:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(
                  'Search by code, project, company, date…',
                  'Αναζήτηση: κωδικός, έργο, εταιρεία, ημερομηνία…'
                )}
                className="pl-9 pr-9 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 text-white/60"
                  aria-label="clear"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {!isSearching && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/costing/reports')} className="text-white/80 hover:text-white shrink-0">
                {t('View All', 'Όλες')}
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-white/60">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-white/30 mx-auto mb-3" />
            <p className="text-white/70 mb-4">
              {isSearching
                ? t('No matching reports', 'Δεν βρέθηκαν αναφορές')
                : t('No reports yet', 'Δεν υπάρχουν αναφορές ακόμα')}
            </p>
            {!isSearching && canCreateReport && (
              <Button onClick={() => navigate('/costing/new')}>
                <Plus className="h-4 w-4 mr-2" />
                {t('Create first report', 'Δημιουργία πρώτης αναφοράς')}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <div
                key={r.id}
                onClick={() => navigate(`/costing/reports/${r.id}`)}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-white">
                    <span className="font-medium">{r.code}</span>
                    <span className="text-white/50 text-sm">v{r.version_number}</span>
                  </div>
                  {r.projects && (
                    <p className="text-sm text-white/60 truncate">
                      {r.projects.project_code} — {r.projects.project_name}
                      {r.projects.customer_company_name && (
                        <span className="text-white/40"> · {r.projects.customer_company_name}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {reviewBadge(r.review_status)}
                  {statusBadge(r.status)}
                  <span className="text-xs text-white/50 hidden sm:inline">
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

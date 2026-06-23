import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileText, Plus, Clock, CheckCircle, Send, Receipt, RefreshCw } from 'lucide-react';

interface Stats {
  total: number;
  draft: number;
  sent: number;
  agreed: number;
  invoiced: number;
}

interface RecentReport {
  id: string;
  code: string;
  version_number: number;
  status: string;
  created_at: string;
  projects: { project_code: string; project_name: string } | null;
}

export default function CostingDashboard() {
  const { language } = useLanguage();
  const { hasElevatedRole, hasPermission } = useAuth();
  const navigate = useNavigate();
  const canCreateReport = hasElevatedRole || hasPermission('costing.reports.create');
  const [stats, setStats] = useState<Stats>({ total: 0, draft: 0, sent: 0, agreed: 0, invoiced: 0 });
  const [recent, setRecent] = useState<RecentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const t = (en: string, el: string) => (language === 'el' ? el : en);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: reports } = await supabase
        .from('cost_reports')
        .select('id, code, version_number, status, created_at, projects(project_code, project_name)')
        .order('created_at', { ascending: false });

      if (reports) {
        setStats({
          total: reports.length,
          draft: reports.filter((r) => r.status === 'draft').length,
          sent: reports.filter((r) => r.status === 'sent').length,
          agreed: reports.filter((r) => r.status === 'agreed').length,
          invoiced: reports.filter((r) => r.status === 'invoiced').length,
        });
        setRecent(reports.slice(0, 5) as RecentReport[]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white">
            {t('Costing Dashboard', 'Πίνακας Κοστολόγησης')}
          </h1>
          <p className="text-white/70 mt-1">
            {t('Overview of cost reports', 'Επισκόπηση αναφορών κόστους')}
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">
            {t('Recent Reports', 'Πρόσφατες Αναφορές')}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/costing/reports')} className="text-white/80 hover:text-white">
            {t('View All', 'Όλες')}
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-white/60">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-white/30 mx-auto mb-3" />
            <p className="text-white/70 mb-4">
              {t('No reports yet', 'Δεν υπάρχουν αναφορές ακόμα')}
            </p>
            {canCreateReport && (
              <Button onClick={() => navigate('/costing/new')}>
                <Plus className="h-4 w-4 mr-2" />
                {t('Create first report', 'Δημιουργία πρώτης αναφοράς')}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
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
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
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

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Users, FolderKanban, GitPullRequest } from 'lucide-react';

interface DashboardStats {
  todayEntries: number;
  activeEmployees: number;
  openProjects: number;
  pendingCorrections: number;
}

export default function Dashboard() {
  const { t } = useLanguage();
  const { user, hasElevatedRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    todayEntries: 0,
    activeEmployees: 0,
    openProjects: 0,
    pendingCorrections: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      try {
        // Fetch today's entries
        const { count: entriesCount } = await supabase
          .from('time_entries')
          .select('*', { count: 'exact', head: true })
          .eq('entry_date', today);

        // Fetch active employees
        const { count: employeesCount } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        // Fetch open projects
        const { count: projectsCount } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'OPEN');

        // Fetch pending corrections (only for elevated roles)
        let correctionsCount = 0;
        if (hasElevatedRole) {
          const { count } = await supabase
            .from('correction_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
          correctionsCount = count || 0;
        }

        setStats({
          todayEntries: entriesCount || 0,
          activeEmployees: employeesCount || 0,
          openProjects: projectsCount || 0,
          pendingCorrections: correctionsCount,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [hasElevatedRole]);

  const statCards = [
    {
      label: t('dashboard.todayEntries'),
      value: stats.todayEntries,
      icon: Clock,
      show: true,
    },
    {
      label: t('dashboard.activeEmployees'),
      value: stats.activeEmployees,
      icon: Users,
      show: hasElevatedRole,
    },
    {
      label: t('dashboard.openProjects'),
      value: stats.openProjects,
      icon: FolderKanban,
      show: true,
    },
    {
      label: t('dashboard.pendingCorrections'),
      value: stats.pendingCorrections,
      icon: GitPullRequest,
      show: hasElevatedRole,
    },
  ];

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">{t('nav.dashboard')}</h1>
        <p className="page-subtitle">{t('dashboard.weeklyOverview')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.filter(card => card.show).map((card, index) => (
          <div key={index} className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-label">{card.label}</span>
              <card.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className="stat-value">
              {loading ? '—' : card.value}
            </span>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card-elevated p-6">
        <h2 className="text-lg font-semibold mb-4">{t('common.today')}</h2>
        <p className="text-muted-foreground">
          {t('dashboard.todayEntries')}: {loading ? '—' : stats.todayEntries}
        </p>
      </div>
    </MainLayout>
  );
}

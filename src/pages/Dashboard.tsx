import { useEffect, useState, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { RefreshButton } from '@/components/RefreshButton';
import { Clock, Users, FolderKanban, GitPullRequest } from 'lucide-react';

interface DashboardStats {
  todayEntries: number;
  activeEmployees: number;
  openProjects: number;
  pendingCorrections: number;
}

export default function Dashboard() {
  const { t } = useLanguage();
  const { user, hasElevatedRole, role } = useAuth();
  
  // Timekeeper only flag - for limited view
  const isTimekeeperOnly = role === 'timekeeper' && !hasElevatedRole;
  
  const [stats, setStats] = useState<DashboardStats>({
    todayEntries: 0,
    activeEmployees: 0,
    openProjects: 0,
    pendingCorrections: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    
    setLoading(true);
    try {
      // Fetch today's entries - RLS restricts to own for Timekeeper
      const { count: entriesCount } = await supabase
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .eq('entry_date', today);

      // Only fetch employees/projects count for elevated roles
      let employeesCount = 0;
      let projectsCount = 0;
      
      if (hasElevatedRole) {
        // Fetch active employees
        const { count: empCount } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');
        employeesCount = empCount || 0;
      }

      // Fetch open projects - always visible
      const { count: projCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'OPEN');
      projectsCount = projCount || 0;

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
        activeEmployees: employeesCount,
        openProjects: projectsCount,
        pendingCorrections: correctionsCount,
      });
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [hasElevatedRole]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="page-header mb-0">
          <h1 className="page-title">{t('nav.dashboard')}</h1>
          <p className="page-subtitle">{t('dashboard.weeklyOverview')}</p>
        </div>
        <RefreshButton onRefresh={fetchStats} lastRefresh={lastRefresh} />
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

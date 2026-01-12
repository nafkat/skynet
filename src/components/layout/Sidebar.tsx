import { useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Clock, 
  Users, 
  FolderKanban, 
  Wrench, 
  FileBarChart, 
  Settings,
  LogOut,
  GitPullRequest,
  Globe,
  FileSpreadsheet
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Sidebar() {
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const { signOut, isAdmin, isHR, hasElevatedRole, role } = useAuth();

  // Timekeeper has VERY LIMITED access - only Dashboard and Time Entry
  const isTimekeeperOnly = role === 'timekeeper' && !isAdmin && !isHR;

  const navigationItems = [
    { 
      path: '/admin/dashboard', 
      icon: LayoutDashboard, 
      label: language === 'el' ? 'Διοικητικός Πίνακας' : 'Admin Dashboard',
      show: hasElevatedRole 
    },
    { 
      path: '/dashboard', 
      icon: LayoutDashboard, 
      label: t('nav.dashboard'),
      show: isTimekeeperOnly 
    },
    { 
      path: '/time-entry', 
      icon: Clock, 
      label: t('nav.timeEntry'),
      show: true 
    },
    { 
      path: '/employees', 
      icon: Users, 
      label: t('nav.employees'),
      show: hasElevatedRole 
    },
    { 
      path: '/projects', 
      icon: FolderKanban, 
      label: t('nav.projects'),
      show: hasElevatedRole 
    },
    { 
      path: '/specialties', 
      icon: Wrench, 
      label: t('nav.specialties'),
      show: hasElevatedRole 
    },
    { 
      path: '/corrections', 
      icon: GitPullRequest, 
      label: t('nav.corrections'),
      show: hasElevatedRole 
    },
    { 
      path: '/reports', 
      icon: FileBarChart, 
      label: t('nav.reports'),
      show: hasElevatedRole 
    },
    { 
      path: '/admin/payroll-export', 
      icon: FileSpreadsheet, 
      label: language === 'el' ? 'Εξαγωγή Μισθοδοσίας' : 'Payroll Export',
      show: hasElevatedRole 
    },
    { 
      path: '/settings', 
      icon: Settings, 
      label: t('nav.settings'),
      show: isAdmin 
    },
  ];

  const getRoleLabel = () => {
    if (isAdmin) return t('role.admin');
    if (isHR) return t('role.hr');
    return t('role.timekeeper');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'el' : 'en');
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-72 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-semibold tracking-tight text-sidebar-foreground">
          {t('auth.shipyardSystem')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{getRoleLabel()}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navigationItems.filter(item => item.show).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'nav-item',
                isActive && 'active'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-12 px-4"
          onClick={toggleLanguage}
        >
          <Globe className="h-5 w-5" />
          <span>{language === 'en' ? 'Ελληνικά' : 'English'}</span>
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-12 px-4 text-muted-foreground hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="h-5 w-5" />
          <span>{t('auth.logout')}</span>
        </Button>
      </div>
    </aside>
  );
}

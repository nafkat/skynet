import { useEffect } from 'react';
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
  FileSpreadsheet,
  ClipboardList,
  Home,
  Megaphone,
  Shield,
  MessageSquare
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingCorrections } from '@/hooks/usePendingCorrections';
import { useUnreadMessageCount } from '@/hooks/useEmployeeMessages';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const { signOut, isAdmin, isHR, hasElevatedRole, role } = useAuth();
  const { pendingCount } = usePendingCorrections();
  const { unreadCount: messageUnreadCount } = useUnreadMessageCount();

  // Auto-close on navigation (mobile only)
  useEffect(() => {
    if (window.innerWidth < 768) {
      onClose();
    }
  }, [location.pathname, onClose]);

  const isTimekeeperOnly = role === 'timekeeper' && !isAdmin && !isHR;
  const isHomeContext = location.pathname === '/home' || location.pathname === '/';

  const persistentNavItem = { 
    path: '/home', 
    icon: Home, 
    label: language === 'el' ? 'Αρχική' : 'Home',
    show: true 
  };

  const globalNavItems = [
    { path: '/admin', icon: Shield, label: language === 'el' ? 'Κονσόλα Διαχειριστή' : 'Admin Console', show: isAdmin },
    { path: '/settings', icon: Settings, label: t('nav.settings'), show: isAdmin },
  ];

  const operationsNavItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: language === 'el' ? 'Διοικητικός Πίνακας' : 'Admin Dashboard', show: hasElevatedRole },
    { path: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard'), show: isTimekeeperOnly },
    { path: '/time-entry', icon: Clock, label: t('nav.timeEntry'), show: true },
    { path: '/employees', icon: Users, label: t('nav.employees'), show: hasElevatedRole },
    { path: '/projects', icon: FolderKanban, label: t('nav.projects'), show: hasElevatedRole },
    { path: '/specialties', icon: Wrench, label: t('nav.specialties'), show: hasElevatedRole },
    { path: '/corrections', icon: GitPullRequest, label: t('nav.corrections'), show: hasElevatedRole },
    { path: '/reports', icon: FileBarChart, label: t('nav.reports'), show: hasElevatedRole },
    { path: '/admin/payroll-export', icon: FileSpreadsheet, label: language === 'el' ? 'Εξαγωγή Μισθοδοσίας' : 'Payroll Export', show: hasElevatedRole },
  ];

  const communicationsNavItems = [
    { path: '/announcements', icon: Megaphone, label: language === 'el' ? 'Ανακοινώσεις' : 'Announcements', show: hasElevatedRole },
    { path: '/messages', icon: MessageSquare, label: language === 'el' ? 'Μηνύματα' : 'Messages', show: hasElevatedRole },
  ];

  const systemNavItems = [
    { path: '/admin/audit', icon: ClipboardList, label: language === 'el' ? 'Ημερολόγιο Ελέγχου' : 'Audit Log', show: hasElevatedRole },
  ];

  const contextNavItems = isHomeContext ? globalNavItems : timekeepingNavItems;

  const getRoleLabel = () => {
    if (isAdmin) return language === 'el' ? 'Διαχειριστής' : 'Admin';
    return language === 'el' ? 'Υπάλληλος' : 'Employee';
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'el' : 'en');
  };

  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 z-40 h-screen w-72 bg-sidebar border-r border-sidebar-border flex flex-col',
        'transition-transform duration-300 ease-in-out',
        'md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Header */}
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground">
            SKYNET
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{getRoleLabel()}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
          <Link
            to={persistentNavItem.path}
            className={cn(
              'nav-item',
              location.pathname === persistentNavItem.path && 'active'
            )}
          >
            <persistentNavItem.icon className="h-5 w-5" />
            <span className="font-medium">{persistentNavItem.label}</span>
          </Link>

          <div className="my-2 border-t border-sidebar-border" />

          {contextNavItems.filter(item => item.show).map((item) => {
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
                <span className="font-medium flex items-center gap-2">
                  {item.label}
                  {item.path === '/corrections' && pendingCount > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-destructive rounded-full min-w-[20px]">
                      {pendingCount}
                    </span>
                  )}
                  {item.path === '/messages' && messageUnreadCount > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-destructive rounded-full min-w-[20px] animate-pulse">
                      {messageUnreadCount}
                    </span>
                  )}
                </span>
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
    </>
  );
}

import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { FileText, Globe, Home, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDailyWallpaper } from '@/hooks/useWallpaper';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type NavItem = { to: string; en: string; el: string; icon: LucideIcon; exact?: boolean };

// Module navigation (add future entries here — one line each).
const NAV_ITEMS: NavItem[] = [
  { to: '/projects-hub', en: 'Invoices', el: 'Παραστατικά', icon: FileText },
];

export default function ProjectsHubLayout() {
  const { hasElevatedRole, isActive, loading, signOut } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const wallpaperUrl = useDailyWallpaper();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const handleClose = useCallback(() => setIsSidebarOpen(false), []);
  const t = (en: string, el: string) => (language === 'el' ? el : en);

  useEffect(() => {
    if (window.innerWidth < 768) handleClose();
  }, [location.pathname, handleClose]);

  const isActiveRoute = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t('Loading…', 'Φόρτωση…')}</div>
      </div>
    );
  }
  if (!hasElevatedRole || !isActive) return <Navigate to="/home" replace />;

  return (
    <div
      className="flex min-h-screen relative"
      style={{
        backgroundImage: `url(${wallpaperUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/60 z-0" />

      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        aria-label={t('Menu', 'Μενού')}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isSidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={handleClose} />}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-72 bg-black/40 backdrop-blur-md border-r border-sidebar-border/50 flex flex-col',
          'transition-transform duration-300 ease-in-out',
          'md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground">SKYNET</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('Projects Hub', 'Κέντρο Έργων')}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
          <Link to="/home" className="nav-item mb-4">
            <Home className="h-5 w-5" />
            <span className="font-medium">{t('Home', 'Αρχική')}</span>
          </Link>
          <div className="border-t border-sidebar-border my-4" />
          {NAV_ITEMS.map(({ to, en, el, icon: Icon, exact }) => (
            <Link key={to} to={to} className={cn('nav-item', isActiveRoute(to, exact) && 'active')}>
              <Icon className="h-5 w-5" />
              <span className="font-medium">{t(en, el)}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-12 px-4"
            onClick={() => setLanguage(language === 'en' ? 'el' : 'en')}
          >
            <Globe className="h-5 w-5" />
            <span>{language === 'en' ? 'Ελληνικά' : 'English'}</span>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-12 px-4"
            onClick={async () => { await signOut(); navigate('/login'); }}
          >
            <LogOut className="h-5 w-5" />
            <span>{t('Logout', 'Αποσύνδεση')}</span>
          </Button>
        </div>
      </aside>

      <main className="flex-1 md:ml-72 relative z-10 min-w-0 overflow-x-hidden">
        <div className="p-3 sm:p-6 pt-16 md:pt-6 min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDailyWallpaper } from '@/hooks/useWallpaper';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Plus,
  Home,
  LogOut,
  Globe,
  Menu,
  X,
  LayoutDashboard,
  Trash2,
} from 'lucide-react';
import CostingNotificationsBell from '@/components/costing/CostingNotificationsBell';

export default function CostingLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, hasElevatedRole, hasPermission, isAdmin, loading } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const handleClose = useCallback(() => setIsSidebarOpen(false), []);

  const hasAccess = hasElevatedRole || hasPermission('module.costing');
  const canCreateReport = hasElevatedRole || hasPermission('costing.reports.create');

  useEffect(() => {
    if (!loading && !hasAccess) {
      navigate('/home');
    }
  }, [loading, hasAccess, navigate]);

  useEffect(() => {
    if (window.innerWidth < 768) handleClose();
  }, [location.pathname, handleClose]);

  const toggleLanguage = () => setLanguage(language === 'en' ? 'el' : 'en');

  const isActiveRoute = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!hasAccess) return null;

  const wallpaperUrl = getDailyWallpaper();

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
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={handleClose} />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-72 bg-black/40 backdrop-blur-md border-r border-sidebar-border/50 flex flex-col',
          'transition-transform duration-300 ease-in-out',
          'md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground">SKYNET</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {language === 'el' ? 'Κοστολόγηση' : 'Costing'}
              </p>
            </div>
            <CostingNotificationsBell />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
          <Link to="/home" className="nav-item mb-4">
            <Home className="h-5 w-5" />
            <span className="font-medium">{language === 'el' ? 'Αρχική' : 'Home'}</span>
          </Link>

          <div className="border-t border-sidebar-border my-4" />

          <Link
            to="/costing"
            className={cn('nav-item', isActiveRoute('/costing', true) && 'active')}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="font-medium">
              {language === 'el' ? 'Πίνακας' : 'Dashboard'}
            </span>
          </Link>

          <Link
            to="/costing/reports"
            className={cn('nav-item', isActiveRoute('/costing/reports') && 'active')}
          >
            <FileText className="h-5 w-5" />
            <span className="font-medium">
              {language === 'el' ? 'Αναφορές' : 'Reports'}
            </span>
          </Link>

          {canCreateReport && (
            <Link
              to="/costing/new"
              className={cn('nav-item', isActiveRoute('/costing/new') && 'active')}
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">
                {language === 'el' ? 'Νέα Αναφορά' : 'New Report'}
              </span>
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/costing/trash"
              className={cn('nav-item', isActiveRoute('/costing/trash') && 'active')}
            >
              <Trash2 className="h-5 w-5" />
              <span className="font-medium">
                {language === 'el' ? 'Κάδος' : 'Trash'}
              </span>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <Button variant="ghost" className="w-full justify-start gap-3 h-12 px-4" onClick={toggleLanguage}>
            <Globe className="h-5 w-5" />
            <span>{language === 'en' ? 'Ελληνικά' : 'English'}</span>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-12 px-4 text-muted-foreground hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
            <span>{language === 'el' ? 'Αποσύνδεση' : 'Logout'}</span>
          </Button>
        </div>
      </aside>

      <main className="flex-1 md:ml-72 relative z-10">
        <div className="absolute top-4 right-6 z-20">
          <CostingNotificationsBell />
        </div>
        <div className="p-6 pt-16 md:pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

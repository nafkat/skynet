import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDailyWallpaper } from '@/hooks/useWallpaper';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  FileStack,
  ClipboardList,
  Home,
  LogOut,
  Globe,
  Shield,
  Menu,
  X,
  Building2
} from 'lucide-react';

const navigationItems = [
  { path: '/admin', icon: Users, labelEn: 'Users', labelEl: 'Χρήστες', exact: true },
  { path: '/admin/templates', icon: FileStack, labelEn: 'Roles', labelEl: 'Ρόλοι' },
  { path: '/admin/companies', icon: Building2, labelEn: 'Companies', labelEl: 'Εταιρίες' },
  { path: '/admin/audit', icon: ClipboardList, labelEn: 'Audit', labelEl: 'Έλεγχος' },
];


export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin, loading } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pendingDevices, setPendingDevices] = useState(0);
  const handleClose = useCallback(() => setIsSidebarOpen(false), []);

  useEffect(() => {
    const fetchPending = async () => {
      const { count } = await supabase
        .from('trusted_devices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingDevices(count || 0);
    };
    fetchPending();

    const channel = supabase
      .channel('pending_devices_badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trusted_devices' }, fetchPending)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/home');
    }
  }, [loading, isAdmin, navigate]);

  // Auto-close on navigation (mobile)
  useEffect(() => {
    if (window.innerWidth < 768) {
      handleClose();
    }
  }, [location.pathname, handleClose]);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'el' : 'en');
  };

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

  if (!isAdmin) return null;

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
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60 z-0" />
      {/* Hamburger button - mobile only */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Backdrop overlay for mobile */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={handleClose} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 z-40 h-screen w-72 bg-black/40 backdrop-blur-md border-r border-sidebar-border/50 flex flex-col',
        'transition-transform duration-300 ease-in-out',
        'md:translate-x-0',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground">SKYNET</h1>
              <p className="text-sm text-muted-foreground">
                {language === 'el' ? 'Κονσόλα Διαχειριστή' : 'Admin Console'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
          <Link to="/home" className="nav-item mb-4">
            <Home className="h-5 w-5" />
            <span className="font-medium">{language === 'el' ? 'Αρχική' : 'Home'}</span>
          </Link>
          
          <div className="border-t border-sidebar-border my-4" />
          
          {navigationItems.map((item) => {
            const isActive = isActiveRoute(item.path, item.exact);
            const showBadge = item.path === '/admin/devices' && pendingDevices > 0;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn('nav-item', isActive && 'active')}
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium flex-1">
                  {language === 'el' ? item.labelEl : item.labelEn}
                </span>
                {showBadge && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-yellow-500 text-white text-xs font-semibold">
                    {pendingDevices}
                  </span>
                )}
              </Link>
            );
          })}
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

      {/* Main Content */}
      <main className="flex-1 md:ml-72 relative z-10">
        <div className="p-6 pt-16 md:pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Send,
  Users,
  FileBarChart,
  Home,
  LogOut,
  Globe,
  Menu,
  X,
  LayoutDashboard
} from 'lucide-react';

export default function ProcurementLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin, loading } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const handleClose = useCallback(() => setIsSidebarOpen(false), []);

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

  return (
    <div className="flex min-h-screen bg-background">
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
        'fixed left-0 top-0 z-40 h-screen w-72 bg-sidebar border-r border-sidebar-border flex flex-col',
        'transition-transform duration-300 ease-in-out',
        'md:translate-x-0',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground">SKYNET</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === 'el' ? 'Προμήθειες' : 'Procurement'}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
          <Link to="/home" className="nav-item mb-4">
            <Home className="h-5 w-5" />
            <span className="font-medium">{language === 'el' ? 'Αρχική' : 'Home'}</span>
          </Link>

          <div className="border-t border-sidebar-border my-4" />

          <Link
            to="/procurement/dashboard"
            className={cn('nav-item', isActiveRoute('/procurement/dashboard', true) && 'active')}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="font-medium">
              {language === 'el' ? 'Πίνακας' : 'Dashboard'}
            </span>
          </Link>

          <Link
            to="/procurement/request-offers"
            className={cn('nav-item', isActiveRoute('/procurement/request-offers') && 'active')}
          >
            <Send className="h-5 w-5" />
            <span className="font-medium">
              {language === 'el' ? 'Αίτημα Προσφοράς' : 'Request Offer'}
            </span>
          </Link>

          <Link
            to="/procurement/suppliers"
            className={cn('nav-item', isActiveRoute('/procurement/suppliers') && 'active')}
          >
            <Users className="h-5 w-5" />
            <span className="font-medium">
              {language === 'el' ? 'Προμηθευτές / Υπεργολάβοι' : 'Suppliers / Subcontractors'}
            </span>
          </Link>

          <Link
            to="/procurement/reports"
            className={cn('nav-item', isActiveRoute('/procurement/reports') && 'active')}
          >
            <FileBarChart className="h-5 w-5" />
            <span className="font-medium">
              {language === 'el' ? 'Αναφορές' : 'Reports'}
            </span>
          </Link>
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
      <main className="flex-1 md:ml-72">
        <div className="p-6 pt-16 md:pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  FileText,
  Send,
  ShoppingCart,
  Package,
  Users,
  FileBarChart,
  Home,
  LogOut,
  Globe,
  Plus
} from 'lucide-react';

export default function ProcurementLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin, loading } = useAuth();
  const { language, setLanguage } = useLanguage();

  // Redirect non-admin users
  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/home');
    }
  }, [loading, isAdmin, navigate]);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'el' : 'en');
  };

  const isActiveRoute = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-72 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground">
            SKYNET
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === 'el' ? 'Προμήθειες' : 'Procurement'}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
          {/* Back to Home */}
          <Link
            to="/home"
            className="nav-item mb-2"
          >
            <Home className="h-5 w-5" />
            <span className="font-medium">{language === 'el' ? 'Αρχική' : 'Home'}</span>
          </Link>
          
          {/* Dashboard - small link */}
          <Link
            to="/procurement"
            className={cn(
              'nav-item text-sm',
              isActiveRoute('/procurement', true) && 'active'
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>{language === 'el' ? 'Πίνακας Ελέγχου' : 'Dashboard'}</span>
          </Link>

          <div className="border-t border-sidebar-border my-4" />

          {/* ACTIONS Section */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
              {language === 'el' ? 'Ενέργειες' : 'Actions'}
            </p>
            <Link
              to="/procurement/purchase-requests?action=new"
              className="nav-item bg-primary/10 hover:bg-primary/20 text-primary mb-1"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">
                {language === 'el' ? 'Νέο Αίτημα Αγοράς' : 'New Purchase Request'}
              </span>
            </Link>
            <Link
              to="/procurement/purchase-requests"
              className={cn(
                'nav-item',
                isActiveRoute('/procurement/purchase-requests') && 'active'
              )}
            >
              <FileText className="h-5 w-5" />
              <span className="font-medium">
                {language === 'el' ? 'Αιτήματα Αγορών' : 'Purchase Requests'}
              </span>
            </Link>
          </div>

          <div className="border-t border-sidebar-border my-4" />

          {/* OPERATIONS Section */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
              {language === 'el' ? 'Λειτουργίες' : 'Operations'}
            </p>
            <Link
              to="/procurement/rfqs"
              className={cn(
                'nav-item',
                isActiveRoute('/procurement/rfqs') && 'active'
              )}
            >
              <Send className="h-5 w-5" />
              <span className="font-medium">RFQs</span>
            </Link>
            <Link
              to="/procurement/purchase-orders"
              className={cn(
                'nav-item',
                isActiveRoute('/procurement/purchase-orders') && 'active'
              )}
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="font-medium">
                {language === 'el' ? 'Εντολές Αγοράς' : 'Purchase Orders'}
              </span>
            </Link>
            <Link
              to="/procurement/receiving"
              className={cn(
                'nav-item',
                isActiveRoute('/procurement/receiving') && 'active'
              )}
            >
              <Package className="h-5 w-5" />
              <span className="font-medium">
                {language === 'el' ? 'Παραλαβή / Αποδοχή' : 'Receiving / Acceptance'}
              </span>
            </Link>
          </div>

          <div className="border-t border-sidebar-border my-4" />

          {/* MANAGEMENT Section */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
              {language === 'el' ? 'Διαχείριση' : 'Management'}
            </p>
            <Link
              to="/procurement/suppliers"
              className={cn(
                'nav-item',
                isActiveRoute('/procurement/suppliers') && 'active'
              )}
            >
              <Users className="h-5 w-5" />
              <span className="font-medium">
                {language === 'el' ? 'Προμηθευτές' : 'Suppliers'}
              </span>
            </Link>
            <Link
              to="/procurement/reports"
              className={cn(
                'nav-item',
                isActiveRoute('/procurement/reports') && 'active'
              )}
            >
              <FileBarChart className="h-5 w-5" />
              <span className="font-medium">
                {language === 'el' ? 'Αναφορές' : 'Reports'}
              </span>
            </Link>
          </div>
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
            <span>{language === 'el' ? 'Αποσύνδεση' : 'Logout'}</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

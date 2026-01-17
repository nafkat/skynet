import { Outlet, Link, useLocation } from 'react-router-dom';
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
  Globe
} from 'lucide-react';

const navigationItems = [
  { path: '/procurement', icon: LayoutDashboard, labelEn: 'Dashboard', labelEl: 'Πίνακας Ελέγχου', exact: true },
  { path: '/procurement/purchase-requests', icon: FileText, labelEn: 'Purchase Requests', labelEl: 'Αιτήματα Αγορών' },
  { path: '/procurement/rfqs', icon: Send, labelEn: 'RFQs', labelEl: 'Αιτήματα Προσφορών' },
  { path: '/procurement/purchase-orders', icon: ShoppingCart, labelEn: 'Purchase Orders', labelEl: 'Εντολές Αγοράς' },
  { path: '/procurement/receiving', icon: Package, labelEn: 'Receiving / Acceptance', labelEl: 'Παραλαβή / Αποδοχή' },
  { path: '/procurement/suppliers', icon: Users, labelEn: 'Suppliers', labelEl: 'Προμηθευτές' },
  { path: '/procurement/reports', icon: FileBarChart, labelEn: 'Reports', labelEl: 'Αναφορές' },
];

export default function ProcurementLayout() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'el' : 'en');
  };

  const isActiveRoute = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

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
            className="nav-item mb-4"
          >
            <Home className="h-5 w-5" />
            <span className="font-medium">{language === 'el' ? 'Αρχική' : 'Home'}</span>
          </Link>
          
          <div className="border-t border-sidebar-border my-4" />
          
          {navigationItems.map((item) => {
            const isActive = isActiveRoute(item.path, item.exact);
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
                <span className="font-medium">
                  {language === 'el' ? item.labelEl : item.labelEn}
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

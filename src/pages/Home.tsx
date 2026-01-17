import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Clock, 
  ClipboardList, 
  Megaphone, 
  Calculator, 
  FolderKanban, 
  ShoppingCart, 
  Shield,
  LogOut,
  Globe,
  Home as HomeIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ModuleStatus = 'active' | 'coming_soon';

interface ModuleTile {
  id: string;
  title: string;
  titleEl: string;
  description: string;
  descriptionEl: string;
  icon: React.ElementType;
  status: ModuleStatus;
  route: string;
  visibleTo: ('admin' | 'hr' | 'timekeeper')[];
}

const modules: ModuleTile[] = [
  {
    id: 'timekeeping',
    title: 'Timekeeping',
    titleEl: 'Χρονοκαταγραφή',
    description: 'Record work hours by employee & project. Payroll-ready reports.',
    descriptionEl: 'Καταγραφή ωρών εργασίας ανά εργαζόμενο & έργο. Έτοιμες αναφορές μισθοδοσίας.',
    icon: Clock,
    status: 'active',
    route: '/time-entry',
    visibleTo: ['admin', 'hr', 'timekeeper'],
  },
  {
    id: 'audit',
    title: 'Audit Log',
    titleEl: 'Ημερολόγιο Ελέγχου',
    description: 'Enterprise audit trail (who / what / when).',
    descriptionEl: 'Επιχειρησιακό ιστορικό ελέγχου (ποιος / τι / πότε).',
    icon: ClipboardList,
    status: 'active',
    route: '/admin/audit-log',
    visibleTo: ['admin', 'hr'],
  },
  {
    id: 'announcements',
    title: 'Announcements',
    titleEl: 'Ανακοινώσεις',
    description: 'Internal announcements to employees via Viber (Phase 1).',
    descriptionEl: 'Εσωτερικές ανακοινώσεις σε εργαζόμενους μέσω Viber (Φάση 1).',
    icon: Megaphone,
    status: 'active',
    route: '/announcements',
    visibleTo: ['admin', 'hr'],
  },
  {
    id: 'costing',
    title: 'Costing',
    titleEl: 'Κοστολόγηση',
    description: 'Costing, estimations & job budgets.',
    descriptionEl: 'Κοστολόγηση, εκτιμήσεις & προϋπολογισμοί έργων.',
    icon: Calculator,
    status: 'coming_soon',
    route: '/costing',
    visibleTo: ['admin', 'hr'],
  },
  {
    id: 'projects-hub',
    title: 'Projects Hub',
    titleEl: 'Κέντρο Έργων',
    description: 'Central project dashboard, documents & progress.',
    descriptionEl: 'Κεντρικός πίνακας έργων, έγγραφα & πρόοδος.',
    icon: FolderKanban,
    status: 'coming_soon',
    route: '/projects-hub',
    visibleTo: ['admin', 'hr'],
  },
  {
    id: 'procurement',
    title: 'Procurement',
    titleEl: 'Προμήθειες',
    description: 'Purchase requests, approvals & supplier tracking.',
    descriptionEl: 'Αιτήματα αγορών, εγκρίσεις & παρακολούθηση προμηθευτών.',
    icon: ShoppingCart,
    status: 'coming_soon',
    route: '/procurement',
    visibleTo: ['admin', 'hr'],
  },
  {
    id: 'hse',
    title: 'HSE',
    titleEl: 'ΥΑΕ',
    description: 'Safety, incident reporting & compliance.',
    descriptionEl: 'Ασφάλεια, αναφορά συμβάντων & συμμόρφωση.',
    icon: Shield,
    status: 'coming_soon',
    route: '/hse',
    visibleTo: ['admin', 'hr'],
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { user, role, signOut, isAdmin, isHR, loading } = useAuth();
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'el' : 'en');
  };

  const getRoleBadgeVariant = () => {
    if (isAdmin) return 'default';
    if (isHR) return 'secondary';
    return 'outline';
  };

  const getRoleLabel = () => {
    if (isAdmin) return language === 'el' ? 'Διαχειριστής' : 'Admin';
    if (isHR) return 'HR';
    return language === 'el' ? 'Χρονομέτρης' : 'Timekeeper';
  };

  const handleTileClick = (tile: ModuleTile) => {
    if (tile.status === 'coming_soon') {
      toast.info(language === 'el' ? 'Σύντομα διαθέσιμο' : 'Coming soon');
      return;
    }
    navigate(tile.route);
  };

  // Filter modules based on role
  const visibleModules = modules.filter((module) => {
    if (!role) return false;
    return module.visibleTo.includes(role);
  });

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // No role configured
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <div className="text-destructive text-lg font-medium">
            {language === 'el' 
              ? 'Ο ρόλος πρόσβασης δεν έχει ρυθμιστεί.' 
              : 'Access role not configured.'}
          </div>
          <p className="text-muted-foreground">
            {language === 'el' 
              ? 'Επικοινωνήστε με τον Διαχειριστή.' 
              : 'Contact Admin.'}
          </p>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            {language === 'el' ? 'Αποσύνδεση' : 'Logout'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
                <HomeIcon className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">SKYNET</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {language === 'el' ? 'Πλατφόρμα Λειτουργιών Ναυπηγείου' : 'Shipyard Operations Platform'}
                </p>
              </div>
            </div>

            {/* Breadcrumb - Center */}
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <HomeIcon className="h-4 w-4" />
              <span>/</span>
              <span className="text-foreground font-medium">
                {language === 'el' ? 'Αρχική' : 'Home'}
              </span>
            </div>

            {/* User & Actions - Right */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleLanguage}
                className="hidden sm:flex"
              >
                <Globe className="h-4 w-4 mr-2" />
                {language === 'en' ? 'EL' : 'EN'}
              </Button>

              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
                    {user?.email}
                  </p>
                </div>
                <Badge variant={getRoleBadgeVariant()} className="shrink-0">
                  {getRoleLabel()}
                </Badge>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Page Title */}
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            {language === 'el' ? 'Καλώς ήρθατε στο SKYNET' : 'Welcome to SKYNET'}
          </h2>
          <p className="text-muted-foreground text-lg">
            {language === 'el' 
              ? 'Επιλέξτε μια ενότητα για να ξεκινήσετε' 
              : 'Select a module to get started'}
          </p>
        </div>

        {/* Module Tiles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleModules.map((tile) => {
            const isActive = tile.status === 'active';
            const Icon = tile.icon;

            return (
              <button
                key={tile.id}
                onClick={() => handleTileClick(tile)}
                disabled={!isActive}
                className={cn(
                  'group relative flex flex-col items-start p-6 rounded-xl border text-left transition-all duration-200',
                  isActive
                    ? 'bg-card border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer'
                    : 'bg-muted/30 border-border/50 cursor-not-allowed opacity-60'
                )}
              >
                {/* Status Badge */}
                <Badge
                  variant={isActive ? 'default' : 'secondary'}
                  className={cn(
                    'absolute top-4 right-4 text-xs',
                    isActive ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''
                  )}
                >
                  {isActive 
                    ? (language === 'el' ? 'Ενεργό' : 'Active')
                    : (language === 'el' ? 'Σύντομα' : 'Coming soon')}
                </Badge>

                {/* Icon */}
                <div
                  className={cn(
                    'flex items-center justify-center w-12 h-12 rounded-lg mb-4 transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>

                {/* Title */}
                <h3 className={cn(
                  'text-lg font-semibold mb-2',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {language === 'el' ? tile.titleEl : tile.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {language === 'el' ? tile.descriptionEl : tile.description}
                </p>

                {/* Hover indicator for active tiles */}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-xl" />
                )}
              </button>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-muted-foreground">
            SKYNET © {new Date().getFullYear()} — {language === 'el' ? 'Πλατφόρμα Λειτουργιών Ναυπηγείου' : 'Shipyard Operations Platform'}
          </p>
        </div>
      </footer>
    </div>
  );
}

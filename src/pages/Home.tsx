import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Clock, 
  Megaphone, 
  Calculator, 
  FolderKanban, 
  ShoppingCart, 
  Shield,
  LogOut,
  Globe,
  Home as HomeIcon,
  Settings,
  Lock,
  MessageSquare,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';


type ModuleStatus = 'active' | 'coming_soon';
type ModuleSection = 'operations' | 'communications' | 'system';

interface ModuleTile {
  id: string;
  title: string;
  titleEl: string;
  description: string;
  descriptionEl: string;
  icon: React.ElementType;
  status: ModuleStatus;
  route: string;
  permissionKey: string; // e.g., "module.timekeeping"
  section: ModuleSection;
  adminOnly?: boolean; // If true, only visible to base_role=admin
}

const modules: ModuleTile[] = [
  // ===== OPERATIONS SECTION =====
  {
    id: 'timekeeping',
    title: 'Timekeeping',
    titleEl: 'Χρονοκαταγραφή',
    description: 'Record work hours by employee & project. Payroll-ready reports.',
    descriptionEl: 'Καταγραφή ωρών εργασίας ανά εργαζόμενο & έργο. Έτοιμες αναφορές μισθοδοσίας.',
    icon: Clock,
    status: 'active',
    route: '/admin/dashboard',
    permissionKey: 'module.timekeeping',
    section: 'operations',
  },
  {
    id: 'procurement',
    title: 'Procurement',
    titleEl: 'Προμήθειες',
    description: 'Purchase requests, RFQs, offers & supplier tracking.',
    descriptionEl: 'Αιτήματα αγορών, RFQs, προσφορές & παρακολούθηση προμηθευτών.',
    icon: ShoppingCart,
    status: 'active',
    route: '/procurement',
    permissionKey: 'module.procurement',
    section: 'operations',
  },
  // ===== COMMUNICATIONS SECTION =====
  {
    id: 'announcements',
    title: 'Announcements',
    titleEl: 'Ανακοινώσεις',
    description: 'Internal announcements to employees via Telegram.',
    descriptionEl: 'Εσωτερικές ανακοινώσεις σε εργαζόμενους μέσω Telegram.',
    icon: Megaphone,
    status: 'active',
    route: '/announcements',
    permissionKey: 'module.announcements',
    section: 'communications',
  },
  {
    id: 'messages',
    title: 'Messages',
    titleEl: 'Μηνύματα',
    description: 'Two-way messaging with employees via Telegram.',
    descriptionEl: 'Αμφίδρομη επικοινωνία με εργαζόμενους μέσω Telegram.',
    icon: MessageSquare,
    status: 'active',
    route: '/messages',
    permissionKey: 'module.announcements',
    section: 'communications',
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
    permissionKey: 'module.costing',
    section: 'operations',
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
    permissionKey: 'module.projects_hub',
    section: 'operations',
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
    permissionKey: 'module.hse',
    section: 'operations',
  },
  // ===== SYSTEM SECTION (ADMIN ONLY) =====
  {
    id: 'admin_console',
    title: 'Admin Console',
    titleEl: 'Κονσόλα Διαχειριστή',
    description: 'Users, permissions, templates, audit.',
    descriptionEl: 'Χρήστες, δικαιώματα, πρότυπα, έλεγχος.',
    icon: Settings,
    status: 'active',
    route: '/admin',
    permissionKey: 'module.admin_console',
    section: 'system',
    adminOnly: true, // Only visible to base_role=admin
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { user, baseRole, signOut, isAdmin, loading, isActive, hasPermission, hasElevatedRole } = useAuth();
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'el' : 'en');
  };

  const getRoleBadgeVariant = () => {
    if (isAdmin) return 'default';
    return 'secondary';
  };

  const getRoleLabel = () => {
    if (isAdmin) return language === 'el' ? 'Διαχειριστής' : 'Admin';
    return language === 'el' ? 'Υπάλληλος' : 'Employee';
  };

  const handleTileClick = (tile: ModuleTile, hasAccess: boolean) => {
    if (tile.status === 'coming_soon') {
      toast.info(language === 'el' ? 'Σύντομα διαθέσιμο' : 'Coming soon');
      return;
    }
    
    if (!hasAccess) {
      toast.error(language === 'el' ? 'Δεν έχετε πρόσβαση σε αυτό το module' : 'You do not have access to this module');
      return;
    }
    
    // Timekeeping: admins/HR go to admin dashboard, timekeepers go to time entry
    if (tile.id === 'timekeeping' && !hasElevatedRole) {
      navigate('/time-entry');
      return;
    }
    
    navigate(tile.route);
  };

  // Filter modules: 
  // - adminOnly modules are hidden completely for non-admin users
  // - Other modules are shown but may be locked
  const visibleModules = modules.filter((module) => {
    if (module.adminOnly && !isAdmin) {
      return false; // Hide admin-only modules completely from non-admin users
    }
    return true;
  });

  // Group by section
  const operationsModules = visibleModules.filter(m => m.section === 'operations');
  const communicationsModules = visibleModules.filter(m => m.section === 'communications');
  const systemModules = visibleModules.filter(m => m.section === 'system');

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // User is inactive
  if (!isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 p-8 max-w-md">
          <div className="text-destructive text-lg font-medium">
            {language === 'el' 
              ? 'Ο λογαριασμός σας είναι ανενεργός.' 
              : 'Your account is inactive.'}
          </div>
          <p className="text-muted-foreground">
            {language === 'el' 
              ? 'Επικοινωνήστε με τον Διαχειριστή.' 
              : 'Contact Administrator.'}
          </p>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            {language === 'el' ? 'Αποσύνδεση' : 'Logout'}
          </Button>
        </div>
      </div>
    );
  }

  // No base role configured (shouldn't happen but handle gracefully)
  if (!baseRole) {
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

  const renderTile = (tile: ModuleTile) => {
    const isModuleActive = tile.status === 'active';
    const hasAccess = hasPermission(tile.permissionKey);
    const isLocked = isModuleActive && !hasAccess;
    const Icon = tile.icon;

    return (
      <button
        key={tile.id}
        onClick={() => handleTileClick(tile, hasAccess)}
        disabled={!isModuleActive || isLocked}
        className={cn(
          'group relative flex flex-col items-start p-6 rounded-xl border text-left transition-all duration-200',
          isModuleActive && hasAccess
            ? 'bg-card border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer'
            : isLocked
            ? 'bg-muted/50 border-border/50 cursor-not-allowed'
            : 'bg-muted/30 border-border/50 cursor-not-allowed opacity-60'
        )}
      >
        {/* Status Badge */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {isLocked && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              <Lock className="h-3 w-3" />
              <span>{language === 'el' ? 'Κλειδωμένο' : 'Locked'}</span>
            </div>
          )}
          {!isLocked && (
            <Badge
              variant={isModuleActive ? 'default' : 'secondary'}
              className={cn(
                'text-xs',
                isModuleActive && hasAccess ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''
              )}
            >
              {isModuleActive 
                ? (language === 'el' ? 'Ενεργό' : 'Active')
                : (language === 'el' ? 'Σύντομα' : 'Coming soon')}
            </Badge>
          )}
        </div>

        {/* Icon */}
        <div
          className={cn(
            'flex items-center justify-center w-12 h-12 rounded-lg mb-4 transition-colors',
            isModuleActive && hasAccess
              ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {isLocked ? (
            <Lock className="h-6 w-6" />
          ) : (
            <Icon className="h-6 w-6" />
          )}
        </div>

        {/* Title */}
        <h3 className={cn(
          'text-lg font-semibold mb-2',
          isModuleActive && hasAccess ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {language === 'el' ? tile.titleEl : tile.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {language === 'el' ? tile.descriptionEl : tile.description}
        </p>

        {/* Hover indicator for active tiles with access */}
        {isModuleActive && hasAccess && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-xl" />
        )}
      </button>
    );
  };

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
          <h2 className="text-3xl sm:text-5xl font-bold mb-3 bg-gradient-to-r from-primary via-orange-400 to-primary bg-[length:200%_auto] animate-[gradient-shift_3s_ease-in-out_infinite] bg-clip-text text-transparent drop-shadow-sm">
            {language === 'el' ? 'Καλώς ήρθατε στο SKYNET' : 'Welcome to SKYNET'}
          </h2>
          <p className="text-muted-foreground text-lg animate-fade-in">
            {language === 'el' 
              ? 'Επιλέξτε μια ενότητα για να ξεκινήσετε' 
              : 'Select a module to get started'}
          </p>
        </div>

        {/* Operations Section */}
        {operationsModules.length > 0 && (
          <section className="mb-12">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              {language === 'el' ? 'Λειτουργίες' : 'Operations'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {operationsModules.map(renderTile)}
            </div>
          </section>
        )}

        {/* Communications Section */}
        {communicationsModules.length > 0 && (
          <section className="mb-12">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              {language === 'el' ? 'Επικοινωνίες' : 'Communications'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {communicationsModules.map(renderTile)}
            </div>
          </section>
        )}

        {/* System Section (Admin Only) */}
        {systemModules.length > 0 && (
          <section className="mb-12">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              {language === 'el' ? 'Σύστημα' : 'System'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {systemModules.map(renderTile)}
            </div>
          </section>
        )}
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

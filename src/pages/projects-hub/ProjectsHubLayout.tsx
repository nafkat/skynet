import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { FolderKanban, Globe, Home, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

export default function ProjectsHubLayout() {
  const { hasElevatedRole, isActive, loading, signOut } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const t = (en: string, el: string) => language === 'el' ? el : en;
  if (loading) return <div className="p-8 text-muted-foreground">{t('Loading…', 'Φόρτωση…')}</div>;
  if (!hasElevatedRole || !isActive) return <Navigate to="/home" replace />;
  return <div className="min-h-screen bg-background">
    <header className="border-b bg-card sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0"><FolderKanban className="h-6 w-6 text-primary shrink-0" /><div><h1 className="text-lg font-semibold">SKYNET</h1><p className="text-sm text-muted-foreground">{t('Projects Hub', 'Κέντρο Έργων')}</p></div></div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" title={t('Home', 'Αρχική')} aria-label={t('Home', 'Αρχική')} onClick={() => navigate('/home')}><Home className="h-5 w-5" /></Button>
          <Button variant="ghost" size="sm" title={t('Change language', 'Αλλαγή γλώσσας')} onClick={() => setLanguage(language === 'en' ? 'el' : 'en')}><Globe className="h-4 w-4 mr-1" />{language === 'en' ? 'EL' : 'EN'}</Button>
          <Button variant="ghost" size="icon" title={t('Logout', 'Αποσύνδεση')} aria-label={t('Logout', 'Αποσύνδεση')} onClick={async () => { await signOut(); navigate('/login'); }}><LogOut className="h-5 w-5" /></Button>
        </div>
      </div>
    </header>
    <main className="max-w-7xl mx-auto p-4 sm:p-6"><Outlet /></main>
  </div>;
}
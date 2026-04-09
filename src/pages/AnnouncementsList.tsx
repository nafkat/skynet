import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import { el as elLocale } from 'date-fns/locale';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Megaphone, Eye, Loader2, Archive, ArchiveRestore, CalendarIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';

interface Announcement {
  id: string;
  title: string;
  message: string;
  status: 'draft' | 'pending' | 'sent' | 'partial' | 'failed';
  created_by: string;
  created_at: string;
  sent_at: string | null;
  recipients_count?: number;
  archived_at?: string | null;
}

interface Profile {
  user_id: string;
  full_name: string | null;
}

export default function AnnouncementsList() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [archivedAnnouncements, setArchivedAnnouncements] = useState<Announcement[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [archiveTarget, setArchiveTarget] = useState<Announcement | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = useState<Announcement | null>(null);
  const [viewTab, setViewTab] = useState('active');

  const t = (en: string, el: string) => (language === 'el' ? el : en);

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Build active query
      let activeQuery = supabase
        .from('announcements')
        .select('id, title, message, status, created_by, created_at, sent_at, is_archived')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (dateFrom) {
        activeQuery = activeQuery.gte('created_at', startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        activeQuery = activeQuery.lte('created_at', endOfDay(dateTo).toISOString());
      }

      const { data: activeData, error: activeError } = await activeQuery;
      if (activeError) throw activeError;

      // Build archived query
      let archivedQuery = supabase
        .from('announcements')
        .select('id, title, message, status, created_by, created_at, sent_at, is_archived, archived_at')
        .eq('is_archived', true)
        .order('archived_at', { ascending: false });

      if (dateFrom) {
        archivedQuery = archivedQuery.gte('created_at', startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        archivedQuery = archivedQuery.lte('created_at', endOfDay(dateTo).toISOString());
      }

      const { data: archivedData, error: archivedError } = await archivedQuery;
      if (archivedError) throw archivedError;

      // Fetch recipient counts
      const allIds = [...(activeData || []), ...(archivedData || [])].map(a => a.id);
      let recipientCounts: Record<string, number> = {};
      
      if (allIds.length > 0) {
        const { data: recipientsData, error: recipientsError } = await supabase
          .from('announcement_recipients')
          .select('announcement_id')
          .in('announcement_id', allIds);

        if (!recipientsError && recipientsData) {
          recipientCounts = recipientsData.reduce((acc, r) => {
            acc[r.announcement_id] = (acc[r.announcement_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      // Fetch profiles
      const userIds = [...new Set([...(activeData || []), ...(archivedData || [])].map(a => a.created_by))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        setProfiles(profilesData || []);
      }

      const enrich = (list: any[]) => list.map(a => ({
        ...a,
        recipients_count: recipientCounts[a.id] || 0,
      }));

      setAnnouncements(enrich(activeData || []));
      setArchivedAnnouncements(enrich(archivedData || []));
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error(t('Failed to load announcements', 'Αποτυχία φόρτωσης ανακοινώσεων'));
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.full_name || userId.slice(0, 8) + '...';
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'sent': return 'default';
      case 'pending': return 'secondary';
      case 'partial': return 'outline';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return t('Draft', 'Πρόχειρο');
      case 'pending': return t('Pending', 'Εκκρεμεί');
      case 'sent': return t('Sent', 'Απεστάλη');
      case 'partial': return t('Partial', 'Μερική');
      case 'failed': return t('Failed', 'Αποτυχία');
      default: return status;
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget || !user) return;
    try {
      const { error } = await supabase
        .from('announcements')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.id,
        })
        .eq('id', archiveTarget.id);

      if (error) throw error;
      toast.success(t('Announcement archived', 'Η ανακοίνωση αρχειοθετήθηκε'));
      setArchiveTarget(null);
      fetchData();
    } catch (error) {
      console.error('Error archiving:', error);
      toast.error(t('Failed to archive', 'Αποτυχία αρχειοθέτησης'));
    }
  };

  const handleUnarchive = async () => {
    if (!unarchiveTarget || !user) return;
    try {
      const { error } = await supabase
        .from('announcements')
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
        })
        .eq('id', unarchiveTarget.id);

      if (error) throw error;
      toast.success(t('Announcement restored', 'Η ανακοίνωση επαναφέρθηκε'));
      setUnarchiveTarget(null);
      fetchData();
    } catch (error) {
      console.error('Error unarchiving:', error);
      toast.error(t('Failed to restore', 'Αποτυχία επαναφοράς'));
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasFilters = searchQuery || dateFrom || dateTo;

  const currentList = viewTab === 'active' ? announcements : archivedAnnouncements;
  const filteredAnnouncements = currentList.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q);
  });

  const renderTable = (list: Announcement[], isArchived: boolean) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Created At', 'Δημιουργήθηκε')}</TableHead>
            <TableHead>{t('Title', 'Τίτλος')}</TableHead>
            <TableHead>{t('Status', 'Κατάσταση')}</TableHead>
            <TableHead>{t('Created By', 'Δημιουργήθηκε από')}</TableHead>
            <TableHead className="text-center">{t('Recipients', 'Παραλήπτες')}</TableHead>
            {isArchived ? (
              <TableHead>{t('Archived At', 'Αρχειοθετήθηκε')}</TableHead>
            ) : (
              <TableHead>{t('Sent At', 'Απεστάλη')}</TableHead>
            )}
            <TableHead className="text-right">{t('Action', 'Ενέργεια')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((announcement) => (
            <TableRow key={announcement.id}>
              <TableCell className="font-mono text-sm">
                {format(new Date(announcement.created_at), 'dd/MM/yyyy HH:mm')}
              </TableCell>
              <TableCell className="font-medium max-w-[200px] truncate">
                {announcement.title}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(announcement.status)}>
                  {getStatusLabel(announcement.status)}
                </Badge>
              </TableCell>
              <TableCell>{getUserName(announcement.created_by)}</TableCell>
              <TableCell className="text-center">
                {announcement.recipients_count || 0}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {isArchived
                  ? (announcement.archived_at
                    ? format(new Date(announcement.archived_at), 'dd/MM/yyyy HH:mm')
                    : '-')
                  : (announcement.sent_at
                    ? format(new Date(announcement.sent_at), 'dd/MM/yyyy HH:mm')
                    : '-')}
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/announcements/${announcement.id}`)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {t('View', 'Προβολή')}
                </Button>
                {isAdmin && !isArchived && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setArchiveTarget(announcement); }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                )}
                {isAdmin && isArchived && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setUnarchiveTarget(announcement); }}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ArchiveRestore className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Megaphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('Announcements', 'Ανακοινώσεις')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('Internal announcements via Telegram', 'Εσωτερικές ανακοινώσεις μέσω Telegram')}
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/announcements/new')}>
            <Plus className="h-4 w-4 mr-2" />
            {t('New Announcement', 'Νέα Ανακοίνωση')}
          </Button>
        </div>

        {/* Search & Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t('Search & Filters', 'Αναζήτηση & Φίλτρα')}
              </CardTitle>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  {t('Clear', 'Καθαρισμός')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Search by title or content...', 'Αναζήτηση κατά τίτλο ή περιεχόμενο...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('From', 'Από')}:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[150px] justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : t('Select', 'Επιλογή')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      locale={language === 'el' ? elLocale : undefined}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {dateFrom && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDateFrom(undefined)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('To', 'Έως')}:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[150px] justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {dateTo ? format(dateTo, 'dd/MM/yyyy') : t('Select', 'Επιλογή')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      locale={language === 'el' ? elLocale : undefined}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {dateTo && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDateTo(undefined)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Active / Archived */}
        <Tabs value={viewTab} onValueChange={setViewTab}>
          <TabsList>
            <TabsTrigger value="active">
              {t('Active', 'Ενεργά')} ({announcements.length})
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="archived">
                <Archive className="h-4 w-4 mr-1.5" />
                {t('Archived', 'Αρχειοθετημένα')} ({archivedAnnouncements.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="active">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredAnnouncements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Megaphone className="h-12 w-12 mb-4 opacity-50" />
                    <p>{t('No announcements found', 'Δεν βρέθηκαν ανακοινώσεις')}</p>
                    {!hasFilters && (
                      <Button variant="link" onClick={() => navigate('/announcements/new')} className="mt-2">
                        {t('Create your first announcement', 'Δημιουργήστε την πρώτη σας ανακοίνωση')}
                      </Button>
                    )}
                  </div>
                ) : (
                  renderTable(filteredAnnouncements, false)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="archived">
              <Card>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredAnnouncements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Archive className="h-12 w-12 mb-4 opacity-50" />
                      <p>{t('No archived announcements', 'Δεν υπάρχουν αρχειοθετημένες ανακοινώσεις')}</p>
                    </div>
                  ) : (
                    renderTable(filteredAnnouncements, true)
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Info */}
        {!hasFilters && (
          <p className="text-sm text-muted-foreground text-center">
            {t('Use date filters to find older announcements', 'Χρησιμοποιήστε τα φίλτρα ημερομηνίας για παλαιότερες ανακοινώσεις')}
          </p>
        )}
      </div>

      {/* Archive Confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Archive Announcement?', 'Αρχειοθέτηση Ανακοίνωσης;')}</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget && t(
                `Are you sure you want to archive "${archiveTarget.title}"? It will be hidden from the list but not deleted.`,
                `Είστε σίγουροι ότι θέλετε να αρχειοθετήσετε την "${archiveTarget.title}"; Θα κρυφτεί από τη λίστα αλλά δεν θα διαγραφεί.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Ακύρωση')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>{t('Yes, Archive', 'Ναι, Αρχειοθέτηση')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unarchive Confirmation */}
      <AlertDialog open={!!unarchiveTarget} onOpenChange={(open) => !open && setUnarchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Restore Announcement?', 'Επαναφορά Ανακοίνωσης;')}</AlertDialogTitle>
            <AlertDialogDescription>
              {unarchiveTarget && t(
                `Are you sure you want to restore "${unarchiveTarget.title}"? It will reappear in the active list.`,
                `Είστε σίγουροι ότι θέλετε να επαναφέρετε την "${unarchiveTarget.title}"; Θα εμφανιστεί ξανά στην ενεργή λίστα.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Ακύρωση')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnarchive}>{t('Yes, Restore', 'Ναι, Επαναφορά')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

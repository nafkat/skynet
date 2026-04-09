import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Megaphone, Eye, Loader2, Archive } from 'lucide-react';
import { toast } from 'sonner';
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
  status: 'draft' | 'pending' | 'sent' | 'partial' | 'failed';
  created_by: string;
  created_at: string;
  sent_at: string | null;
  recipients_count?: number;
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<Announcement | null>(null);

  const t = (en: string, el: string) => (language === 'el' ? el : en);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      // Fetch announcements with recipient counts
      const { data: announcementsData, error: announcementsError } = await supabase
        .from('announcements')
        .select(`
          id,
          title,
          status,
          created_by,
          created_at,
          sent_at
        `)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false });

      if (announcementsError) throw announcementsError;

      // Fetch recipient counts
      const announcementIds = announcementsData?.map(a => a.id) || [];
      let recipientCounts: Record<string, number> = {};
      
      if (announcementIds.length > 0) {
        const { data: recipientsData, error: recipientsError } = await supabase
          .from('announcement_recipients')
          .select('announcement_id')
          .in('announcement_id', announcementIds);

        if (!recipientsError && recipientsData) {
          recipientCounts = recipientsData.reduce((acc, r) => {
            acc[r.announcement_id] = (acc[r.announcement_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      // Fetch profiles for user names
      const userIds = [...new Set(announcementsData?.map(a => a.created_by) || [])];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        
        setProfiles(profilesData || []);
      }

      const enrichedAnnouncements = (announcementsData || []).map(a => ({
        ...a,
        recipients_count: recipientCounts[a.id] || 0,
      }));

      setAnnouncements(enrichedAnnouncements);
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
      case 'sent':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'partial':
        return 'outline';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return t('Draft', 'Πρόχειρο');
      case 'pending':
        return t('Pending', 'Εκκρεμεί');
      case 'sent':
        return t('Sent', 'Απεστάλη');
      case 'partial':
        return t('Partial', 'Μερική');
      case 'failed':
        return t('Failed', 'Αποτυχία');
      default:
        return status;
    }
  };

  const filteredAnnouncements = announcements.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
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

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('Search', 'Αναζήτηση')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Search by title...', 'Αναζήτηση κατά τίτλο...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
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
                <Button
                  variant="link"
                  onClick={() => navigate('/announcements/new')}
                  className="mt-2"
                >
                  {t('Create your first announcement', 'Δημιουργήστε την πρώτη σας ανακοίνωση')}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Created At', 'Δημιουργήθηκε')}</TableHead>
                      <TableHead>{t('Title', 'Τίτλος')}</TableHead>
                      <TableHead>{t('Status', 'Κατάσταση')}</TableHead>
                      <TableHead>{t('Created By', 'Δημιουργήθηκε από')}</TableHead>
                      <TableHead className="text-center">{t('Recipients', 'Παραλήπτες')}</TableHead>
                      <TableHead>{t('Sent At', 'Απεστάλη')}</TableHead>
                      <TableHead className="text-right">{t('Action', 'Ενέργεια')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnnouncements.map((announcement) => (
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
                          {announcement.sent_at
                            ? format(new Date(announcement.sent_at), 'dd/MM/yyyy HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/announcements/${announcement.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {t('View', 'Προβολή')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <p className="text-sm text-muted-foreground text-center">
          {t('Showing announcements from the last 30 days', 'Εμφάνιση ανακοινώσεων των τελευταίων 30 ημερών')}
        </p>
      </div>
    </MainLayout>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Megaphone, Send, FileText, Users, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/dateUtils';

export default function AnnouncementsDashboard() {
  const { language } = useLanguage();
  const t = (en: string, el: string) => (language === 'el' ? el : en);

  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    draft: 0,
    totalRecipients: 0,
  });
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const [announcementsRes, recipientsRes] = await Promise.all([
        supabase.from('announcements').select('id, title, status, created_at, sent_at').order('created_at', { ascending: false }),
        supabase.from('announcement_recipients').select('*', { count: 'exact', head: true }),
      ]);

      if (announcementsRes.error) throw announcementsRes.error;

      const data = announcementsRes.data || [];
      setStats({
        total: data.length,
        sent: data.filter((a) => a.status === 'sent' || a.status === 'partial').length,
        draft: data.filter((a) => a.status === 'draft').length,
        totalRecipients: recipientsRes.count || 0,
      });
      setRecent(data.slice(0, 5));
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error(t('Failed to load data', 'Αποτυχία φόρτωσης'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = [
    { title: t('Total', 'Σύνολο'), value: stats.total, icon: Megaphone, color: 'text-primary' },
    { title: t('Sent', 'Απεσταλμένες'), value: stats.sent, icon: Send, color: 'text-green-500' },
    { title: t('Drafts', 'Πρόχειρα'), value: stats.draft, icon: FileText, color: 'text-orange-500' },
    { title: t('Recipients', 'Παραλήπτες'), value: stats.totalRecipients, icon: Users, color: 'text-accent-foreground' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">{t('Sent', 'Απεσταλμένο')}</Badge>;
      case 'draft':
        return <Badge variant="secondary">{t('Draft', 'Πρόχειρο')}</Badge>;
      case 'partial':
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">{t('Partial', 'Μερικό')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('Announcements Dashboard', 'Πίνακας Ανακοινώσεων')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('Overview of announcements', 'Επισκόπηση ανακοινώσεων')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('Refresh', 'Ανανέωση')}
            </Button>
            <Link to="/announcements/list">
              <Button variant="outline" size="sm">
                {t('View All', 'Προβολή Όλων')}
              </Button>
            </Link>
            <Link to="/announcements/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t('New', 'Νέα')}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('Recent Announcements', 'Πρόσφατες Ανακοινώσεις')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('No announcements yet', 'Δεν υπάρχουν ανακοινώσεις')}
              </p>
            ) : (
              <div className="space-y-3">
                {recent.map((a) => (
                  <Link key={a.id} to={`/announcements/${a.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(a.sent_at || a.created_at)}</p>
                    </div>
                    {getStatusBadge(a.status)}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}

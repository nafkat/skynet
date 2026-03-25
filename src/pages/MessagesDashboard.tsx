import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, MessageSquare, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/dateUtils';

export default function MessagesDashboard() {
  const { language } = useLanguage();
  const t = (en: string, el: string) => (language === 'el' ? el : en);

  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    replied: 0,
    resolved: 0,
  });
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('employee_messages')
        .select('id, status, message_text, created_at, employees(first_name, last_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const msgs = data || [];
      setStats({
        total: msgs.length,
        unread: msgs.filter((m) => m.status === 'unread' || m.status === 'reopened').length,
        replied: msgs.filter((m) => m.status === 'replied').length,
        resolved: msgs.filter((m) => m.status === 'resolved').length,
      });
      setRecent(msgs.slice(0, 5));
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
    { title: t('Total Messages', 'Σύνολο Μηνυμάτων'), value: stats.total, icon: MessageSquare, color: 'text-primary' },
    { title: t('Unread', 'Αδιάβαστα'), value: stats.unread, icon: AlertCircle, color: 'text-orange-500' },
    { title: t('Replied', 'Απαντημένα'), value: stats.replied, icon: Mail, color: 'text-blue-500' },
    { title: t('Resolved', 'Επιλυμένα'), value: stats.resolved, icon: CheckCircle, color: 'text-green-500' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unread':
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">{t('Unread', 'Αδιάβαστο')}</Badge>;
      case 'replied':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">{t('Replied', 'Απαντημένο')}</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">{t('Resolved', 'Επιλυμένο')}</Badge>;
      case 'reopened':
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">{t('Reopened', 'Ανοιχτό')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('Messages Dashboard', 'Πίνακας Μηνυμάτων')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('Overview of employee messaging', 'Επισκόπηση μηνυμάτων υπαλλήλων')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('Refresh', 'Ανανέωση')}
            </Button>
            <Link to="/messages/conversations">
              <Button size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                {t('View Messages', 'Μηνύματα')}
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
            <CardTitle className="text-base">{t('Recent Messages', 'Πρόσφατα Μηνύματα')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('No messages yet', 'Δεν υπάρχουν μηνύματα')}
              </p>
            ) : (
              <div className="space-y-3">
                {recent.map((m) => {
                  const emp = m.employees as any;
                  const name = emp ? `${emp.first_name} ${emp.last_name}` : t('Unknown', 'Άγνωστο');
                  return (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{name}</p>
                        <p className="text-sm text-muted-foreground truncate">{m.message_text || '📎 Attachment'}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</p>
                      </div>
                      {getStatusBadge(m.status)}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

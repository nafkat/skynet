import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Send, Users, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function ProcurementDashboard() {
  const { language } = useLanguage();
  const t = (en: string, el: string) => (language === 'el' ? el : en);

  const [stats, setStats] = useState({
    totalROs: 0,
    draftROs: 0,
    sentROs: 0,
    closedROs: 0,
    totalSuppliers: 0,
    materialROs: 0,
    serviceROs: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const [rosRes, suppliersRes] = await Promise.all([
        supabase.from('request_offers').select('status, type'),
        supabase.from('suppliers').select('*', { count: 'exact', head: true }),
      ]);

      if (rosRes.error) throw rosRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      const ros = rosRes.data || [];
      setStats({
        totalROs: ros.length,
        draftROs: ros.filter((r) => r.status === 'draft').length,
        sentROs: ros.filter((r) => r.status === 'sent' || r.status === 'reopened').length,
        closedROs: ros.filter((r) => r.status === 'closed').length,
        totalSuppliers: suppliersRes.count || 0,
        materialROs: ros.filter((r) => r.type === 'material').length,
        serviceROs: ros.filter((r) => r.type === 'service').length,
      });
    } catch (error) {
      console.error('Error fetching procurement stats:', error);
      toast.error(t('Failed to load data', 'Αποτυχία φόρτωσης'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = [
    { title: t('Total ROs', 'Σύνολο Αιτημάτων'), value: stats.totalROs, icon: Send, color: 'text-primary' },
    { title: t('Sent / Open', 'Απεσταλμένα'), value: stats.sentROs, icon: Clock, color: 'text-orange-500' },
    { title: t('Closed', 'Κλειστά'), value: stats.closedROs, icon: CheckCircle, color: 'text-green-500' },
    { title: t('Suppliers', 'Προμηθευτές'), value: stats.totalSuppliers, icon: Users, color: 'text-accent-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('Procurement Dashboard', 'Πίνακας Προμηθειών')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('Overview of procurement activities', 'Επισκόπηση δραστηριοτήτων προμηθειών')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('Refresh', 'Ανανέωση')}
          </Button>
          <Link to="/procurement/request-offers">
            <Button variant="outline" size="sm">
              {t('View All ROs', 'Προβολή Όλων')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
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

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('By Type', 'Ανά Τύπο')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('Material', 'Υλικά')}</span>
              <span className="text-lg font-semibold text-foreground">{stats.materialROs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('Service', 'Υπηρεσίες')}</span>
              <span className="text-lg font-semibold text-foreground">{stats.serviceROs}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('By Status', 'Ανά Κατάσταση')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('Draft', 'Πρόχειρα')}</span>
              <span className="text-lg font-semibold text-foreground">{stats.draftROs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('Sent / Open', 'Απεσταλμένα')}</span>
              <span className="text-lg font-semibold text-foreground">{stats.sentROs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('Closed', 'Κλειστά')}</span>
              <span className="text-lg font-semibold text-foreground">{stats.closedROs}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

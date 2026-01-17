import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Send, 
  ShoppingCart, 
  AlertTriangle,
  Clock,
  CheckCircle,
  Plus,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardStats {
  prPendingApproval: number;
  rfqsAwaitingOffers: number;
  posOverdue: number;
  posPartial: number;
}

export default function ProcurementDashboard() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [stats, setStats] = useState<DashboardStats>({
    prPendingApproval: 0,
    rfqsAwaitingOffers: 0,
    posOverdue: 0,
    posPartial: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Count PRs pending approval
      const { count: prCount } = await supabase
        .from('purchase_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'submitted');

      // Count RFQs awaiting offers
      const { count: rfqCount } = await supabase
        .from('rfqs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['sent', 'partially_received']);

      // Count POs that are partially received
      const { count: posPartialCount } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'partially_received');

      // Count issued POs (could be overdue)
      const { count: posIssuedCount } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'issued');

      setStats({
        prPendingApproval: prCount || 0,
        rfqsAwaitingOffers: rfqCount || 0,
        posOverdue: posIssuedCount || 0,
        posPartial: posPartialCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: language === 'el' ? 'Αιτήματα προς Έγκριση' : 'PRs Pending Approval',
      value: stats.prPendingApproval,
      icon: FileText,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      route: '/procurement/purchase-requests?status=submitted',
    },
    {
      title: language === 'el' ? 'RFQs σε Αναμονή' : 'RFQs Awaiting Offers',
      value: stats.rfqsAwaitingOffers,
      icon: Send,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      route: '/procurement/rfqs?status=sent',
    },
    {
      title: language === 'el' ? 'POs σε Εκκρεμότητα' : 'POs Pending Delivery',
      value: stats.posOverdue,
      icon: Clock,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      route: '/procurement/purchase-orders?status=issued',
    },
    {
      title: language === 'el' ? 'Μερική Παραλαβή' : 'Partially Received',
      value: stats.posPartial,
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      route: '/procurement/receiving',
    },
  ];

  const quickActions = [
    {
      title: language === 'el' ? 'Νέο Αίτημα Αγοράς' : 'New Purchase Request',
      description: language === 'el' ? 'Δημιουργία αιτήματος υλικών ή υπηρεσιών' : 'Create a material or service request',
      icon: Plus,
      route: '/procurement/purchase-requests/new',
    },
    {
      title: language === 'el' ? 'Διαχείριση Προμηθευτών' : 'Manage Suppliers',
      description: language === 'el' ? 'Προσθήκη ή επεξεργασία προμηθευτών' : 'Add or edit suppliers',
      icon: ArrowRight,
      route: '/procurement/suppliers',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {language === 'el' ? 'Πίνακας Ελέγχου Προμηθειών' : 'Procurement Dashboard'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'el' 
            ? 'Επισκόπηση αιτημάτων, RFQs και εντολών αγοράς' 
            : 'Overview of purchase requests, RFQs, and orders'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card 
            key={stat.title} 
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate(stat.route)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={cn('p-3 rounded-lg', stat.bgColor)}>
                  <stat.icon className={cn('h-6 w-6', stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickActions.map((action) => (
          <Card 
            key={action.title}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate(action.route)}
          >
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <action.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{action.title}</p>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workflow Overview */}
      <Card>
        <CardHeader>
          <CardTitle>
            {language === 'el' ? 'Ροή Εργασίας' : 'Workflow Overview'}
          </CardTitle>
          <CardDescription>
            {language === 'el' 
              ? 'Η διαδικασία προμηθειών βήμα προς βήμα' 
              : 'The procurement process step by step'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                PR
              </Badge>
              <span className="text-muted-foreground">→</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {language === 'el' ? 'Έγκριση' : 'Approval'}
              </Badge>
              <span className="text-muted-foreground">→</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Send className="h-3 w-3" />
                RFQ
              </Badge>
              <span className="text-muted-foreground">→</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {language === 'el' ? 'Προσφορές' : 'Offers'}
              </Badge>
              <span className="text-muted-foreground">→</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" />
                PO
              </Badge>
              <span className="text-muted-foreground">→</span>
            </div>
            <Badge variant="default" className="flex items-center gap-1">
              {language === 'el' ? 'Παραλαβή' : 'Receiving'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

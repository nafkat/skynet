import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Search, 
  Filter,
  Loader2,
  Eye,
  FileText,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PurchaseOrder {
  id: string;
  po_number: string;
  pr_id: string;
  purchase_request?: {
    pr_number: string;
    description: string;
  };
  supplier_id: string;
  supplier?: {
    name: string;
  };
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-600',
  issued: 'bg-blue-500/10 text-blue-600',
  partially_received: 'bg-orange-500/10 text-orange-600',
  received: 'bg-green-500/10 text-green-600',
  closed: 'bg-gray-500/10 text-gray-600',
  cancelled: 'bg-red-500/10 text-red-600',
};

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          purchase_request:purchase_requests(pr_number, description),
          supplier:suppliers(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching POs:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης εντολών' : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (po: PurchaseOrder, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: newStatus })
        .eq('id', po.id);

      if (error) throw error;

      toast.success(language === 'el' ? 'Κατάσταση ενημερώθηκε' : 'Status updated');
      fetchOrders();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(language === 'el' ? 'Αποτυχία ενημέρωσης' : 'Failed to update');
    }
  };

  const filteredOrders = orders.filter(po => {
    const matchesSearch = 
      po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.purchase_request?.pr_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; el: string }> = {
      draft: { en: 'Draft', el: 'Πρόχειρο' },
      issued: { en: 'Issued', el: 'Εκδόθηκε' },
      partially_received: { en: 'Partially Received', el: 'Μερικώς Παρελήφθη' },
      received: { en: 'Received', el: 'Παρελήφθη' },
      closed: { en: 'Closed', el: 'Κλειστό' },
      cancelled: { en: 'Cancelled', el: 'Ακυρώθηκε' },
    };
    return labels[status]?.[language === 'el' ? 'el' : 'en'] || status;
  };

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
          {language === 'el' ? 'Εντολές Αγοράς' : 'Purchase Orders'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'el' 
            ? 'Διαχείριση εντολών αγοράς' 
            : 'Manage purchase orders'}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'el' ? 'Αναζήτηση...' : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={language === 'el' ? 'Κατάσταση' : 'Status'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'el' ? 'Όλες' : 'All'}</SelectItem>
                <SelectItem value="draft">{language === 'el' ? 'Πρόχειρο' : 'Draft'}</SelectItem>
                <SelectItem value="issued">{language === 'el' ? 'Εκδόθηκε' : 'Issued'}</SelectItem>
                <SelectItem value="received">{language === 'el' ? 'Παρελήφθη' : 'Received'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>PR #</TableHead>
                <TableHead>{language === 'el' ? 'Προμηθευτής' : 'Supplier'}</TableHead>
                <TableHead>{language === 'el' ? 'Περιγραφή' : 'Description'}</TableHead>
                <TableHead>{language === 'el' ? 'Κατάσταση' : 'Status'}</TableHead>
                <TableHead>{language === 'el' ? 'Ημερομηνία' : 'Date'}</TableHead>
                <TableHead className="text-right">{language === 'el' ? 'Ενέργειες' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {language === 'el' ? 'Δεν βρέθηκαν εντολές' : 'No orders found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.po_number}</TableCell>
                    <TableCell>{po.purchase_request?.pr_number || '-'}</TableCell>
                    <TableCell>{po.supplier?.name || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {po.purchase_request?.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('border-0', statusColors[po.status])}>
                        {getStatusLabel(po.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(po.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {po.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStatusChange(po, 'issued')}
                            title={language === 'el' ? 'Έκδοση' : 'Issue'}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Export PDF"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/procurement/purchase-orders/${po.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

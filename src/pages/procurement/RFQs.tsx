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
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RFQ {
  id: string;
  rfq_number: string;
  pr_id: string;
  purchase_request?: {
    pr_number: string;
    description: string;
  };
  deadline: string | null;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-600',
  sent: 'bg-blue-500/10 text-blue-600',
  partially_received: 'bg-orange-500/10 text-orange-600',
  received: 'bg-green-500/10 text-green-600',
  closed: 'bg-gray-500/10 text-gray-600',
};

export default function RFQs() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchRFQs();
  }, []);

  const fetchRFQs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rfqs')
        .select(`
          *,
          purchase_request:purchase_requests(pr_number, description)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRfqs(data || []);
    } catch (error) {
      console.error('Error fetching RFQs:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης RFQs' : 'Failed to load RFQs');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (rfq: RFQ, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('rfqs')
        .update({ status: newStatus })
        .eq('id', rfq.id);

      if (error) throw error;

      toast.success(language === 'el' ? 'Κατάσταση ενημερώθηκε' : 'Status updated');
      fetchRFQs();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(language === 'el' ? 'Αποτυχία ενημέρωσης' : 'Failed to update');
    }
  };

  const filteredRFQs = rfqs.filter(rfq => {
    const matchesSearch = 
      rfq.rfq_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rfq.purchase_request?.pr_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rfq.purchase_request?.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || rfq.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; el: string }> = {
      draft: { en: 'Draft', el: 'Πρόχειρο' },
      sent: { en: 'Sent', el: 'Εστάλη' },
      partially_received: { en: 'Partially Received', el: 'Μερικώς Ληφθέν' },
      received: { en: 'Received', el: 'Ελήφθη' },
      closed: { en: 'Closed', el: 'Κλειστό' },
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
          {language === 'el' ? 'Αιτήματα Προσφορών (RFQ)' : 'Requests for Quotation'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'el' 
            ? 'Διαχείριση αιτημάτων προσφορών προς προμηθευτές' 
            : 'Manage requests for quotation to suppliers'}
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
                <SelectItem value="sent">{language === 'el' ? 'Εστάλη' : 'Sent'}</SelectItem>
                <SelectItem value="received">{language === 'el' ? 'Ελήφθη' : 'Received'}</SelectItem>
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
                <TableHead>RFQ #</TableHead>
                <TableHead>PR #</TableHead>
                <TableHead>{language === 'el' ? 'Περιγραφή' : 'Description'}</TableHead>
                <TableHead>{language === 'el' ? 'Προθεσμία' : 'Deadline'}</TableHead>
                <TableHead>{language === 'el' ? 'Κατάσταση' : 'Status'}</TableHead>
                <TableHead>{language === 'el' ? 'Ημερομηνία' : 'Date'}</TableHead>
                <TableHead className="text-right">{language === 'el' ? 'Ενέργειες' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRFQs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {language === 'el' ? 'Δεν βρέθηκαν RFQs' : 'No RFQs found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRFQs.map((rfq) => (
                  <TableRow key={rfq.id}>
                    <TableCell className="font-medium">{rfq.rfq_number}</TableCell>
                    <TableCell>{rfq.purchase_request?.pr_number || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {rfq.purchase_request?.description || '-'}
                    </TableCell>
                    <TableCell>
                      {rfq.deadline ? format(new Date(rfq.deadline), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('border-0', statusColors[rfq.status])}>
                        {getStatusLabel(rfq.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(rfq.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {rfq.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStatusChange(rfq, 'sent')}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/procurement/rfqs/${rfq.id}`)}
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

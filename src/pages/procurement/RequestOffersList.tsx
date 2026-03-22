import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Loader2,
  Eye,
  Send,
  FileText,
  Copy
} from 'lucide-react';
import { format } from 'date-fns';

interface RequestOffer {
  id: string;
  ro_number: string;
  type: string;
  project_name: string | null;
  vessel_or_job: string | null;
  title: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  recipients_count?: number;
}

export default function RequestOffersList() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const [requestOffers, setRequestOffers] = useState<RequestOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchRequestOffers();
  }, []);

  const fetchRequestOffers = async () => {
    try {
      setLoading(true);
      
      // Fetch request offers with recipient count
      const { data, error } = await supabase
        .from('request_offers')
        .select(`
          *,
          request_offer_recipients(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mapped = (data || []).map(ro => ({
        ...ro,
        recipients_count: ro.request_offer_recipients?.[0]?.count || 0
      }));
      
      setRequestOffers(mapped);
    } catch (error) {
      console.error('Error fetching request offers:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης' : 'Failed to load request offers');
    } finally {
      setLoading(false);
    }
  };

  const filteredOffers = requestOffers.filter(ro =>
    ro.ro_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ro.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ro.project_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">{language === 'el' ? 'Πρόχειρο' : 'Draft'}</Badge>;
      case 'sent':
        return <Badge className="bg-green-500">{language === 'el' ? 'Απεσταλμένο' : 'Sent'}</Badge>;
      case 'closed':
        return <Badge variant="secondary">{language === 'el' ? 'Κλειστό' : 'Closed'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    return type === 'material' 
      ? (language === 'el' ? 'Υλικό' : 'Material')
      : (language === 'el' ? 'Υπηρεσία' : 'Service');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {language === 'el' ? 'Αιτήματα Προσφοράς' : 'Request Offers'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'el' 
              ? 'Δημιουργία και διαχείριση αιτημάτων προσφοράς' 
              : 'Create and manage request offers'}
          </p>
        </div>
        <Button onClick={() => navigate('/procurement/request-offers/new')}>
          <Plus className="h-4 w-4 mr-2" />
          {language === 'el' ? 'Νέο Αίτημα' : 'New Request Offer'}
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'el' ? 'Αναζήτηση...' : 'Search...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'el' ? 'Αριθμός' : 'RO Number'}</TableHead>
                <TableHead>{language === 'el' ? 'Τύπος' : 'Type'}</TableHead>
                <TableHead>{language === 'el' ? 'Τίτλος' : 'Title'}</TableHead>
                <TableHead>{language === 'el' ? 'Έργο/Σκάφος' : 'Project/Vessel'}</TableHead>
                <TableHead>{language === 'el' ? 'Κατάσταση' : 'Status'}</TableHead>
                <TableHead>{language === 'el' ? 'Δημιουργήθηκε' : 'Created'}</TableHead>
                <TableHead>{language === 'el' ? 'Απεστάλη' : 'Sent'}</TableHead>
                <TableHead>{language === 'el' ? 'Παραλήπτες' : 'Recipients'}</TableHead>
                <TableHead className="text-right">{language === 'el' ? 'Ενέργειες' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOffers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    {language === 'el' ? 'Δεν βρέθηκαν αιτήματα' : 'No request offers found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOffers.map((ro) => (
                  <TableRow key={ro.id}>
                    <TableCell className="font-medium">{ro.ro_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTypeLabel(ro.type)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{ro.title}</TableCell>
                    <TableCell>
                      {ro.project_name || ro.vessel_or_job 
                        ? `${ro.project_name || ''} ${ro.vessel_or_job ? `/ ${ro.vessel_or_job}` : ''}`.trim()
                        : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(ro.status)}</TableCell>
                    <TableCell>{format(new Date(ro.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      {ro.sent_at ? format(new Date(ro.sent_at), 'dd/MM/yyyy HH:mm') : '-'}
                    </TableCell>
                    <TableCell>{ro.recipients_count}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => navigate(`/procurement/request-offers/${ro.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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

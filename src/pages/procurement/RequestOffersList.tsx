import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Search, Loader2, Eye, FileText, Copy, Trash2 } from 'lucide-react';
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
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    roId: string | null;
    roNumber: string | null;
  }>({ isOpen: false, roId: null, roNumber: null });

  useEffect(() => {
    fetchRequestOffers();
  }, []);

  const fetchRequestOffers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('request_offers')
        .select(`*, request_offer_recipients(count)`)
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

  const handleDelete = async () => {
    if (!deleteConfirm.roId) return;
    try {
      const { error } = await supabase
        .from('request_offers')
        .delete()
        .eq('id', deleteConfirm.roId);
      if (error) throw error;
      toast.success(language === 'el' ? 'Το αίτημα διαγράφηκε' : 'Request offer deleted');
      fetchRequestOffers();
      setDeleteConfirm({ isOpen: false, roId: null, roNumber: null });
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error(language === 'el' ? 'Αποτυχία διαγραφής' : 'Failed to delete');
    }
  };

  const filteredOffers = requestOffers.filter(ro =>
    ro.ro_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ro.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ro.project_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const t = (en: string, el: string) => language === 'el' ? el : en;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">{t('Draft', 'Πρόχειρο')}</Badge>;
      case 'sent':
        return <Badge className="bg-green-500">{t('Sent', 'Απεσταλμένο')}</Badge>;
      case 'closed':
        return <Badge variant="secondary">{t('Closed', 'Κλειστό')}</Badge>;
      case 'reopened':
        return <Badge className="bg-orange-500">{t('Reopened', 'Ανοιχτό Ξανά')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    return type === 'material' ? t('Material', 'Υλικό') : t('Service', 'Υπηρεσία');
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
            {t('Request Offers', 'Αιτήματα Προσφοράς')}
          </h1>
          <p className="text-muted-foreground">
            {t('Create and manage request offers', 'Δημιουργία και διαχείριση αιτημάτων προσφοράς')}
          </p>
        </div>
        <Button onClick={() => navigate('/procurement/request-offers/new')}>
          <Plus className="h-4 w-4 mr-2" />
          {t('New Request Offer', 'Νέο Αίτημα')}
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('Search...', 'Αναζήτηση...')}
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
                <TableHead>{t('RO Number', 'Αριθμός')}</TableHead>
                <TableHead>{t('Type', 'Τύπος')}</TableHead>
                <TableHead>{t('Title', 'Τίτλος')}</TableHead>
                <TableHead>{t('Project/Vessel', 'Έργο/Σκάφος')}</TableHead>
                <TableHead>{t('Status', 'Κατάσταση')}</TableHead>
                <TableHead>{t('Created', 'Δημιουργήθηκε')}</TableHead>
                <TableHead>{t('Sent', 'Απεστάλη')}</TableHead>
                <TableHead>{t('Recipients', 'Παραλήπτες')}</TableHead>
                <TableHead className="text-right">{t('Actions', 'Ενέργειες')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOffers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    {t('No request offers found', 'Δεν βρέθηκαν αιτήματα')}
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
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/procurement/request-offers/${ro.id}`)} title={t('View', 'Προβολή')}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/procurement/request-offers/new?duplicate=${ro.id}`)} title={t('Duplicate', 'Αντιγραφή')}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirm({ isOpen: true, roId: ro.id, roNumber: ro.ro_number })}
                          title={t('Delete', 'Διαγραφή')}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false, roId: null, roNumber: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Delete Request Offer?', 'Διαγραφή Αιτήματος Προσφοράς;')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `Are you sure you want to delete ${deleteConfirm.roNumber}? This action cannot be undone.`,
                `Είστε σίγουροι ότι θέλετε να διαγράψετε το ${deleteConfirm.roNumber}; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Ακύρωση')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {t('Delete', 'Διαγραφή')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

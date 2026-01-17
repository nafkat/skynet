import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Plus, 
  Search, 
  Filter,
  Loader2,
  Eye,
  Plane
} from 'lucide-react';
import CreateRFQModal from '@/components/procurement/CreateRFQModal';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  project_code: string;
  project_name: string;
}

interface PurchaseRequest {
  id: string;
  pr_number: string;
  type: string;
  project_id: string;
  project?: Project;
  vessel_or_job: string | null;
  description: string;
  qty: number | null;
  uom: string | null;
  scope_of_work: string | null;
  pricing_model: string | null;
  priority: 'normal' | 'urgent';
  needed_by: string | null;
  status: string;
  created_by: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-600',
  submitted: 'bg-blue-500/10 text-blue-600',
  approved: 'bg-green-500/10 text-green-600',
  rejected: 'bg-red-500/10 text-red-600',
  rfq_sent: 'bg-purple-500/10 text-purple-600',
  offers_received: 'bg-orange-500/10 text-orange-600',
  awarded: 'bg-teal-500/10 text-teal-600',
  po_issued: 'bg-cyan-500/10 text-cyan-600',
  closed: 'bg-gray-500/10 text-gray-600',
  cancelled: 'bg-red-500/10 text-red-600',
};

export default function PurchaseRequests() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Create PR modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPR, setNewPR] = useState({
    type: 'material' as 'material' | 'service',
    project_id: '',
    vessel_or_job: '',
    description: '',
    qty: '',
    uom: '',
    scope_of_work: '',
    pricing_model: '',
    priority: 'normal' as 'normal' | 'urgent',
    needed_by: '',
  });
  
  // Create RFQ modal
  const [showRFQModal, setShowRFQModal] = useState(false);
  const [selectedPRForRFQ, setSelectedPRForRFQ] = useState<PurchaseRequest | null>(null);

  useEffect(() => {
    fetchRequests();
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, project_code, project_name')
      .eq('status', 'OPEN')
      .order('project_code');
    
    if (!error && data) {
      setProjects(data);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchase_requests')
        .select(`
          *,
          project:projects(id, project_code, project_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as PurchaseRequest[]);
    } catch (error) {
      console.error('Error fetching PRs:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης αιτημάτων' : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePR = async () => {
    if (!newPR.project_id || !newPR.description) {
      toast.error(language === 'el' ? 'Συμπληρώστε τα υποχρεωτικά πεδία' : 'Please fill required fields');
      return;
    }

    try {
      setCreating(true);
      
      const { error } = await supabase
        .from('purchase_requests')
        .insert([{
          type: newPR.type,
          project_id: newPR.project_id,
          vessel_or_job: newPR.vessel_or_job || null,
          description: newPR.description,
          qty: newPR.qty ? parseFloat(newPR.qty) : null,
          uom: newPR.uom || null,
          scope_of_work: newPR.scope_of_work || null,
          pricing_model: newPR.pricing_model || null,
          priority: newPR.priority,
          needed_by: newPR.needed_by || null,
          status: 'draft',
          created_by: user?.id!,
          pr_number: '',
        }]);

      if (error) throw error;

      toast.success(language === 'el' ? 'Αίτημα δημιουργήθηκε' : 'Request created');
      setShowCreateModal(false);
      setNewPR({
        type: 'material',
        project_id: '',
        vessel_or_job: '',
        description: '',
        qty: '',
        uom: '',
        scope_of_work: '',
        pricing_model: '',
        priority: 'normal',
        needed_by: '',
      });
      fetchRequests();
    } catch (error: any) {
      console.error('Error creating PR:', error);
      toast.error(error.message || (language === 'el' ? 'Αποτυχία δημιουργίας' : 'Failed to create'));
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (pr: PurchaseRequest, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('purchase_requests')
        .update({ status: newStatus })
        .eq('id', pr.id);

      if (error) throw error;

      toast.success(language === 'el' ? 'Κατάσταση ενημερώθηκε' : 'Status updated');
      fetchRequests();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(language === 'el' ? 'Αποτυχία ενημέρωσης' : 'Failed to update');
    }
  };

  const filteredRequests = requests.filter(pr => {
    const matchesSearch = 
      pr.pr_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.project?.project_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || pr.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; el: string }> = {
      draft: { en: 'Draft', el: 'Πρόχειρο' },
      submitted: { en: 'Submitted', el: 'Υποβλήθηκε' },
      approved: { en: 'Approved', el: 'Εγκρίθηκε' },
      rejected: { en: 'Rejected', el: 'Απορρίφθηκε' },
      rfq_sent: { en: 'RFQ Sent', el: 'RFQ Εστάλη' },
      offers_received: { en: 'Offers Received', el: 'Ελήφθησαν Προσφορές' },
      awarded: { en: 'Awarded', el: 'Κατακυρώθηκε' },
      po_issued: { en: 'PO Issued', el: 'PO Εκδόθηκε' },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {language === 'el' ? 'Αιτήματα Αγορών' : 'Purchase Requests'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'el' 
              ? 'Διαχείριση αιτημάτων υλικών και υπηρεσιών' 
              : 'Manage material and service requests'}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {language === 'el' ? 'Νέο Αίτημα' : 'New Request'}
        </Button>
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
                <SelectItem value="submitted">{language === 'el' ? 'Υποβλήθηκε' : 'Submitted'}</SelectItem>
                <SelectItem value="approved">{language === 'el' ? 'Εγκρίθηκε' : 'Approved'}</SelectItem>
                <SelectItem value="rejected">{language === 'el' ? 'Απορρίφθηκε' : 'Rejected'}</SelectItem>
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
                <TableHead>{language === 'el' ? 'Αριθμός' : 'Number'}</TableHead>
                <TableHead>{language === 'el' ? 'Τύπος' : 'Type'}</TableHead>
                <TableHead>{language === 'el' ? 'Έργο' : 'Project'}</TableHead>
                <TableHead>{language === 'el' ? 'Περιγραφή' : 'Description'}</TableHead>
                <TableHead>{language === 'el' ? 'Προτεραιότητα' : 'Priority'}</TableHead>
                <TableHead>{language === 'el' ? 'Κατάσταση' : 'Status'}</TableHead>
                <TableHead>{language === 'el' ? 'Ημερομηνία' : 'Date'}</TableHead>
                <TableHead className="text-right">{language === 'el' ? 'Ενέργειες' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {language === 'el' ? 'Δεν βρέθηκαν αιτήματα' : 'No requests found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((pr) => (
                  <TableRow key={pr.id}>
                    <TableCell className="font-medium">{pr.pr_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {pr.type === 'material' 
                          ? (language === 'el' ? 'Υλικό' : 'Material')
                          : (language === 'el' ? 'Υπηρεσία' : 'Service')}
                      </Badge>
                    </TableCell>
                    <TableCell>{pr.project?.project_code}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{pr.description}</TableCell>
                    <TableCell>
                      <Badge variant={pr.priority === 'urgent' ? 'destructive' : 'secondary'}>
                        {pr.priority === 'urgent' 
                          ? (language === 'el' ? 'Επείγον' : 'Urgent')
                          : (language === 'el' ? 'Κανονικό' : 'Normal')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('border-0', statusColors[pr.status])}>
                        {getStatusLabel(pr.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(pr.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {pr.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title={language === 'el' ? 'Δημιουργία RFQ' : 'Create RFQ'}
                            onClick={() => {
                              setSelectedPRForRFQ(pr);
                              setShowRFQModal(true);
                            }}
                          >
                            <Plane className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/procurement/purchase-requests/${pr.id}`)}
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

      {/* Create PR Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {language === 'el' ? 'Νέο Αίτημα Αγοράς' : 'New Purchase Request'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{language === 'el' ? 'Τύπος' : 'Type'} *</Label>
              <Select value={newPR.type} onValueChange={(v: 'material' | 'service') => setNewPR({ ...newPR, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="material">{language === 'el' ? 'Υλικό' : 'Material'}</SelectItem>
                  <SelectItem value="service">{language === 'el' ? 'Υπηρεσία' : 'Service'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'el' ? 'Έργο' : 'Project'} *</Label>
              <Select value={newPR.project_id} onValueChange={(v) => setNewPR({ ...newPR, project_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'el' ? 'Επιλογή...' : 'Select...'} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.project_code} - {p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-2">
              <Label>{language === 'el' ? 'Περιγραφή' : 'Description'} *</Label>
              <Textarea
                value={newPR.description}
                onChange={(e) => setNewPR({ ...newPR, description: e.target.value })}
                rows={3}
              />
            </div>

            {newPR.type === 'material' && (
              <>
                <div className="space-y-2">
                  <Label>{language === 'el' ? 'Ποσότητα' : 'Quantity'}</Label>
                  <Input
                    type="number"
                    value={newPR.qty}
                    onChange={(e) => setNewPR({ ...newPR, qty: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'el' ? 'Μονάδα' : 'UOM'}</Label>
                  <Input
                    value={newPR.uom}
                    onChange={(e) => setNewPR({ ...newPR, uom: e.target.value })}
                    placeholder="pcs, kg, m..."
                  />
                </div>
              </>
            )}

            {newPR.type === 'service' && (
              <>
                <div className="col-span-2 space-y-2">
                  <Label>{language === 'el' ? 'Πεδίο Εργασιών' : 'Scope of Work'}</Label>
                  <Textarea
                    value={newPR.scope_of_work}
                    onChange={(e) => setNewPR({ ...newPR, scope_of_work: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'el' ? 'Μοντέλο Τιμολόγησης' : 'Pricing Model'}</Label>
                  <Select value={newPR.pricing_model} onValueChange={(v) => setNewPR({ ...newPR, pricing_model: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'el' ? 'Επιλογή...' : 'Select...'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lump_sum">{language === 'el' ? 'Κατ\' αποκοπή' : 'Lump Sum'}</SelectItem>
                      <SelectItem value="unit_rate">{language === 'el' ? 'Τιμή Μονάδας' : 'Unit Rate'}</SelectItem>
                      <SelectItem value="day_rate">{language === 'el' ? 'Ημερήσια Τιμή' : 'Day Rate'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{language === 'el' ? 'Προτεραιότητα' : 'Priority'}</Label>
              <Select value={newPR.priority} onValueChange={(v: 'normal' | 'urgent') => setNewPR({ ...newPR, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">{language === 'el' ? 'Κανονικό' : 'Normal'}</SelectItem>
                  <SelectItem value="urgent">{language === 'el' ? 'Επείγον' : 'Urgent'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'el' ? 'Απαιτείται μέχρι' : 'Needed By'}</Label>
              <Input
                type="date"
                value={newPR.needed_by}
                onChange={(e) => setNewPR({ ...newPR, needed_by: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {language === 'el' ? 'Ακύρωση' : 'Cancel'}
            </Button>
            <Button onClick={handleCreatePR} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {language === 'el' ? 'Δημιουργία' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create RFQ Modal */}
      {selectedPRForRFQ && (
        <CreateRFQModal
          open={showRFQModal}
          onOpenChange={(open) => {
            setShowRFQModal(open);
            if (!open) {
              setSelectedPRForRFQ(null);
              fetchRequests();
            }
          }}
          prId={selectedPRForRFQ.id}
          prType={selectedPRForRFQ.type as 'material' | 'service'}
          prNumber={selectedPRForRFQ.pr_number}
        />
      )}
    </div>
  );
}

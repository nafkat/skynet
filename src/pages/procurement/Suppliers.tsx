import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  Loader2,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Star
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  trade_name: string;
  supplier_type: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  country: string;
  vat_number: string;
  is_preferred: boolean;
  notes: string | null;
  created_at: string;
}

export default function Suppliers() {
  const { language } = useLanguage();
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    trade_name: '',
    supplier_type: 'supplier' as 'supplier' | 'subcontractor' | 'both',
    contact_name: '',
    email: '',
    phone: '',
    country: '',
    vat_number: '',
    notes: '',
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης προμηθευτών' : 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      trade_name: '',
      supplier_type: 'supplier',
      contact_name: '',
      email: '',
      phone: '',
      country: '',
      vat_number: '',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      supplier_type: supplier.supplier_type as 'supplier' | 'subcontractor' | 'both',
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      country: supplier.country || '',
      vat_number: supplier.vat_number || '',
      notes: supplier.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error(language === 'el' ? 'Το όνομα είναι υποχρεωτικό' : 'Name is required');
      return;
    }
    if (!formData.country.trim()) {
      toast.error(language === 'el' ? 'Η χώρα είναι υποχρεωτική' : 'Country is required');
      return;
    }
    if (!formData.vat_number.trim()) {
      toast.error(language === 'el' ? 'Ο ΑΦΜ είναι υποχρεωτικός' : 'VAT number is required');
      return;
    }

    try {
      setSaving(true);

      const supplierData = {
        name: formData.name,
        supplier_type: formData.supplier_type,
        contact_name: formData.contact_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        country: formData.country,
        vat_number: formData.vat_number,
        notes: formData.notes || null,
      };

      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update(supplierData)
          .eq('id', editingSupplier.id);
        if (error) throw error;
        toast.success(language === 'el' ? 'Προμηθευτής ενημερώθηκε' : 'Supplier updated');
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert(supplierData);
        if (error) {
          if (error.message.includes('duplicate') || error.message.includes('unique')) {
            toast.error(language === 'el' ? 'Υπάρχει ήδη προμηθευτής με αυτή τη χώρα και ΑΦΜ' : 'Supplier with this country and VAT already exists');
            return;
          }
          throw error;
        }
        toast.success(language === 'el' ? 'Προμηθευτής δημιουργήθηκε' : 'Supplier created');
      }

      setShowModal(false);
      fetchSuppliers();
    } catch (error: any) {
      console.error('Error saving supplier:', error);
      toast.error(error.message || (language === 'el' ? 'Αποτυχία αποθήκευσης' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(language === 'el' ? 'Διαγραφή προμηθευτή;' : 'Delete supplier?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplier.id);

      if (error) throw error;
      toast.success(language === 'el' ? 'Προμηθευτής διαγράφηκε' : 'Supplier deleted');
      fetchSuppliers();
    } catch (error: any) {
      console.error('Error deleting supplier:', error);
      toast.error(error.message || (language === 'el' ? 'Αποτυχία διαγραφής' : 'Failed to delete'));
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.vat_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'supplier': return language === 'el' ? 'Προμηθευτής' : 'Supplier';
      case 'subcontractor': return language === 'el' ? 'Υπεργολάβος' : 'Subcontractor';
      case 'both': return language === 'el' ? 'Και τα δύο' : 'Both';
      default: return type;
    }
  };

  const handleTogglePreferred = async (supplier: Supplier) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_preferred: !supplier.is_preferred })
        .eq('id', supplier.id);

      if (error) throw error;
      
      setSuppliers(prev => prev.map(s => 
        s.id === supplier.id ? { ...s, is_preferred: !s.is_preferred } : s
      ));
      toast.success(
        supplier.is_preferred
          ? (language === 'el' ? 'Αφαίρεση από προτιμώμενους' : 'Removed from preferred')
          : (language === 'el' ? 'Προστέθηκε στους προτιμώμενους' : 'Added to preferred')
      );
    } catch (error) {
      console.error('Error updating preferred:', error);
      toast.error(language === 'el' ? 'Αποτυχία ενημέρωσης' : 'Failed to update');
    }
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
            {language === 'el' ? 'Προμηθευτές / Υπεργολάβοι' : 'Suppliers / Subcontractors'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'el' 
              ? 'Διαχείριση προμηθευτών υλικών και υπεργολάβων υπηρεσιών' 
              : 'Manage material suppliers and service subcontractors'}
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          {language === 'el' ? 'Νέος' : 'New'}
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'el' ? 'Αναζήτηση (όνομα, email, ΑΦΜ)...' : 'Search (name, email, VAT)...'}
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
                <TableHead className="w-[40px]">
                  <Star className="h-4 w-4" />
                </TableHead>
                <TableHead>{language === 'el' ? 'Όνομα' : 'Name'}</TableHead>
                <TableHead>{language === 'el' ? 'Τύπος' : 'Type'}</TableHead>
                <TableHead>{language === 'el' ? 'Χώρα' : 'Country'}</TableHead>
                <TableHead>{language === 'el' ? 'ΑΦΜ' : 'VAT'}</TableHead>
                <TableHead>{language === 'el' ? 'Επαφή' : 'Contact'}</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>{language === 'el' ? 'Τηλέφωνο' : 'Phone'}</TableHead>
                <TableHead className="text-right">{language === 'el' ? 'Ενέργειες' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {language === 'el' ? 'Δεν βρέθηκαν προμηθευτές' : 'No suppliers found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell>
                      <button
                        onClick={() => handleTogglePreferred(supplier)}
                        className="focus:outline-none"
                        title={language === 'el' ? 'Προτιμώμενος' : 'Preferred'}
                      >
                        <Star 
                          className={`h-4 w-4 transition-colors ${
                            supplier.is_preferred 
                              ? 'text-yellow-500 fill-yellow-500' 
                              : 'text-muted-foreground hover:text-yellow-400'
                          }`} 
                        />
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTypeLabel(supplier.supplier_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      {supplier.country ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {supplier.country}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{supplier.vat_number || '-'}</TableCell>
                    <TableCell>{supplier.contact_name || '-'}</TableCell>
                    <TableCell>
                      {supplier.email ? (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {supplier.email}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {supplier.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {supplier.phone}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditModal(supplier)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive"
                          onClick={() => handleDelete(supplier)}
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier 
                ? (language === 'el' ? 'Επεξεργασία' : 'Edit')
                : (language === 'el' ? 'Νέος Προμηθευτής / Υπεργολάβος' : 'New Supplier / Subcontractor')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{language === 'el' ? 'Όνομα' : 'Name'} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === 'el' ? 'Τύπος' : 'Type'} *</Label>
              <Select 
                value={formData.supplier_type} 
                onValueChange={(v: 'supplier' | 'subcontractor' | 'both') => setFormData({ ...formData, supplier_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier">{language === 'el' ? 'Προμηθευτής' : 'Supplier'}</SelectItem>
                  <SelectItem value="subcontractor">{language === 'el' ? 'Υπεργολάβος' : 'Subcontractor'}</SelectItem>
                  <SelectItem value="both">{language === 'el' ? 'Και τα δύο' : 'Both'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'el' ? 'Χώρα' : 'Country'} *</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value.toUpperCase() })}
                  placeholder="GR, CY, DE..."
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'el' ? 'ΑΦΜ' : 'VAT Number'} *</Label>
                <Input
                  value={formData.vat_number}
                  onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'el' ? 'Επαφή' : 'Contact Name'}</Label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === 'el' ? 'Τηλέφωνο' : 'Phone'}</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === 'el' ? 'Σημειώσεις' : 'Notes'}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              {language === 'el' ? 'Ακύρωση' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {language === 'el' ? 'Αποθήκευση' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
  MapPin
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  category: string;
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
    contact_name: '',
    email: '',
    phone: '',
    country: '',
    category: 'materials' as 'materials' | 'services' | 'both',
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
      contact_name: '',
      email: '',
      phone: '',
      country: '',
      category: 'materials',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      country: supplier.country || '',
      category: supplier.category,
      notes: supplier.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error(language === 'el' ? 'Το όνομα είναι υποχρεωτικό' : 'Name is required');
      return;
    }

    try {
      setSaving(true);

      const supplierData = {
        name: formData.name,
        contact_name: formData.contact_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        country: formData.country || null,
        category: formData.category,
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
        if (error) throw error;
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
    s.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'materials': return language === 'el' ? 'Υλικά' : 'Materials';
      case 'services': return language === 'el' ? 'Υπηρεσίες' : 'Services';
      case 'both': return language === 'el' ? 'Υλικά & Υπηρεσίες' : 'Both';
      default: return category;
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
            {language === 'el' ? 'Προμηθευτές' : 'Suppliers'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'el' 
              ? 'Διαχείριση προμηθευτών υλικών και υπηρεσιών' 
              : 'Manage material and service suppliers'}
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          {language === 'el' ? 'Νέος Προμηθευτής' : 'New Supplier'}
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'el' ? 'Αναζήτηση προμηθευτών...' : 'Search suppliers...'}
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
                <TableHead>{language === 'el' ? 'Όνομα' : 'Name'}</TableHead>
                <TableHead>{language === 'el' ? 'Επαφή' : 'Contact'}</TableHead>
                <TableHead>{language === 'el' ? 'Email' : 'Email'}</TableHead>
                <TableHead>{language === 'el' ? 'Τηλέφωνο' : 'Phone'}</TableHead>
                <TableHead>{language === 'el' ? 'Χώρα' : 'Country'}</TableHead>
                <TableHead>{language === 'el' ? 'Κατηγορία' : 'Category'}</TableHead>
                <TableHead className="text-right">{language === 'el' ? 'Ενέργειες' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {language === 'el' ? 'Δεν βρέθηκαν προμηθευτές' : 'No suppliers found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
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
                    <TableCell>
                      {supplier.country ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {supplier.country}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(supplier.category)}</Badge>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSupplier 
                ? (language === 'el' ? 'Επεξεργασία Προμηθευτή' : 'Edit Supplier')
                : (language === 'el' ? 'Νέος Προμηθευτής' : 'New Supplier')}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'el' ? 'Τηλέφωνο' : 'Phone'}</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'el' ? 'Χώρα' : 'Country'}</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === 'el' ? 'Κατηγορία' : 'Category'}</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v: 'materials' | 'services' | 'both') => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="materials">{language === 'el' ? 'Υλικά' : 'Materials'}</SelectItem>
                  <SelectItem value="services">{language === 'el' ? 'Υπηρεσίες' : 'Services'}</SelectItem>
                  <SelectItem value="both">{language === 'el' ? 'Και τα δύο' : 'Both'}</SelectItem>
                </SelectContent>
              </Select>
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

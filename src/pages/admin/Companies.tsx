import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, Building2, Loader2, AlertCircle } from 'lucide-react';

interface Company {
  id: string;
  company_code: string;
  company_name: string;
  vat_number: string;
  tax_office: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  website: string | null;
  is_active: boolean;
  notes: string | null;
}

interface FormData {
  company_name: string;
  vat_number: string;
  tax_office: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  is_active: boolean;
  notes: string;
}

const emptyForm: FormData = {
  company_name: '',
  vat_number: '',
  tax_office: '',
  address: '',
  city: '',
  postal_code: '',
  country: 'Greece',
  phone: '',
  email: '',
  website: '',
  is_active: true,
  notes: ''
};

interface FormErrors {
  [key: string]: string | undefined;
}

export default function Companies() {
  const { language } = useLanguage();
  const t = (en: string, el: string) => language === 'el' ? el : en;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string | null; name: string | null }>({
    isOpen: false, id: null, name: null
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('company_code');
      if (error) throw error;
      setCompanies((data as any[]) || []);
    } catch (error: any) {
      toast.error(error.message || t('Failed to load companies', 'Αποτυχία φόρτωσης εταιριών'));
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.company_name.trim()) newErrors.company_name = t('Enter company name', 'Εισάγετε επωνυμία εταιρίας');
    if (!formData.vat_number.trim()) {
      newErrors.vat_number = t('Enter VAT number', 'Εισάγετε ΑΦΜ');
    }
    if (!formData.tax_office.trim()) newErrors.tax_office = t('Enter tax office', 'Εισάγετε ΔΟΥ');
    if (!formData.address.trim()) newErrors.address = t('Enter address', 'Εισάγετε διεύθυνση');
    if (!formData.city.trim()) newErrors.city = t('Enter city', 'Εισάγετε πόλη');
    if (!formData.postal_code.trim()) newErrors.postal_code = t('Enter postal code', 'Εισάγετε Τ.Κ.');
    if (!formData.country.trim()) newErrors.country = t('Enter country', 'Εισάγετε χώρα');
    if (!formData.phone.trim()) newErrors.phone = t('Enter phone', 'Εισάγετε τηλέφωνο');
    if (!formData.email.trim()) {
      newErrors.email = t('Enter email', 'Εισάγετε email');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('Invalid email', 'Μη έγκυρο email');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setSaving(true);
      const payload = {
        company_name: formData.company_name.trim(),
        vat_number: formData.vat_number.trim(),
        tax_office: formData.tax_office.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        postal_code: formData.postal_code.trim(),
        country: formData.country.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        website: formData.website.trim() || null,
        is_active: formData.is_active,
        notes: formData.notes.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase.from('companies').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success(t('Company updated', 'Η εταιρία ενημερώθηκε'));
      } else {
        const { error } = await supabase.from('companies').insert({ ...payload, company_code: '' });
        if (error) throw error;
        toast.success(t('Company created', 'Η εταιρία δημιουργήθηκε'));
      }
      setShowDialog(false);
      setEditingId(null);
      setFormData(emptyForm);
      fetchCompanies();
    } catch (error: any) {
      toast.error(error.message || t('Failed to save', 'Αποτυχία αποθήκευσης'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingId(company.id);
    setFormData({
      company_name: company.company_name,
      vat_number: company.vat_number,
      tax_office: company.tax_office,
      address: company.address,
      city: company.city,
      postal_code: company.postal_code,
      country: company.country,
      phone: company.phone,
      email: company.email,
      website: company.website || '',
      is_active: company.is_active,
      notes: company.notes || ''
    });
    setErrors({});
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      const { error } = await supabase.from('companies').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      toast.success(t('Company deleted', 'Η εταιρία διαγράφηκε'));
      fetchCompanies();
    } catch (error: any) {
      toast.error(error.message || t('Failed to delete', 'Αποτυχία διαγραφής'));
    } finally {
      setDeleteConfirm({ isOpen: false, id: null, name: null });
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setErrors({});
    setShowDialog(true);
  };

  const filtered = companies.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.company_name.toLowerCase().includes(q) ||
      c.company_code.toLowerCase().includes(q) ||
      c.vat_number.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q);
  });

  const renderField = (label: string, field: keyof FormData, type = 'text', required = true) => (
    <div className="space-y-1.5">
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      <Input
        type={type}
        value={formData[field] as string}
        onChange={(e) => { setFormData({ ...formData, [field]: e.target.value }); if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined })); }}
        className={errors[field] ? 'border-destructive' : ''}
      />
      {errors[field] && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors[field]}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            {t('Companies', 'Εταιρίες')}
          </h2>
          <p className="text-muted-foreground">{t('Manage company entities', 'Διαχείριση εταιριών')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('Add Company', 'Νέα Εταιρία')}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('Search companies...', 'Αναζήτηση εταιριών...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('No companies found', 'Δεν βρέθηκαν εταιρίες')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Code', 'Κωδικός')}</TableHead>
                  <TableHead>{t('Company Name', 'Επωνυμία')}</TableHead>
                  <TableHead>{t('VAT', 'ΑΦΜ')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('City', 'Πόλη')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('Phone', 'Τηλέφωνο')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('Email', 'Email')}</TableHead>
                  <TableHead>{t('Status', 'Κατάσταση')}</TableHead>
                  <TableHead className="text-right">{t('Actions', 'Ενέργειες')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(company => (
                  <TableRow key={company.id}>
                    <TableCell className="font-mono text-sm">{company.company_code}</TableCell>
                    <TableCell className="font-medium">{company.company_name}</TableCell>
                    <TableCell className="font-mono text-sm">{company.vat_number}</TableCell>
                    <TableCell className="hidden md:table-cell">{company.city}</TableCell>
                    <TableCell className="hidden lg:table-cell">{company.phone}</TableCell>
                    <TableCell className="hidden lg:table-cell">{company.email}</TableCell>
                    <TableCell>
                      <Badge variant={company.is_active ? 'default' : 'secondary'}>
                        {company.is_active ? t('Active', 'Ενεργή') : t('Inactive', 'Ανενεργή')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(company)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm({ isOpen: true, id: company.id, name: company.company_name })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); setEditingId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('Edit Company', 'Επεξεργασία Εταιρίας') : t('New Company', 'Νέα Εταιρία')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {renderField(t('Company Name', 'Επωνυμία'), 'company_name')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderField(t('VAT Number', 'ΑΦΜ'), 'vat_number')}
              {renderField(t('Tax Office', 'ΔΟΥ'), 'tax_office')}
            </div>
            {renderField(t('Address', 'Διεύθυνση'), 'address')}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {renderField(t('City', 'Πόλη'), 'city')}
              {renderField(t('Postal Code', 'Τ.Κ.'), 'postal_code')}
              {renderField(t('Country', 'Χώρα'), 'country')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderField(t('Phone', 'Τηλέφωνο'), 'phone')}
              {renderField(t('Email', 'Email'), 'email', 'email')}
            </div>
            {renderField(t('Website', 'Ιστοσελίδα'), 'website', 'url', false)}
            <div className="space-y-1.5">
              <Label>{t('Notes', 'Σημειώσεις')}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
              <Label>{t('Active', 'Ενεργή')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>{t('Cancel', 'Ακύρωση')}</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? t('Update', 'Ενημέρωση') : t('Create', 'Δημιουργία')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false, id: null, name: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Company?', 'Διαγραφή Εταιρίας;')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(`Are you sure you want to delete "${deleteConfirm.name}"? This cannot be undone.`,
                `Είστε σίγουροι ότι θέλετε να διαγράψετε "${deleteConfirm.name}"; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.`)}
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

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  Loader2,
  Upload,
  X,
  Star,
  Search,
  Building2,
  Wrench,
  ArrowLeft,
  Save,
  Send
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  supplier_type: string;
  country: string;
  vat_number: string;
  email: string | null;
  contact_name: string | null;
  is_preferred: boolean;
}

interface UploadedFile {
  file: File;
  name: string;
}

export default function RequestOfferCreate() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    type: 'material' as 'material' | 'service',
    project_name: '',
    vessel_or_job: '',
    title: '',
    description: '',
    qty: '',
    uom: '',
    message_to_recipients: ''
  });
  
  // Recipients
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showPreferredFirst, setShowPreferredFirst] = useState(true);
  
  // Attachments
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, supplier_type, country, vat_number, email, contact_name, is_preferred')
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

  const filteredSuppliers = useMemo(() => {
    let result = suppliers.filter(s => {
      const searchLower = supplierSearch.toLowerCase();
      return (
        s.name?.toLowerCase().includes(searchLower) ||
        s.email?.toLowerCase().includes(searchLower) ||
        s.contact_name?.toLowerCase().includes(searchLower) ||
        s.vat_number?.toLowerCase().includes(searchLower)
      );
    });
    
    if (showPreferredFirst) {
      result = [...result].sort((a, b) => {
        if (a.is_preferred && !b.is_preferred) return -1;
        if (!a.is_preferred && b.is_preferred) return 1;
        return 0;
      });
    }
    
    return result;
  }, [suppliers, supplierSearch, showPreferredFirst]);

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(supplierId) 
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const selectPreferredByType = (type: 'supplier' | 'subcontractor') => {
    const preferred = suppliers.filter(s => 
      s.is_preferred && (s.supplier_type === type || s.supplier_type === 'both')
    ).map(s => s.id);
    setSelectedSuppliers(prev => [...new Set([...prev, ...preferred])]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).map(file => ({
        file,
        name: file.name
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      toast.error(language === 'el' ? 'Ο τίτλος είναι υποχρεωτικός' : 'Title is required');
      return false;
    }
    if (!formData.description.trim()) {
      toast.error(language === 'el' ? 'Η περιγραφή είναι υποχρεωτική' : 'Description is required');
      return false;
    }
    return true;
  };

  const validateForSend = () => {
    if (!validateForm()) return false;
    
    if (selectedSuppliers.length === 0) {
      toast.error(language === 'el' ? 'Επιλέξτε τουλάχιστον έναν παραλήπτη' : 'Select at least one recipient');
      return false;
    }
    
    // Check all selected suppliers have email
    const suppliersWithoutEmail = selectedSuppliers.filter(id => {
      const supplier = suppliers.find(s => s.id === id);
      return !supplier?.email;
    });
    
    if (suppliersWithoutEmail.length > 0) {
      const names = suppliersWithoutEmail.map(id => suppliers.find(s => s.id === id)?.name).join(', ');
      toast.error(
        language === 'el' 
          ? `Οι παρακάτω παραλήπτες δεν έχουν email: ${names}` 
          : `The following recipients have no email: ${names}`
      );
      return false;
    }
    
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validateForm()) return;
    
    try {
      setSaving(true);
      
      // Create request offer
      const { data: ro, error: roError } = await supabase
        .from('request_offers')
        .insert({
          type: formData.type,
          project_name: formData.project_name || null,
          vessel_or_job: formData.vessel_or_job || null,
          title: formData.title,
          description: formData.description,
          qty: formData.qty ? parseFloat(formData.qty) : null,
          uom: formData.uom || null,
          message_to_recipients: formData.message_to_recipients || null,
          status: 'draft',
          created_by: user?.id
        })
        .select()
        .single();

      if (roError) throw roError;

      // Insert recipients
      if (selectedSuppliers.length > 0) {
        const recipients = selectedSuppliers.map(supplierId => ({
          request_offer_id: ro.id,
          supplier_id: supplierId,
          email_used: suppliers.find(s => s.id === supplierId)?.email || null,
          status: 'pending'
        }));

        const { error: recError } = await supabase
          .from('request_offer_recipients')
          .insert(recipients);

        if (recError) throw recError;
      }

      // Upload attachments
      if (uploadedFiles.length > 0) {
        for (const uploadedFile of uploadedFiles) {
          const filePath = `request-offers/${ro.id}/${Date.now()}-${uploadedFile.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from('procurement')
            .upload(filePath, uploadedFile.file);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            continue;
          }

          await supabase
            .from('request_offer_attachments')
            .insert({
              request_offer_id: ro.id,
              file_path: filePath,
              filename: uploadedFile.name,
              uploaded_by: user?.id
            });
        }
      }

      toast.success(language === 'el' ? 'Αποθηκεύτηκε ως πρόχειρο' : 'Saved as draft');
      navigate(`/procurement/request-offers/${ro.id}`);
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast.error(error.message || (language === 'el' ? 'Αποτυχία αποθήκευσης' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!validateForSend()) return;
    
    try {
      setSending(true);
      
      // Create request offer
      const { data: ro, error: roError } = await supabase
        .from('request_offers')
        .insert({
          type: formData.type,
          project_name: formData.project_name || null,
          vessel_or_job: formData.vessel_or_job || null,
          title: formData.title,
          description: formData.description,
          qty: formData.qty ? parseFloat(formData.qty) : null,
          uom: formData.uom || null,
          message_to_recipients: formData.message_to_recipients || null,
          status: 'draft',
          created_by: user?.id
        })
        .select()
        .single();

      if (roError) throw roError;

      // Insert recipients
      const recipients = selectedSuppliers.map(supplierId => ({
        request_offer_id: ro.id,
        supplier_id: supplierId,
        email_used: suppliers.find(s => s.id === supplierId)?.email || null,
        status: 'pending'
      }));

      const { error: recError } = await supabase
        .from('request_offer_recipients')
        .insert(recipients);

      if (recError) throw recError;

      // Upload attachments
      const attachmentPaths: string[] = [];
      if (uploadedFiles.length > 0) {
        for (const uploadedFile of uploadedFiles) {
          const filePath = `request-offers/${ro.id}/${Date.now()}-${uploadedFile.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from('procurement')
            .upload(filePath, uploadedFile.file);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            continue;
          }

          await supabase
            .from('request_offer_attachments')
            .insert({
              request_offer_id: ro.id,
              file_path: filePath,
              filename: uploadedFile.name,
              uploaded_by: user?.id
            });
            
          attachmentPaths.push(filePath);
        }
      }

      // Call edge function to send emails
      const { data: sendResult, error: sendError } = await supabase.functions
        .invoke('send_request_offer_email', {
          body: { request_offer_id: ro.id }
        });

      if (sendError) {
        console.error('Error sending emails:', sendError);
        toast.error(language === 'el' ? 'Αποθηκεύτηκε αλλά η αποστολή email απέτυχε' : 'Saved but email sending failed');
        navigate(`/procurement/request-offers/${ro.id}`);
        return;
      }

      toast.success(
        language === 'el' 
          ? `Απεστάλη σε ${sendResult?.sent_count || 0} παραλήπτες` 
          : `Sent to ${sendResult?.sent_count || 0} recipients`
      );
      navigate(`/procurement/request-offers/${ro.id}`);
    } catch (error: any) {
      console.error('Error sending:', error);
      toast.error(error.message || (language === 'el' ? 'Αποτυχία αποστολής' : 'Failed to send'));
    } finally {
      setSending(false);
    }
  };

  const getSupplierTypeLabel = (type: string) => {
    switch (type) {
      case 'supplier': return language === 'el' ? 'Προμηθευτής' : 'Supplier';
      case 'subcontractor': return language === 'el' ? 'Υπεργολάβος' : 'Subcontractor';
      case 'both': return language === 'el' ? 'Και τα δύο' : 'Both';
      default: return type;
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/procurement/request-offers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {language === 'el' ? 'Νέο Αίτημα Προσφοράς' : 'New Request Offer'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'el' ? 'Δημιουργήστε και στείλτε αίτημα προσφοράς' : 'Create and send a request for offer'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving || sending}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            {language === 'el' ? 'Αποθήκευση' : 'Save Draft'}
          </Button>
          <Button onClick={handleSend} disabled={saving || sending}>
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Send className="h-4 w-4 mr-2" />
            {language === 'el' ? 'Αποστολή' : 'Send Request'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Request Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Details */}
          <Card>
            <CardHeader>
              <CardTitle>{language === 'el' ? 'Στοιχεία Αιτήματος' : 'Request Details'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'el' ? 'Τύπος' : 'Type'} *</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(v: 'material' | 'service') => setFormData({ ...formData, type: v })}
                  >
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
                  <Label>{language === 'el' ? 'Έργο' : 'Project Name'}</Label>
                  <Input
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    placeholder={language === 'el' ? 'π.χ. Ανακαίνιση Σκάφους' : 'e.g. Vessel Renovation'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === 'el' ? 'Σκάφος / Εργασία' : 'Vessel / Job'}</Label>
                <Input
                  value={formData.vessel_or_job}
                  onChange={(e) => setFormData({ ...formData, vessel_or_job: e.target.value })}
                  placeholder={language === 'el' ? 'π.χ. M/Y SKYNET' : 'e.g. M/Y SKYNET'}
                />
              </div>

              <div className="space-y-2">
                <Label>{language === 'el' ? 'Τίτλος' : 'Title'} *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={language === 'el' ? 'Σύντομος τίτλος αιτήματος' : 'Short request title'}
                />
              </div>

              <div className="space-y-2">
                <Label>{language === 'el' ? 'Περιγραφή' : 'Description'} *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={5}
                  placeholder={language === 'el' ? 'Αναλυτική περιγραφή...' : 'Detailed description...'}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'el' ? 'Ποσότητα' : 'Quantity'}</Label>
                  <Input
                    type="number"
                    value={formData.qty}
                    onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'el' ? 'Μονάδα Μέτρησης' : 'Unit of Measure'}</Label>
                  <Input
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    placeholder={language === 'el' ? 'π.χ. τεμ, kg, m' : 'e.g. pcs, kg, m'}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle>{language === 'el' ? 'Συνημμένα' : 'Attachments'}</CardTitle>
              <CardDescription>
                {language === 'el' ? 'Επισυνάψτε σχέδια, φωτογραφίες ή έγγραφα' : 'Attach drawings, photos or documents'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <div className="text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {language === 'el' ? 'Κάντε κλικ για να επιλέξετε αρχεία' : 'Click to select files'}
                    </p>
                  </div>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <span className="text-sm truncate">{file.name}</span>
                        <Button size="sm" variant="ghost" onClick={() => removeFile(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Message */}
          <Card>
            <CardHeader>
              <CardTitle>{language === 'el' ? 'Μήνυμα προς Παραλήπτες' : 'Message to Recipients'}</CardTitle>
              <CardDescription>
                {language === 'el' ? 'Προαιρετικό μήνυμα που θα συμπεριληφθεί στο email' : 'Optional message to include in the email'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.message_to_recipients}
                onChange={(e) => setFormData({ ...formData, message_to_recipients: e.target.value })}
                rows={4}
                placeholder={language === 'el' ? 'Πρόσθετες οδηγίες ή σημειώσεις...' : 'Additional instructions or notes...'}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Recipients */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{language === 'el' ? 'Παραλήπτες' : 'Recipients'}</span>
                <Badge variant="secondary">{selectedSuppliers.length}</Badge>
              </CardTitle>
              <CardDescription>
                {language === 'el' ? 'Επιλέξτε προμηθευτές ή υπεργολάβους' : 'Select suppliers or subcontractors'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick select buttons */}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => selectPreferredByType('supplier')}
                  className="flex-1"
                >
                  <Building2 className="h-4 w-4 mr-1" />
                  <Star className="h-3 w-3 mr-1 text-yellow-500" />
                  {language === 'el' ? 'Προμηθευτές' : 'Suppliers'}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => selectPreferredByType('subcontractor')}
                  className="flex-1"
                >
                  <Wrench className="h-4 w-4 mr-1" />
                  <Star className="h-3 w-3 mr-1 text-yellow-500" />
                  {language === 'el' ? 'Υπεργολάβοι' : 'Subcontractors'}
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === 'el' ? 'Αναζήτηση (όνομα, email, ΑΦΜ)...' : 'Search (name, email, VAT)...'}
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Preferred first toggle */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="preferred-first"
                  checked={showPreferredFirst}
                  onCheckedChange={(checked) => setShowPreferredFirst(!!checked)}
                />
                <label htmlFor="preferred-first" className="text-sm text-muted-foreground cursor-pointer">
                  {language === 'el' ? 'Προτιμώμενοι πρώτα' : 'Preferred first'}
                </label>
              </div>

              {/* Supplier list */}
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {filteredSuppliers.map((supplier) => {
                  const isSelected = selectedSuppliers.includes(supplier.id);
                  return (
                    <div
                      key={supplier.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-primary/10 border-primary' 
                          : 'hover:bg-muted border-transparent bg-muted/50'
                      }`}
                      onClick={() => toggleSupplier(supplier.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{supplier.name}</span>
                            {supplier.is_preferred && (
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            <Badge variant="outline" className="text-xs mr-1">
                              {getSupplierTypeLabel(supplier.supplier_type)}
                            </Badge>
                            {supplier.country && supplier.vat_number && (
                              <span>{supplier.country} - {supplier.vat_number}</span>
                            )}
                          </div>
                          {supplier.email && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{supplier.email}</p>
                          )}
                        </div>
                        <Checkbox checked={isSelected} className="mt-1" />
                      </div>
                    </div>
                  );
                })}

                {filteredSuppliers.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    {language === 'el' ? 'Δεν βρέθηκαν προμηθευτές' : 'No suppliers found'}
                  </p>
                )}
              </div>

              {/* Clear selection */}
              {selectedSuppliers.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setSelectedSuppliers([])}
                >
                  {language === 'el' ? 'Καθαρισμός επιλογής' : 'Clear selection'}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

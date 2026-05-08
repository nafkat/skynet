import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  Loader2, Upload, X, Star, Search, Building2, Wrench,
  ArrowLeft, Save, Send, CalendarIcon, AlertCircle, Eye,
  FileText, Image, FileSpreadsheet, File, Plus
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  trade_name: string;
  supplier_type: string;
  country: string;
  vat_number: string;
  email: string | null;
  contact_name: string | null;
  is_preferred: boolean;
  category: string | null;
}

interface Project {
  id: string;
  project_name: string;
  project_code: string;
}

interface Company {
  id: string;
  company_code: string;
  company_name: string;
}

interface UploadedFile {
  file: File;
  name: string;
  size: number;
}

interface LineItem {
  id: string;
  item_number: number;
  description: string;
  qty: string;
  uom: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  contact_phone?: string;
  contact_person?: string;
  delivery_location?: string;
  project_id?: string;
  company_id?: string;
  recipients?: string;
  files?: string;
  lineItems?: string;
}

const MAX_TOTAL_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || ''))
    return <Image className="h-4 w-4 text-blue-500" />;
  if (['xls', 'xlsx', 'csv'].includes(ext || ''))
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  if (['pdf'].includes(ext || ''))
    return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export default function RequestOfferCreate() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const duplicateFromId = searchParams.get('duplicate');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    type: 'material' as 'material' | 'service',
    priority: 'normal' as 'normal' | 'urgent',
    company_id: '',
    project_id: '',
    vessel_or_job: '',
    title: '',
    description: '',
    special_instructions: '',
    response_deadline: undefined as Date | undefined,
    needed_by: undefined as Date | undefined,
    delivery_location: '',
    contact_person: '',
    contact_phone: '',
    message_to_recipients: ''
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  
  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), item_number: 1, description: '', qty: '', uom: '' }
  ]);
  
  // Recipients
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Attachments
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const totalFileSize = useMemo(() => 
    uploadedFiles.reduce((sum, f) => sum + f.size, 0), [uploadedFiles]
  );

  useEffect(() => {
    fetchSuppliers();
    fetchProjects();
    fetchCompanies();
  }, []);

  // Load duplicate data
  useEffect(() => {
    if (duplicateFromId) {
      loadDuplicateData(duplicateFromId);
    }
  }, [duplicateFromId]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      if (formData.title.trim() && !sending) {
        autoSaveDraft();
      }
    }, 30000);
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [formData, selectedSuppliers, draftId, lineItems]);

  const loadDuplicateData = async (id: string) => {
    try {
      setLoading(true);
      const { data: ro, error } = await supabase
        .from('request_offers')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;

      setFormData({
        type: ro.type as 'material' | 'service',
        priority: (ro.priority === 'urgent' ? 'urgent' : 'normal') as 'normal' | 'urgent',
        company_id: (ro as any).company_id || '',
        project_id: (ro as any).project_id || '',
        vessel_or_job: ro.vessel_or_job || '',
        title: ro.title,
        description: ro.description,
        special_instructions: ro.special_instructions || '',
        response_deadline: ro.response_deadline ? new Date(ro.response_deadline) : undefined,
        needed_by: ro.needed_by ? new Date(ro.needed_by) : undefined,
        delivery_location: ro.delivery_location || '',
        contact_person: ro.contact_person || '',
        contact_phone: ro.contact_phone || '',
        message_to_recipients: ro.message_to_recipients || ''
      });

      // Load recipients
      const { data: recs } = await supabase
        .from('request_offer_recipients')
        .select('supplier_id')
        .eq('request_offer_id', id);
      if (recs) {
        setSelectedSuppliers(recs.map(r => r.supplier_id!));
      }

      // Load line items
      const { data: items } = await supabase
        .from('request_offer_items')
        .select('*')
        .eq('request_offer_id', id)
        .order('item_number');
      if (items && items.length > 0) {
        setLineItems(items.map(item => ({
          id: crypto.randomUUID(),
          item_number: item.item_number,
          description: item.description,
          qty: item.qty ? String(item.qty) : '',
          uom: item.uom || ''
        })));
      }

      toast.success(language === 'el' ? 'Αίτημα αντιγράφηκε. Ελέγξτε και στείλτε.' : 'Request offer duplicated. Review and send.');
    } catch (error) {
      console.error('Error loading duplicate:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoSaveDraft = async () => {
    if (!user) return;
    try {
      const payload = buildPayload('draft');
      if (draftId) {
        await supabase.from('request_offers').update(payload).eq('id', draftId);
      } else {
        const { data } = await supabase.from('request_offers').insert({ ...payload, created_by: user.id }).select('id').single();
        if (data) setDraftId(data.id);
      }
      setLastSavedAt(new Date());
    } catch (e) {
      // Silent fail for auto-save
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, project_code')
        .eq('status', 'OPEN')
        .order('project_name');
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, company_code, company_name')
        .eq('is_active', true)
        .order('company_name');
      if (error) throw error;
      setCompanies((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, trade_name, supplier_type, country, vat_number, email, contact_name, is_preferred, category')
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
    return suppliers.filter(s => {
      const searchLower = supplierSearch.toLowerCase();
      const matchesSearch = (
        s.name?.toLowerCase().includes(searchLower) ||
        s.trade_name?.toLowerCase().includes(searchLower) ||
        s.email?.toLowerCase().includes(searchLower) ||
        s.contact_name?.toLowerCase().includes(searchLower) ||
        s.vat_number?.toLowerCase().includes(searchLower)
      );
      if (!matchesSearch) return false;

      if (categoryFilter === 'materials') return s.category === 'materials' || s.category === 'both';
      if (categoryFilter === 'services') return s.category === 'services' || s.category === 'both';
      if (categoryFilter === 'both') return s.category === 'both';
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, supplierSearch, categoryFilter]);

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(supplierId) 
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
    if (errors.recipients) setErrors(prev => ({ ...prev, recipients: undefined }));
  };

  const selectPreferredByType = (type: 'supplier' | 'subcontractor') => {
    const preferred = suppliers.filter(s => 
      s.is_preferred && (s.supplier_type === type || s.supplier_type === 'both')
    ).map(s => s.id);
    setSelectedSuppliers(prev => [...new Set([...prev, ...preferred])]);
  };

  // Line items
  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), item_number: prev.length + 1, description: '', qty: '', uom: '' }
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => 
      prev.filter(item => item.id !== id).map((item, idx) => ({ ...item, item_number: idx + 1 }))
    );
  };

  const updateLineItem = (id: string, field: string, value: string) => {
    setLineItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
    if (errors.lineItems) setErrors(prev => ({ ...prev, lineItems: undefined }));
  };

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files) addFiles(Array.from(files));
  }, [uploadedFiles]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) addFiles(Array.from(files));
    e.target.value = '';
  };

  const addFiles = (files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => ({
      file, name: file.name, size: file.size
    }));
    const newTotal = totalFileSize + newFiles.reduce((s, f) => s + f.size, 0);
    if (newTotal > MAX_TOTAL_FILE_SIZE) {
      setErrors(prev => ({ ...prev, files: language === 'el' ? 'Το συνολικό μέγεθος αρχείων υπερβαίνει τα 10 MB' : 'Total file size exceeds 10 MB limit' }));
      return;
    }
    setErrors(prev => ({ ...prev, files: undefined }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setErrors(prev => ({ ...prev, files: undefined }));
  };

  // Validation
  const validateField = (field: string, value: string) => {
    switch (field) {
      case 'title':
        if (!value.trim()) return language === 'el' ? 'Εισάγετε τίτλο (τουλάχιστον 3 χαρακτήρες)' : 'Please enter a title (minimum 3 characters)';
        if (value.trim().length < 3) return language === 'el' ? 'Ο τίτλος πρέπει να έχει τουλάχιστον 3 χαρακτήρες' : 'Title must be at least 3 characters';
        return undefined;
      case 'description':
        if (!value.trim()) return language === 'el' ? 'Εισάγετε περιγραφή (τουλάχιστον 10 χαρακτήρες)' : 'Please enter a description (minimum 10 characters)';
        if (value.trim().length < 10) return language === 'el' ? 'Η περιγραφή πρέπει να έχει τουλάχιστον 10 χαρακτήρες' : 'Description must be at least 10 characters';
        return undefined;
      case 'contact_phone':
        if (!value.trim()) return language === 'el' ? 'Εισάγετε τηλέφωνο επικοινωνίας' : 'Please enter contact phone';
        if (!/^\+?[\d\s\-()]{7,20}$/.test(value.trim())) return language === 'el' ? 'Μορφή τηλεφώνου: +30 210 1234567' : 'Phone number format: +30 210 1234567';
        return undefined;
      case 'contact_person':
        if (!value.trim()) return language === 'el' ? 'Εισάγετε υπεύθυνο επικοινωνίας' : 'Please enter contact person';
        return undefined;
      case 'delivery_location':
        if (!value.trim()) return language === 'el' ? 'Εισάγετε τοποθεσία παράδοσης' : 'Please enter delivery location';
        return undefined;
      default:
        return undefined;
    }
  };

  const handleBlur = (field: string) => {
    const error = validateField(field, (formData as any)[field]);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    if (!formData.company_id) {
      newErrors.company_id = language === 'el' ? 'Επιλέξτε εταιρία' : 'Please select a company';
    }
    const titleErr = validateField('title', formData.title);
    if (titleErr) newErrors.title = titleErr;
    const descErr = validateField('description', formData.description);
    if (descErr) newErrors.description = descErr;
    const phoneErr = validateField('contact_phone', formData.contact_phone);
    if (phoneErr) newErrors.contact_phone = phoneErr;
    const personErr = validateField('contact_person', formData.contact_person);
    if (personErr) newErrors.contact_person = personErr;
    const locErr = validateField('delivery_location', formData.delivery_location);
    if (locErr) newErrors.delivery_location = locErr;
    if (!formData.project_id) {
      newErrors.project_id = language === 'el' ? 'Επιλέξτε έργο' : 'Please select a project';
    }
    const hasValidItems = lineItems.some(item => item.description.trim());
    if (!hasValidItems) {
      newErrors.lineItems = language === 'el' ? 'Προσθέστε τουλάχιστον ένα είδος' : 'Add at least one item with description';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateForSend = () => {
    if (!validateForm()) return false;
    
    if (selectedSuppliers.length === 0) {
      setErrors(prev => ({ ...prev, recipients: language === 'el' ? 'Επιλέξτε τουλάχιστον έναν παραλήπτη' : 'Please select at least one recipient' }));
      return false;
    }
    
    const suppliersWithoutEmail = selectedSuppliers.filter(id => {
      const supplier = suppliers.find(s => s.id === id);
      return !supplier?.email;
    });
    
    if (suppliersWithoutEmail.length > 0) {
      const names = suppliersWithoutEmail.map(id => suppliers.find(s => s.id === id)?.name).join(', ');
      toast.error(
        language === 'el' 
          ? `Οι παρακάτω παραλήπτες δεν έχουν email: ${names}` 
          : `The following recipients have no email: ${names}`,
        { duration: 10000 }
      );
      return false;
    }
    
    return true;
  };

  const getSelectedProjectName = () => {
    const p = projects.find(pr => pr.id === formData.project_id);
    return p ? `${p.project_code} - ${p.project_name}` : '';
  };

  const buildPayload = (status: string) => ({
    type: formData.type,
    priority: formData.priority,
    company_id: formData.company_id || null,
    project_id: formData.project_id || null,
    project_name: getSelectedProjectName() || null,
    vessel_or_job: formData.vessel_or_job || null,
    title: formData.title,
    description: formData.description,
    special_instructions: formData.special_instructions || null,
    qty: null,
    uom: null,
    response_deadline: formData.response_deadline ? format(formData.response_deadline, 'yyyy-MM-dd') : null,
    needed_by: formData.needed_by ? format(formData.needed_by, 'yyyy-MM-dd') : null,
    delivery_location: formData.delivery_location,
    contact_person: formData.contact_person,
    contact_phone: formData.contact_phone,
    message_to_recipients: formData.message_to_recipients || null,
    status
  });

  const saveRecordsAndFiles = async (roId: string) => {
    // Insert recipients
    if (selectedSuppliers.length > 0) {
      await supabase.from('request_offer_recipients').delete().eq('request_offer_id', roId);
      
      const recipients = selectedSuppliers.map(supplierId => ({
        request_offer_id: roId,
        supplier_id: supplierId,
        email_used: suppliers.find(s => s.id === supplierId)?.email || null,
        status: 'pending'
      }));
      const { error: recError } = await supabase.from('request_offer_recipients').insert(recipients);
      if (recError) throw recError;
    }

    // Save line items
    await supabase.from('request_offer_items').delete().eq('request_offer_id', roId);
    const validItems = lineItems.filter(item => item.description.trim());
    if (validItems.length > 0) {
      const itemsToInsert = validItems.map((item, idx) => ({
        request_offer_id: roId,
        item_number: idx + 1,
        description: item.description,
        qty: item.qty ? parseFloat(item.qty) : null,
        uom: item.uom || null
      }));
      const { error: itemsError } = await supabase.from('request_offer_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;
    }

    // Upload attachments
    if (uploadedFiles.length > 0) {
      for (const uploadedFile of uploadedFiles) {
        const filePath = `request-offers/${roId}/${Date.now()}-${uploadedFile.name}`;
        const { error: uploadError } = await supabase.storage.from('procurement').upload(filePath, uploadedFile.file);
        if (uploadError) { console.error('Error uploading file:', uploadError); continue; }
        await supabase.from('request_offer_attachments').insert({
          request_offer_id: roId,
          file_path: filePath,
          filename: uploadedFile.name,
          uploaded_by: user?.id
        });
      }
    }
  };

  const handleSaveDraft = async () => {
    if (!validateForm()) return;
    try {
      setSaving(true);
      let roId = draftId;
      if (roId) {
        const { error } = await supabase.from('request_offers').update(buildPayload('draft')).eq('id', roId);
        if (error) throw error;
      } else {
        const { data: ro, error } = await supabase
          .from('request_offers')
          .insert({ ...buildPayload('draft'), created_by: user?.id })
          .select().single();
        if (error) throw error;
        roId = ro.id;
      }
      await saveRecordsAndFiles(roId!);
      toast.success(language === 'el' ? 'Αποθηκεύτηκε ως πρόχειρο' : 'Saved as draft');
      navigate(`/procurement/request-offers/${roId}`);
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
      let roId = draftId;
      if (roId) {
        const { error } = await supabase.from('request_offers').update(buildPayload('draft')).eq('id', roId);
        if (error) throw error;
      } else {
        const { data: ro, error } = await supabase
          .from('request_offers')
          .insert({ ...buildPayload('draft'), created_by: user?.id })
          .select().single();
        if (error) throw error;
        roId = ro.id;
      }
      await saveRecordsAndFiles(roId!);

      const { data: sendResult, error: sendError } = await supabase.functions
        .invoke('send_request_offer_email', { body: { request_offer_id: roId } });

      if (sendError) {
        toast.error(language === 'el' ? 'Αποθηκεύτηκε αλλά η αποστολή email απέτυχε' : 'Saved but email sending failed');
        navigate(`/procurement/request-offers/${roId}`);
        return;
      }

      toast.success(
        language === 'el' 
          ? `Απεστάλη σε ${sendResult?.sent_count || 0} παραλήπτες` 
          : `Sent to ${sendResult?.sent_count || 0} recipients`
      );
      navigate(`/procurement/request-offers/${roId}`);
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

  const t = (en: string, el: string) => language === 'el' ? el : en;

  if (loading && !duplicateFromId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/procurement/request-offers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {duplicateFromId ? t('Duplicate Request Offer', 'Αντιγραφή Αιτήματος Προσφοράς') : t('New Request Offer', 'Νέο Αίτημα Προσφοράς')}
            </h1>
            <p className="text-muted-foreground">
              {t('Create and send a request for offer', 'Δημιουργήστε και στείλτε αίτημα προσφοράς')}
            </p>
            {lastSavedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('Draft saved at', 'Πρόχειρο αποθηκεύτηκε στις')} {format(lastSavedAt, 'HH:mm')}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setShowPreview(true)} disabled={saving || sending} className="flex-1 sm:flex-none">
            <Eye className="h-4 w-4 mr-2" />
            {t('Preview', 'Προεπισκόπηση')}
          </Button>
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving || sending} className="flex-1 sm:flex-none">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            {t('Save Draft', 'Αποθήκευση')}
          </Button>
          <Button onClick={handleSend} disabled={saving || sending} className="flex-1 sm:flex-none">
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Send className="h-4 w-4 mr-2" />
            {t('Send Request', 'Αποστολή')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Request Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('Request Details', 'Στοιχεία Αιτήματος')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Type */}
                <div className="space-y-2">
                  <Label>{t('Type', 'Τύπος')} <span className="text-destructive">*</span></Label>
                  <Select value={formData.type} onValueChange={(v: 'material' | 'service') => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="material">{t('Material', 'Υλικό')}</SelectItem>
                      <SelectItem value="service">{t('Service', 'Υπηρεσία')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Priority */}
                <div className="space-y-2">
                  <Label>{t('Priority', 'Προτεραιότητα')}</Label>
                  <Select value={formData.priority} onValueChange={(v: 'normal' | 'urgent') => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">{t('Normal', 'Κανονική')}</SelectItem>
                      <SelectItem value="urgent">{t('Urgent', 'Επείγον')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.priority === 'urgent' && (
                    <Badge variant="destructive" className="text-xs">{t('Urgent', 'Επείγον')}</Badge>
                  )}
                </div>
              </div>

              {/* Company dropdown */}
              <div className="space-y-2">
                <Label>{t('Company', 'Εταιρία')} <span className="text-destructive">*</span></Label>
                <Select value={formData.company_id} onValueChange={(v) => { setFormData({ ...formData, company_id: v }); if (errors.company_id) setErrors(prev => ({ ...prev, company_id: undefined })); }}>
                  <SelectTrigger className={cn(errors.company_id && 'border-destructive')}>
                    <SelectValue placeholder={t('Select company...', 'Επιλέξτε εταιρία...')} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company_code} - {c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.company_id && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.company_id}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Project dropdown */}
                <div className="space-y-2">
                  <Label>{t('Project', 'Έργο')} <span className="text-destructive">*</span></Label>
                  <Select value={formData.project_id} onValueChange={(v) => { setFormData({ ...formData, project_id: v }); if (errors.project_id) setErrors(prev => ({ ...prev, project_id: undefined })); }}>
                    <SelectTrigger className={cn(errors.project_id && 'border-destructive')}>
                      <SelectValue placeholder={t('Select project...', 'Επιλέξτε έργο...')} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.project_code} - {p.project_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.project_id && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.project_id}</p>}
                </div>
                <div className="space-y-2">
                  <Label>{t('Vessel / Job', 'Σκάφος / Εργασία')}</Label>
                  <Input value={formData.vessel_or_job} onChange={(e) => setFormData({ ...formData, vessel_or_job: e.target.value })} placeholder={t('e.g. M/Y SKYNET', 'π.χ. M/Y SKYNET')} />
                </div>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label>{t('Title', 'Τίτλος')} <span className="text-destructive">*</span></Label>
                <Input
                  value={formData.title}
                  onChange={(e) => { setFormData({ ...formData, title: e.target.value }); if (errors.title) setErrors(prev => ({ ...prev, title: undefined })); }}
                  onBlur={() => handleBlur('title')}
                  placeholder={t('Short request title', 'Σύντομος τίτλος αιτήματος')}
                  className={cn(errors.title && 'border-destructive')}
                />
                {errors.title && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.title}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>{t('Description', 'Περιγραφή')} <span className="text-destructive">*</span></Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => { setFormData({ ...formData, description: e.target.value }); if (errors.description) setErrors(prev => ({ ...prev, description: undefined })); }}
                  onBlur={() => handleBlur('description')}
                  rows={5}
                  placeholder={t('Detailed description...', 'Αναλυτική περιγραφή...')}
                  className={cn(errors.description && 'border-destructive')}
                />
                {errors.description && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.description}</p>}
              </div>

              {/* Special Instructions */}
              <div className="space-y-2">
                <Label>{t('Special Instructions', 'Ειδικές Οδηγίες')}</Label>
                <Textarea
                  value={formData.special_instructions}
                  onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
                  rows={3}
                  placeholder={t('Any special requirements or instructions...', 'Ειδικές απαιτήσεις ή οδηγίες...')}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('Response Deadline', 'Προθεσμία Απάντησης')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.response_deadline && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.response_deadline ? format(formData.response_deadline, 'dd/MM/yyyy') : t('Pick a date', 'Επιλέξτε ημερομηνία')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={formData.response_deadline} onSelect={(d) => setFormData({ ...formData, response_deadline: d })} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>{t('Needed By', 'Απαιτείται Μέχρι')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.needed_by && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.needed_by ? format(formData.needed_by, 'dd/MM/yyyy') : t('Pick a date', 'Επιλέξτε ημερομηνία')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={formData.needed_by} onSelect={(d) => setFormData({ ...formData, needed_by: d })} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Contact & Location - now required */}
              <div className="space-y-2">
                <Label>{t('Delivery Location', 'Τοποθεσία Παράδοσης')} <span className="text-destructive">*</span></Label>
                <Input
                  value={formData.delivery_location}
                  onChange={(e) => { setFormData({ ...formData, delivery_location: e.target.value }); if (errors.delivery_location) setErrors(prev => ({ ...prev, delivery_location: undefined })); }}
                  onBlur={() => handleBlur('delivery_location')}
                  placeholder={t('e.g. Shipyard A, Dock 3', 'π.χ. Ναυπηγείο Α, Ντοκ 3')}
                  className={cn(errors.delivery_location && 'border-destructive')}
                />
                {errors.delivery_location && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.delivery_location}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('Contact Person', 'Υπεύθυνος Επικοινωνίας')} <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => { setFormData({ ...formData, contact_person: e.target.value }); if (errors.contact_person) setErrors(prev => ({ ...prev, contact_person: undefined })); }}
                    onBlur={() => handleBlur('contact_person')}
                    className={cn(errors.contact_person && 'border-destructive')}
                  />
                  {errors.contact_person && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.contact_person}</p>}
                </div>
                <div className="space-y-2">
                  <Label>{t('Contact Phone', 'Τηλέφωνο Επικοινωνίας')} <span className="text-destructive">*</span></Label>
                  <Input
                    value={formData.contact_phone}
                    onChange={(e) => { setFormData({ ...formData, contact_phone: e.target.value }); if (errors.contact_phone) setErrors(prev => ({ ...prev, contact_phone: undefined })); }}
                    onBlur={() => handleBlur('contact_phone')}
                    placeholder={t('e.g. +30 210 1234567', 'π.χ. +30 210 1234567')}
                    className={cn(errors.contact_phone && 'border-destructive')}
                  />
                  {errors.contact_phone && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.contact_phone}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>{t('Items / Line Items', 'Είδη / Γραμμές')} <span className="text-destructive">*</span></CardTitle>
              <CardDescription>{t('Add items or services for this request', 'Προσθέστε είδη ή υπηρεσίες για αυτό το αίτημα')}</CardDescription>
              {errors.lineItems && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.lineItems}</p>}
            </CardHeader>
            <CardContent className="space-y-4">
              {lineItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t('Item', 'Είδος')} {item.item_number}</span>
                    {lineItems.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeLineItem(item.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label>{t('Description', 'Περιγραφή')} <span className="text-destructive">*</span></Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      placeholder={t('Item description...', 'Περιγραφή είδους...')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{t('Quantity', 'Ποσότητα')}</Label>
                      <Input
                        type="number"
                        value={item.qty}
                        onChange={(e) => updateLineItem(item.id, 'qty', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>{t('Unit', 'Μονάδα')}</Label>
                      <Input
                        value={item.uom}
                        onChange={(e) => updateLineItem(item.id, 'uom', e.target.value)}
                        placeholder={t('e.g., pcs, L, kg', 'π.χ. τεμ, L, kg')}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addLineItem} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {t('Add Another Item', 'Προσθήκη Άλλου Είδους')}
              </Button>
            </CardContent>
          </Card>

          {/* Attachments with drag & drop */}
          <Card>
            <CardHeader>
              <CardTitle>{t('Attachments', 'Συνημμένα')}</CardTitle>
              <CardDescription>{t('Attach drawings, photos or documents', 'Επισυνάψτε σχέδια, φωτογραφίες ή έγγραφα')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <label
                  className={cn(
                    "flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t('Drag files here or click to browse', 'Σύρετε αρχεία ή κάντε κλικ')}
                    </p>
                  </div>
                  <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                </label>

                {errors.files && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.files}</p>}

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          {getFileIcon(file.name)}
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{formatFileSize(file.size)}</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeFile(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {t('Total', 'Σύνολο')}: {formatFileSize(totalFileSize)} / 10 MB
                      </span>
                      <Progress value={(totalFileSize / MAX_TOTAL_FILE_SIZE) * 100} className="h-2 flex-1" />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Message */}
          <Card>
            <CardHeader>
              <CardTitle>{t('Message to Recipients', 'Μήνυμα προς Παραλήπτες')}</CardTitle>
              <CardDescription>{t('Optional message to include in the email', 'Προαιρετικό μήνυμα που θα συμπεριληφθεί στο email')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.message_to_recipients}
                onChange={(e) => setFormData({ ...formData, message_to_recipients: e.target.value })}
                rows={4}
                placeholder={t('Additional instructions or notes...', 'Πρόσθετες οδηγίες ή σημειώσεις...')}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Recipients */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('Recipients', 'Παραλήπτες')}</span>
                <Badge variant="secondary">
                  {selectedSuppliers.length} {t('selected', 'επιλέχθηκαν')}
                </Badge>
              </CardTitle>
              <CardDescription>{t('Select suppliers or subcontractors', 'Επιλέξτε προμηθευτές ή υπεργολάβους')}</CardDescription>
              {errors.recipients && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.recipients}</p>}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category filter */}
              <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="all" className="text-xs">{t('All', 'Όλα')}</TabsTrigger>
                  <TabsTrigger value="materials" className="text-xs">{t('Materials', 'Υλικά')}</TabsTrigger>
                  <TabsTrigger value="services" className="text-xs">{t('Services', 'Υπηρεσίες')}</TabsTrigger>
                  <TabsTrigger value="both" className="text-xs">{t('Both', 'Και τα δύο')}</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Quick select buttons */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => selectPreferredByType('supplier')} className="flex-1">
                  <Building2 className="h-4 w-4 mr-1" />
                  <Star className="h-3 w-3 mr-1 text-yellow-500" />
                  {t('Suppliers', 'Προμηθευτές')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => selectPreferredByType('subcontractor')} className="flex-1">
                  <Wrench className="h-4 w-4 mr-1" />
                  <Star className="h-3 w-3 mr-1 text-yellow-500" />
                  {t('Subcontractors', 'Υπεργολάβοι')}
                </Button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('Search (name, email, VAT)...', 'Αναζήτηση (όνομα, email, ΑΦΜ)...')}
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Supplier list */}
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {filteredSuppliers.map((supplier) => {
                  const isSelected = selectedSuppliers.includes(supplier.id);
                  return (
                    <div
                      key={supplier.id}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors min-h-[44px]",
                        isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted border-transparent bg-muted/50'
                      )}
                      onClick={() => toggleSupplier(supplier.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{supplier.name}</span>
                            {supplier.is_preferred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                          </div>
                          {supplier.trade_name && <p className="text-xs text-muted-foreground truncate">{supplier.trade_name}</p>}
                          <div className="text-xs text-muted-foreground mt-1">
                            <Badge variant="outline" className="text-xs mr-1">{getSupplierTypeLabel(supplier.supplier_type)}</Badge>
                            {supplier.country && supplier.vat_number && <span>{supplier.country} - {supplier.vat_number}</span>}
                          </div>
                          {supplier.email && <p className="text-xs text-muted-foreground mt-1 truncate">{supplier.email}</p>}
                        </div>
                        <Checkbox checked={isSelected} className="mt-1" />
                      </div>
                    </div>
                  );
                })}
                {filteredSuppliers.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">{t('No suppliers found', 'Δεν βρέθηκαν προμηθευτές')}</p>
                )}
              </div>

              {selectedSuppliers.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedSuppliers([])}>
                  {t('Clear selection', 'Καθαρισμός επιλογής')}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile sticky buttons */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t z-40 flex gap-2">
        <Button variant="outline" onClick={handleSaveDraft} disabled={saving || sending} className="flex-1">
          <Save className="h-4 w-4 mr-1" />
          {t('Save', 'Αποθ.')}
        </Button>
        <Button onClick={handleSend} disabled={saving || sending} className="flex-1">
          <Send className="h-4 w-4 mr-1" />
          {t('Send', 'Αποστολή')}
        </Button>
      </div>
      <div className="sm:hidden h-16" />

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('Email Preview', 'Προεπισκόπηση Email')}</DialogTitle>
            <DialogDescription>{t('Review before sending', 'Ελέγξτε πριν την αποστολή')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-medium">{t('Subject', 'Θέμα')}:</span>
                <span className="text-sm">{formData.title || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">{t('Type', 'Τύπος')}:</span>
                <span className="text-sm">{formData.type === 'material' ? t('Material', 'Υλικό') : t('Service', 'Υπηρεσία')}</span>
              </div>
              {formData.priority === 'urgent' && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{t('Priority', 'Προτεραιότητα')}:</span>
                  <Badge variant="destructive">{t('Urgent', 'Επείγον')}</Badge>
                </div>
              )}
              {formData.company_id && <div className="flex justify-between"><span className="text-sm font-medium">{t('Company', 'Εταιρία')}:</span><span className="text-sm">{companies.find(c => c.id === formData.company_id)?.company_name || '—'}</span></div>}
              {formData.project_id && <div className="flex justify-between"><span className="text-sm font-medium">{t('Project', 'Έργο')}:</span><span className="text-sm">{getSelectedProjectName()}</span></div>}
              {formData.vessel_or_job && <div className="flex justify-between"><span className="text-sm font-medium">{t('Vessel/Job', 'Σκάφος/Εργασία')}:</span><span className="text-sm">{formData.vessel_or_job}</span></div>}
              {formData.response_deadline && <div className="flex justify-between"><span className="text-sm font-medium">{t('Response Deadline', 'Προθεσμία')}:</span><span className="text-sm">{format(formData.response_deadline, 'dd/MM/yyyy')}</span></div>}
              {formData.needed_by && <div className="flex justify-between"><span className="text-sm font-medium">{t('Needed By', 'Απαιτείται Μέχρι')}:</span><span className="text-sm">{format(formData.needed_by, 'dd/MM/yyyy')}</span></div>}
              {formData.delivery_location && <div className="flex justify-between"><span className="text-sm font-medium">{t('Delivery Location', 'Τοποθεσία')}:</span><span className="text-sm">{formData.delivery_location}</span></div>}
              {formData.contact_person && <div className="flex justify-between"><span className="text-sm font-medium">{t('Contact', 'Επικοινωνία')}:</span><span className="text-sm">{formData.contact_person} {formData.contact_phone}</span></div>}
            </div>

            <div>
              <p className="text-sm font-medium mb-1">{t('Description', 'Περιγραφή')}</p>
              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">{formData.description || '—'}</p>
            </div>

            {formData.special_instructions && (
              <div>
                <p className="text-sm font-medium mb-1">{t('Special Instructions', 'Ειδικές Οδηγίες')}</p>
                <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">{formData.special_instructions}</p>
              </div>
            )}

            {/* Line items in preview */}
            {lineItems.some(i => i.description.trim()) && (
              <div>
                <p className="text-sm font-medium mb-2">{t('Items', 'Είδη')}</p>
                <div className="space-y-1">
                  {lineItems.filter(i => i.description.trim()).map((item) => (
                    <div key={item.id} className="text-sm bg-muted p-2 rounded flex justify-between">
                      <span>{item.item_number}. {item.description}</span>
                      {item.qty && <span className="text-muted-foreground">{item.qty} {item.uom}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formData.message_to_recipients && (
              <div>
                <p className="text-sm font-medium mb-1">{t('Message to Recipients', 'Μήνυμα')}</p>
                <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">{formData.message_to_recipients}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium mb-2">{t('Recipients', 'Παραλήπτες')} ({selectedSuppliers.length})</p>
              <div className="space-y-1">
                {selectedSuppliers.map(id => {
                  const s = suppliers.find(sup => sup.id === id);
                  return s ? (
                    <div key={id} className="text-sm flex justify-between bg-muted p-2 rounded">
                      <span>{s.name}</span>
                      <span className="text-muted-foreground">{s.email || t('No email', 'Χωρίς email')}</span>
                    </div>
                  ) : null;
                })}
                {selectedSuppliers.length === 0 && <p className="text-sm text-muted-foreground">{t('No recipients selected', 'Κανένας παραλήπτης')}</p>}
              </div>
            </div>

            {uploadedFiles.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">{t('Attachments', 'Συνημμένα')} ({uploadedFiles.length})</p>
                <div className="space-y-1">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="text-sm flex justify-between bg-muted p-2 rounded">
                      <span className="flex items-center gap-1">{getFileIcon(f.name)} {f.name}</span>
                      <span className="text-muted-foreground">{formatFileSize(f.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>{t('Edit', 'Επεξεργασία')}</Button>
            <Button onClick={() => { setShowPreview(false); handleSend(); }} disabled={sending}>
              <Send className="h-4 w-4 mr-2" />
              {t('Send Request', 'Αποστολή')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

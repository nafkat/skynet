import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Search, Star, X, Upload, FileText, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  category: string;
  is_preferred: boolean;
}

interface PendingFile {
  file: File;
  id: string;
}

interface CreateRFQModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prId: string;
  prType: 'material' | 'service';
  prNumber: string;
  prDescription?: string;
  prProjectCode?: string;
}

export default function CreateRFQModal({ 
  open, 
  onOpenChange, 
  prId, 
  prType, 
  prNumber,
  prDescription,
  prProjectCode 
}: CreateRFQModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  useEffect(() => {
    if (open) {
      fetchSuppliers();
      setSelectedSuppliers([]);
      setNotes('');
      setSearchQuery('');
      setPendingFiles([]);
    }
  }, [open]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, email, category, is_preferred')
        .order('is_preferred', { ascending: false })
        .order('name');

      if (error) throw error;
      setSuppliers((data || []) as Supplier[]);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης προμηθευτών' : 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryForPR = () => {
    return prType === 'material' ? 'materials' : 'services';
  };

  const handleQuickSelect = () => {
    const category = getCategoryForPR();
    const preferred = suppliers.filter(s => 
      s.is_preferred && (s.category === category || s.category === 'both')
    );
    const toSelect = preferred.slice(0, 5).map(s => s.id);
    setSelectedSuppliers(toSelect);
    toast.info(
      language === 'el' 
        ? `Επιλέχθηκαν ${toSelect.length} προτιμώμενοι προμηθευτές` 
        : `Selected ${toSelect.length} preferred suppliers`
    );
  };

  const handleClearSelection = () => {
    setSelectedSuppliers([]);
  };

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(supplierId)
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    );
  };

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         s.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = s.category === getCategoryForPR() || s.category === 'both';
    return matchesSearch && matchesCategory;
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: PendingFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: ${language === 'el' ? 'Πολύ μεγάλο (max 10MB)' : 'Too large (max 10MB)'}`);
        continue;
      }
      newFiles.push({ file, id: crypto.randomUUID() });
    }
    
    setPendingFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (id: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleCreateRFQ = async () => {
    if (selectedSuppliers.length === 0) {
      toast.error(
        language === 'el' 
          ? 'Επιλέξτε τουλάχιστον έναν προμηθευτή' 
          : 'Select at least one supplier'
      );
      return;
    }

    try {
      setCreating(true);

      // Create RFQ
      const { data: rfqData, error: rfqError } = await supabase
        .from('rfqs')
        .insert([{
          pr_id: prId,
          status: 'draft',
          rfq_number: '',
          deadline: null,
        }])
        .select()
        .single();

      if (rfqError) throw rfqError;

      // Create RFQ suppliers
      const rfqSuppliersData = selectedSuppliers.map(supplierId => ({
        rfq_id: rfqData.id,
        supplier_id: supplierId,
        status: 'sent',
      }));

      const { error: suppliersError } = await supabase
        .from('rfq_suppliers')
        .insert(rfqSuppliersData);

      if (suppliersError) throw suppliersError;

      // Upload attachments
      if (pendingFiles.length > 0) {
        for (const { file } of pendingFiles) {
          const filePath = `rfq/${rfqData.id}/${Date.now()}_${file.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from('procurement')
            .upload(filePath, file);

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            continue;
          }

          await supabase
            .from('rfq_attachments')
            .insert([{
              rfq_id: rfqData.id,
              filename: file.name,
              file_path: filePath,
              uploaded_by: user?.id,
            }]);
        }
      }

      // Update PR status to rfq_sent
      const { error: prError } = await supabase
        .from('purchase_requests')
        .update({ status: 'rfq_sent' })
        .eq('id', prId);

      if (prError) throw prError;

      toast.success(
        language === 'el' 
          ? 'RFQ δημιουργήθηκε επιτυχώς' 
          : 'RFQ created successfully'
      );

      onOpenChange(false);
      navigate(`/procurement/rfqs/${rfqData.id}`);
    } catch (error: any) {
      console.error('Error creating RFQ:', error);
      toast.error(error.message || (language === 'el' ? 'Αποτυχία δημιουργίας RFQ' : 'Failed to create RFQ'));
    } finally {
      setCreating(false);
    }
  };

  const quickSelectLabel = prType === 'material'
    ? (language === 'el' ? 'Προτιμώμενοι Προμηθευτές Υλικών' : 'Preferred Materials Suppliers')
    : (language === 'el' ? 'Προτιμώμενοι Υπεργολάβοι' : 'Preferred Subcontractors');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {language === 'el' ? 'Αίτηση Προσφορών' : 'Request Offers'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Context Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">{language === 'el' ? 'Αριθμός PR:' : 'PR Number:'}</span>
                <span className="ml-2 font-medium">{prNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{language === 'el' ? 'Τύπος:' : 'Type:'}</span>
                <Badge variant="outline" className="ml-2">
                  {prType === 'material' 
                    ? (language === 'el' ? 'Υλικό' : 'Material')
                    : (language === 'el' ? 'Υπηρεσία' : 'Service')}
                </Badge>
              </div>
              {prProjectCode && (
                <div>
                  <span className="text-muted-foreground">{language === 'el' ? 'Έργο:' : 'Project:'}</span>
                  <span className="ml-2 font-medium">{prProjectCode}</span>
                </div>
              )}
            </div>
            {prDescription && (
              <div className="text-sm">
                <span className="text-muted-foreground">{language === 'el' ? 'Περιγραφή:' : 'Description:'}</span>
                <p className="mt-1 text-foreground line-clamp-2">{prDescription}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={handleQuickSelect}
            >
              <Star className="h-4 w-4 mr-2" />
              {quickSelectLabel}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={handleClearSelection}
            >
              <X className="h-4 w-4 mr-2" />
              {language === 'el' ? 'Καθαρισμός' : 'Clear'}
            </Button>
          </div>

          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label>
              {language === 'el' ? 'Επιλογή Προμηθευτών' : 'Select Suppliers'} *
              <span className="ml-2 text-muted-foreground">
                ({selectedSuppliers.length} {language === 'el' ? 'επιλεγμένοι' : 'selected'})
              </span>
            </Label>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'el' ? 'Αναζήτηση προμηθευτών...' : 'Search suppliers...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Supplier List */}
            <div className="border rounded-md max-h-[180px] overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {language === 'el' ? 'Δεν βρέθηκαν προμηθευτές' : 'No suppliers found'}
                </div>
              ) : (
                filteredSuppliers.map(supplier => (
                  <div 
                    key={supplier.id}
                    className={cn(
                      "flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50",
                      selectedSuppliers.includes(supplier.id) && "bg-primary/5"
                    )}
                    onClick={() => toggleSupplier(supplier.id)}
                  >
                    <Checkbox 
                      checked={selectedSuppliers.includes(supplier.id)}
                      onCheckedChange={() => toggleSupplier(supplier.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{supplier.name}</span>
                        {supplier.is_preferred && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      {supplier.email && (
                        <span className="text-sm text-muted-foreground">{supplier.email}</span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {supplier.category === 'materials' 
                        ? (language === 'el' ? 'Υλικά' : 'Materials')
                        : supplier.category === 'services'
                        ? (language === 'el' ? 'Υπηρεσίες' : 'Services')
                        : (language === 'el' ? 'Και τα δύο' : 'Both')}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{language === 'el' ? 'Συνημμένα (RFQ)' : 'Attachments (RFQ)'}</Label>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  multiple
                />
                <Button 
                  type="button"
                  size="sm" 
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {language === 'el' ? 'Προσθήκη' : 'Add Files'}
                </Button>
              </div>
            </div>
            
            {pendingFiles.length > 0 && (
              <div className="border rounded-md divide-y">
                {pendingFiles.map(({ file, id }) => (
                  <div key={id} className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => handleRemoveFile(id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>
              {language === 'el' ? 'Μήνυμα προς προμηθευτές (προαιρετικό)' : 'Message to suppliers (optional)'}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === 'el' ? 'Προσθέστε τυχόν σημειώσεις...' : 'Add any notes...'}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {language === 'el' ? 'Ακύρωση' : 'Cancel'}
          </Button>
          <Button onClick={handleCreateRFQ} disabled={creating || selectedSuppliers.length === 0}>
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {language === 'el' ? 'Δημιουργία RFQ & Επισύναψη' : 'Create RFQ & Attach Files'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

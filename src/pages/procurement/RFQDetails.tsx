import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Loader2, 
  FileText, 
  Upload, 
  Download, 
  Link2, 
  Trash2,
  Star,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RFQDetails {
  id: string;
  rfq_number: string;
  pr_id: string;
  status: string;
  deadline: string | null;
  created_at: string;
  purchase_request?: {
    pr_number: string;
    description: string;
    type: string;
    qty: number | null;
    uom: string | null;
    project?: {
      project_code: string;
      project_name: string;
    };
  };
}

interface RFQSupplier {
  id: string;
  supplier_id: string;
  status: string;
  supplier?: {
    name: string;
    email: string | null;
    is_preferred: boolean;
  };
}

interface RFQAttachment {
  id: string;
  filename: string;
  file_path: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-600',
  sent: 'bg-blue-500/10 text-blue-600',
  partially_received: 'bg-orange-500/10 text-orange-600',
  received: 'bg-green-500/10 text-green-600',
  closed: 'bg-gray-500/10 text-gray-600',
};

export default function RFQDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [rfq, setRfq] = useState<RFQDetails | null>(null);
  const [suppliers, setSuppliers] = useState<RFQSupplier[]>([]);
  const [attachments, setAttachments] = useState<RFQAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchRFQDetails();
    }
  }, [id]);

  const fetchRFQDetails = async () => {
    try {
      setLoading(true);

      // Fetch RFQ
      const { data: rfqData, error: rfqError } = await supabase
        .from('rfqs')
        .select(`
          *,
          purchase_request:purchase_requests(
            pr_number, 
            description, 
            type, 
            qty, 
            uom,
            project:projects(project_code, project_name)
          )
        `)
        .eq('id', id)
        .single();

      if (rfqError) throw rfqError;
      setRfq(rfqData as RFQDetails);

      // Fetch RFQ Suppliers
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('rfq_suppliers')
        .select(`
          *,
          supplier:suppliers(name, email, is_preferred)
        `)
        .eq('rfq_id', id);

      if (suppliersError) throw suppliersError;
      setSuppliers((suppliersData || []) as RFQSupplier[]);

      // Fetch Attachments
      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from('rfq_attachments')
        .select('*')
        .eq('rfq_id', id)
        .order('created_at', { ascending: false });

      if (attachmentsError) throw attachmentsError;
      setAttachments(attachmentsData || []);
    } catch (error) {
      console.error('Error fetching RFQ details:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης RFQ' : 'Failed to load RFQ');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(language === 'el' ? 'Το αρχείο είναι πολύ μεγάλο (max 10MB)' : 'File too large (max 10MB)');
      return;
    }

    try {
      setUploading(true);
      
      const filePath = `rfq/${id}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('procurement')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save attachment record
      const { error: dbError } = await supabase
        .from('rfq_attachments')
        .insert([{
          rfq_id: id,
          filename: file.name,
          file_path: filePath,
          uploaded_by: user?.id,
        }]);

      if (dbError) throw dbError;

      toast.success(language === 'el' ? 'Αρχείο ανέβηκε' : 'File uploaded');
      fetchRFQDetails();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(error.message || (language === 'el' ? 'Αποτυχία ανεβάσματος' : 'Upload failed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (attachment: RFQAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('procurement')
        .download(attachment.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error(language === 'el' ? 'Αποτυχία λήψης' : 'Download failed');
    }
  };

  const handleGenerateShareLink = async (attachment: RFQAttachment) => {
    try {
      setGeneratingLink(attachment.id);
      
      const { data, error } = await supabase.storage
        .from('procurement')
        .createSignedUrl(attachment.file_path, 7 * 24 * 60 * 60); // 7 days

      if (error) throw error;

      await navigator.clipboard.writeText(data.signedUrl);
      toast.success(
        language === 'el' 
          ? 'Σύνδεσμος αντιγράφηκε (ισχύει 7 ημέρες)' 
          : 'Link copied (valid 7 days)'
      );
    } catch (error) {
      console.error('Error generating link:', error);
      toast.error(language === 'el' ? 'Αποτυχία δημιουργίας συνδέσμου' : 'Failed to generate link');
    } finally {
      setGeneratingLink(null);
    }
  };

  const handleDeleteAttachment = async (attachment: RFQAttachment) => {
    if (!confirm(language === 'el' ? 'Διαγραφή αρχείου;' : 'Delete file?')) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('procurement')
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // Delete record
      const { error: dbError } = await supabase
        .from('rfq_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      toast.success(language === 'el' ? 'Αρχείο διαγράφηκε' : 'File deleted');
      fetchRFQDetails();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error(language === 'el' ? 'Αποτυχία διαγραφής' : 'Delete failed');
    }
  };

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

  if (!rfq) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {language === 'el' ? 'RFQ δεν βρέθηκε' : 'RFQ not found'}
        </p>
        <Button className="mt-4" onClick={() => navigate('/procurement/rfqs')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {language === 'el' ? 'Επιστροφή' : 'Go Back'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/procurement/rfqs')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              {rfq.rfq_number}
              <Badge className={cn('border-0', statusColors[rfq.status])}>
                {getStatusLabel(rfq.status)}
              </Badge>
            </h1>
            <p className="text-muted-foreground">
              {language === 'el' ? 'Αίτημα Προσφοράς' : 'Request for Quotation'}
            </p>
          </div>
        </div>
      </div>

      {/* PR Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {language === 'el' ? 'Στοιχεία Αιτήματος' : 'Request Details'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{language === 'el' ? 'Αριθμός PR' : 'PR Number'}</p>
              <p className="font-medium">{rfq.purchase_request?.pr_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{language === 'el' ? 'Έργο' : 'Project'}</p>
              <p className="font-medium">{rfq.purchase_request?.project?.project_code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{language === 'el' ? 'Τύπος' : 'Type'}</p>
              <p className="font-medium">
                {rfq.purchase_request?.type === 'material' 
                  ? (language === 'el' ? 'Υλικό' : 'Material')
                  : (language === 'el' ? 'Υπηρεσία' : 'Service')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{language === 'el' ? 'Ημερομηνία' : 'Date'}</p>
              <p className="font-medium">{format(new Date(rfq.created_at), 'dd/MM/yyyy')}</p>
            </div>
          </div>
          <Separator className="my-4" />
          <div>
            <p className="text-sm text-muted-foreground">{language === 'el' ? 'Περιγραφή' : 'Description'}</p>
            <p className="mt-1">{rfq.purchase_request?.description}</p>
          </div>
          {rfq.purchase_request?.qty && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">{language === 'el' ? 'Ποσότητα' : 'Quantity'}</p>
              <p className="font-medium">{rfq.purchase_request.qty} {rfq.purchase_request.uom}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suppliers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {language === 'el' ? 'Προμηθευτές' : 'Suppliers'} ({suppliers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'el' ? 'Προμηθευτής' : 'Supplier'}</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>{language === 'el' ? 'Κατάσταση' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {s.supplier?.name}
                      {s.supplier?.is_preferred && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{s.supplier?.email || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {s.status === 'sent' 
                        ? (language === 'el' ? 'Εστάλη' : 'Sent')
                        : (language === 'el' ? 'Ελήφθη προσφορά' : 'Offer received')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {language === 'el' ? 'Συνημμένα' : 'Attachments'}
            </CardTitle>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              />
              <Button 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {language === 'el' ? 'Ανέβασμα' : 'Upload'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {language === 'el' ? 'Δεν υπάρχουν συνημμένα' : 'No attachments'}
            </p>
          ) : (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div 
                  key={attachment.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{attachment.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(attachment.created_at), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(attachment)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleGenerateShareLink(attachment)}
                      disabled={generatingLink === attachment.id}
                    >
                      {generatingLink === attachment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDeleteAttachment(attachment)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

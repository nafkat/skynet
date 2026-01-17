import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Loader2,
  ArrowLeft,
  Send,
  Download,
  Copy,
  Check,
  X,
  Clock,
  FileText,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface RequestOffer {
  id: string;
  ro_number: string;
  type: string;
  project_name: string | null;
  vessel_or_job: string | null;
  title: string;
  description: string;
  qty: number | null;
  uom: string | null;
  status: string;
  message_to_recipients: string | null;
  created_at: string;
  sent_at: string | null;
}

interface Recipient {
  id: string;
  supplier_id: string;
  email_used: string | null;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  supplier: {
    name: string;
    country: string;
    vat_number: string;
  };
}

interface Attachment {
  id: string;
  filename: string;
  file_path: string;
  created_at: string;
}

export default function RequestOfferDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [requestOffer, setRequestOffer] = useState<RequestOffer | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (id) {
      fetchRequestOffer();
    }
  }, [id]);

  const fetchRequestOffer = async () => {
    try {
      setLoading(true);

      // Fetch request offer
      const { data: ro, error: roError } = await supabase
        .from('request_offers')
        .select('*')
        .eq('id', id)
        .single();

      if (roError) throw roError;
      setRequestOffer(ro);

      // Fetch recipients with supplier info
      const { data: recs, error: recsError } = await supabase
        .from('request_offer_recipients')
        .select(`
          *,
          supplier:suppliers(name, country, vat_number)
        `)
        .eq('request_offer_id', id);

      if (recsError) throw recsError;
      setRecipients(recs || []);

      // Fetch attachments
      const { data: atts, error: attsError } = await supabase
        .from('request_offer_attachments')
        .select('*')
        .eq('request_offer_id', id);

      if (attsError) throw attsError;
      setAttachments(atts || []);

    } catch (error) {
      console.error('Error fetching request offer:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης' : 'Failed to load');
      navigate('/procurement/request-offers');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      toast.error(language === 'el' ? 'Δεν υπάρχουν παραλήπτες' : 'No recipients');
      return;
    }

    try {
      setSending(true);

      const { data: result, error } = await supabase.functions
        .invoke('send_request_offer_email', {
          body: { request_offer_id: id }
        });

      if (error) throw error;

      toast.success(
        language === 'el' 
          ? `Απεστάλη σε ${result?.sent_count || 0} παραλήπτες` 
          : `Sent to ${result?.sent_count || 0} recipients`
      );

      fetchRequestOffer();
    } catch (error: any) {
      console.error('Error sending:', error);
      toast.error(error.message || (language === 'el' ? 'Αποτυχία αποστολής' : 'Failed to send'));
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    try {
      setClosing(true);

      const { error } = await supabase
        .from('request_offers')
        .update({ status: 'closed' })
        .eq('id', id);

      if (error) throw error;

      toast.success(language === 'el' ? 'Το αίτημα έκλεισε' : 'Request closed');
      fetchRequestOffer();
    } catch (error: any) {
      console.error('Error closing:', error);
      toast.error(error.message || (language === 'el' ? 'Αποτυχία' : 'Failed'));
    } finally {
      setClosing(false);
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('procurement')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error(language === 'el' ? 'Αποτυχία λήψης' : 'Download failed');
    }
  };

  const copyShareLink = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('procurement')
        .createSignedUrl(attachment.file_path, 60 * 60 * 24 * 7); // 7 days

      if (error) throw error;

      await navigator.clipboard.writeText(data.signedUrl);
      toast.success(language === 'el' ? 'Ο σύνδεσμος αντιγράφηκε' : 'Link copied');
    } catch (error) {
      console.error('Error creating signed URL:', error);
      toast.error(language === 'el' ? 'Αποτυχία' : 'Failed');
    }
  };

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

  const getRecipientStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!requestOffer) {
    return null;
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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{requestOffer.ro_number}</h1>
              {getStatusBadge(requestOffer.status)}
            </div>
            <p className="text-muted-foreground">{requestOffer.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {requestOffer.status === 'draft' && (
            <Button onClick={handleSend} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              {language === 'el' ? 'Αποστολή' : 'Send Request'}
            </Button>
          )}
          {requestOffer.status === 'sent' && (
            <>
              <Button variant="outline" onClick={handleSend} disabled={sending}>
                {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" />
                {language === 'el' ? 'Επαναποστολή' : 'Resend'}
              </Button>
              <Button variant="secondary" onClick={handleClose} disabled={closing}>
                {closing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <X className="h-4 w-4 mr-2" />
                {language === 'el' ? 'Κλείσιμο' : 'Close'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Details */}
          <Card>
            <CardHeader>
              <CardTitle>{language === 'el' ? 'Στοιχεία Αιτήματος' : 'Request Details'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{language === 'el' ? 'Τύπος' : 'Type'}</p>
                  <p className="font-medium">
                    {requestOffer.type === 'material' 
                      ? (language === 'el' ? 'Υλικό' : 'Material')
                      : (language === 'el' ? 'Υπηρεσία' : 'Service')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{language === 'el' ? 'Έργο' : 'Project'}</p>
                  <p className="font-medium">{requestOffer.project_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{language === 'el' ? 'Σκάφος/Εργασία' : 'Vessel/Job'}</p>
                  <p className="font-medium">{requestOffer.vessel_or_job || '-'}</p>
                </div>
                {requestOffer.qty && (
                  <div>
                    <p className="text-sm text-muted-foreground">{language === 'el' ? 'Ποσότητα' : 'Quantity'}</p>
                    <p className="font-medium">{requestOffer.qty} {requestOffer.uom || ''}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-1">{language === 'el' ? 'Περιγραφή' : 'Description'}</p>
                <p className="whitespace-pre-wrap">{requestOffer.description}</p>
              </div>

              {requestOffer.message_to_recipients && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{language === 'el' ? 'Μήνυμα' : 'Message'}</p>
                    <p className="whitespace-pre-wrap">{requestOffer.message_to_recipients}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{language === 'el' ? 'Παραλήπτες' : 'Recipients'}</span>
                <Badge variant="secondary">{recipients.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recipients.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {language === 'el' ? 'Δεν υπάρχουν παραλήπτες' : 'No recipients'}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'el' ? 'Κατάσταση' : 'Status'}</TableHead>
                      <TableHead>{language === 'el' ? 'Προμηθευτής' : 'Supplier'}</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>{language === 'el' ? 'Χώρα / ΑΦΜ' : 'Country / VAT'}</TableHead>
                      <TableHead>{language === 'el' ? 'Απεστάλη' : 'Sent At'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getRecipientStatusIcon(rec.status)}
                            <span className="capitalize">{rec.status}</span>
                          </div>
                          {rec.error_message && (
                            <p className="text-xs text-destructive mt-1">{rec.error_message}</p>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{rec.supplier?.name}</TableCell>
                        <TableCell>{rec.email_used || '-'}</TableCell>
                        <TableCell>
                          {rec.supplier?.country && rec.supplier?.vat_number 
                            ? `${rec.supplier.country} - ${rec.supplier.vat_number}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {rec.sent_at ? format(new Date(rec.sent_at), 'dd/MM/yyyy HH:mm') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{language === 'el' ? 'Συνημμένα' : 'Attachments'}</span>
                <Badge variant="secondary">{attachments.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {language === 'el' ? 'Δεν υπάρχουν συνημμένα' : 'No attachments'}
                </p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{att.filename}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => downloadAttachment(att)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => copyShareLink(att)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Activity */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'el' ? 'Δραστηριότητα' : 'Activity'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{language === 'el' ? 'Δημιουργήθηκε' : 'Created'}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(requestOffer.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {requestOffer.sent_at && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Send className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium">{language === 'el' ? 'Απεστάλη' : 'Sent'}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(requestOffer.sent_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              )}

              {requestOffer.status === 'closed' && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <X className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{language === 'el' ? 'Έκλεισε' : 'Closed'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

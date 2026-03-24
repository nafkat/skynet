import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Loader2, ArrowLeft, Send, Download, Copy, Check, X, Clock,
  FileText, XCircle, CopyPlus, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

interface RequestOffer {
  id: string;
  ro_number: string;
  type: string;
  project_name: string | null;
  project_id: string | null;
  vessel_or_job: string | null;
  title: string;
  description: string;
  qty: number | null;
  uom: string | null;
  status: string;
  priority: string | null;
  message_to_recipients: string | null;
  created_at: string;
  sent_at: string | null;
  response_deadline: string | null;
  needed_by: string | null;
  delivery_location: string;
  contact_person: string;
  contact_phone: string;
  special_instructions: string | null;
}

interface Recipient {
  id: string;
  supplier_id: string;
  email_used: string | null;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  supplier: { name: string; country: string; vat_number: string };
}

interface Attachment {
  id: string;
  filename: string;
  file_path: string;
  created_at: string;
}

interface LineItem {
  id: string;
  item_number: number;
  description: string;
  qty: number | null;
  uom: string | null;
}

export default function RequestOfferDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [requestOffer, setRequestOffer] = useState<RequestOffer | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const t = (en: string, el: string) => language === 'el' ? el : en;

  useEffect(() => {
    if (id) fetchRequestOffer();
  }, [id]);

  const fetchRequestOffer = async () => {
    try {
      setLoading(true);

      const [roRes, recsRes, attsRes, itemsRes] = await Promise.all([
        supabase.from('request_offers').select('*').eq('id', id).single(),
        supabase.from('request_offer_recipients').select(`*, supplier:suppliers(name, country, vat_number)`).eq('request_offer_id', id),
        supabase.from('request_offer_attachments').select('*').eq('request_offer_id', id),
        supabase.from('request_offer_items').select('*').eq('request_offer_id', id).order('item_number'),
      ]);

      if (roRes.error) throw roRes.error;
      setRequestOffer(roRes.data as RequestOffer);
      setRecipients(recsRes.data || []);
      setAttachments(attsRes.data || []);
      setLineItems(itemsRes.data || []);
    } catch (error) {
      console.error('Error fetching request offer:', error);
      toast.error(t('Failed to load', 'Αποτυχία φόρτωσης'));
      navigate('/procurement/request-offers');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      toast.error(t('No recipients', 'Δεν υπάρχουν παραλήπτες'));
      return;
    }
    try {
      setSending(true);
      const { data: result, error } = await supabase.functions.invoke('send_request_offer_email', { body: { request_offer_id: id } });
      if (error) throw error;

      const sentCount = result?.sent_count || 0;
      const failedCount = result?.failed_count || 0;
      const failures = result?.failures || [];

      if (failedCount > 0 && sentCount === 0) {
        toast.error(t('Failed to send to all recipients', 'Αποτυχία αποστολής σε όλους τους παραλήπτες'), {
          description: failures.map((f: any) => `${f.email}: ${f.error}`).join('\n'),
          duration: 10000,
        });
      } else if (failedCount > 0) {
        toast.warning(t(`Sent to ${sentCount}, failed for ${failedCount}`, `Απεστάλη σε ${sentCount}, απέτυχε σε ${failedCount}`), {
          description: failures.map((f: any) => `${f.email}: ${f.error}`).join('\n'),
          duration: 10000,
        });
      } else {
        toast.success(t(`Successfully sent to ${sentCount} recipients`, `Απεστάλη επιτυχώς σε ${sentCount} παραλήπτες`));
      }
      fetchRequestOffer();
    } catch (error: any) {
      console.error('Error sending:', error);
      toast.error(t('Failed to send', 'Αποτυχία αποστολής'), { description: error.message });
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    try {
      setClosing(true);
      const { error } = await supabase.from('request_offers').update({ status: 'closed' }).eq('id', id);
      if (error) throw error;
      toast.success(t('Request closed', 'Το αίτημα έκλεισε'));
      fetchRequestOffer();
    } catch (error: any) {
      toast.error(error.message || t('Failed', 'Αποτυχία'));
    } finally {
      setClosing(false);
    }
  };

  const handleReopen = async () => {
    try {
      setReopening(true);
      const { error } = await supabase.from('request_offers').update({ status: 'reopened' }).eq('id', id);
      if (error) throw error;
      toast.success(t('Request offer reopened', 'Το αίτημα ανοίχτηκε ξανά'));
      fetchRequestOffer();
    } catch (error: any) {
      toast.error(error.message || t('Failed to reopen', 'Αποτυχία επαναφοράς'));
    } finally {
      setReopening(false);
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage.from('procurement').download(attachment.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(t('Download failed', 'Αποτυχία λήψης'));
    }
  };

  const copyShareLink = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage.from('procurement').createSignedUrl(attachment.file_path, 60 * 60 * 24 * 7);
      if (error) throw error;
      await navigator.clipboard.writeText(data.signedUrl);
      toast.success(t('Link copied', 'Ο σύνδεσμος αντιγράφηκε'));
    } catch (error) {
      toast.error(t('Failed', 'Αποτυχία'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="outline">{t('Draft', 'Πρόχειρο')}</Badge>;
      case 'sent': return <Badge className="bg-green-500">{t('Sent', 'Απεσταλμένο')}</Badge>;
      case 'closed': return <Badge variant="secondary">{t('Closed', 'Κλειστό')}</Badge>;
      case 'reopened': return <Badge className="bg-orange-500">{t('Reopened', 'Ανοιχτό Ξανά')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRecipientStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Check className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!requestOffer) return null;

  const canSend = requestOffer.status === 'draft' || requestOffer.status === 'reopened';
  const canResend = requestOffer.status === 'sent';
  const canClose = requestOffer.status === 'sent' || requestOffer.status === 'reopened';
  const canReopen = requestOffer.status === 'closed';

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
              {requestOffer.priority === 'urgent' && (
                <Badge variant="destructive">{t('Urgent', 'Επείγον')}</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{requestOffer.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/procurement/request-offers/new?duplicate=${id}`)}>
            <CopyPlus className="h-4 w-4 mr-2" />
            {t('Duplicate', 'Αντιγραφή')}
          </Button>
          {canSend && (
            <Button onClick={handleSend} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              {t('Send Request', 'Αποστολή')}
            </Button>
          )}
          {canResend && (
            <Button variant="outline" onClick={handleSend} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              {t('Resend', 'Επαναποστολή')}
            </Button>
          )}
          {canClose && (
            <Button variant="secondary" onClick={handleClose} disabled={closing}>
              {closing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <X className="h-4 w-4 mr-2" />
              {t('Close', 'Κλείσιμο')}
            </Button>
          )}
          {canReopen && (
            <Button variant="outline" onClick={handleReopen} disabled={reopening}>
              {reopening && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('Reopen Request', 'Επαναφορά Αιτήματος')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Details */}
          <Card>
            <CardHeader>
              <CardTitle>{t('Request Details', 'Στοιχεία Αιτήματος')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('Type', 'Τύπος')}</p>
                  <p className="font-medium">{requestOffer.type === 'material' ? t('Material', 'Υλικό') : t('Service', 'Υπηρεσία')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('Project', 'Έργο')}</p>
                  <p className="font-medium">{requestOffer.project_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('Vessel/Job', 'Σκάφος/Εργασία')}</p>
                  <p className="font-medium">{requestOffer.vessel_or_job || '-'}</p>
                </div>
                {requestOffer.response_deadline && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t('Response Deadline', 'Προθεσμία Απάντησης')}</p>
                    <p className="font-medium">{format(new Date(requestOffer.response_deadline), 'dd/MM/yyyy')}</p>
                  </div>
                )}
                {requestOffer.needed_by && (
                  <div>
                    <p className="text-sm text-muted-foreground">{t('Needed By', 'Απαιτείται Μέχρι')}</p>
                    <p className="font-medium">{format(new Date(requestOffer.needed_by), 'dd/MM/yyyy')}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">{t('Delivery Location', 'Τοποθεσία Παράδοσης')}</p>
                  <p className="font-medium">{requestOffer.delivery_location || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('Contact Person', 'Υπεύθυνος')}</p>
                  <p className="font-medium">{requestOffer.contact_person} {requestOffer.contact_phone ? `(${requestOffer.contact_phone})` : ''}</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('Description', 'Περιγραφή')}</p>
                <p className="whitespace-pre-wrap">{requestOffer.description}</p>
              </div>

              {requestOffer.special_instructions && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('Special Instructions', 'Ειδικές Οδηγίες')}</p>
                    <p className="whitespace-pre-wrap">{requestOffer.special_instructions}</p>
                  </div>
                </>
              )}

              {requestOffer.message_to_recipients && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t('Message', 'Μήνυμα')}</p>
                    <p className="whitespace-pre-wrap">{requestOffer.message_to_recipients}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t('Items', 'Είδη')}</span>
                  <Badge variant="secondary">{lineItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{t('Description', 'Περιγραφή')}</TableHead>
                      <TableHead>{t('Quantity', 'Ποσότητα')}</TableHead>
                      <TableHead>{t('Unit', 'Μονάδα')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.item_number}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.qty ?? '-'}</TableCell>
                        <TableCell>{item.uom || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('Recipients', 'Παραλήπτες')}</span>
                <Badge variant="secondary">{recipients.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recipients.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">{t('No recipients', 'Δεν υπάρχουν παραλήπτες')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Status', 'Κατάσταση')}</TableHead>
                      <TableHead>{t('Supplier', 'Προμηθευτής')}</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>{t('Country / VAT', 'Χώρα / ΑΦΜ')}</TableHead>
                      <TableHead>{t('Sent At', 'Απεστάλη')}</TableHead>
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
                          {rec.error_message && <p className="text-xs text-destructive mt-1">{rec.error_message}</p>}
                        </TableCell>
                        <TableCell className="font-medium">{rec.supplier?.name}</TableCell>
                        <TableCell>{rec.email_used || '-'}</TableCell>
                        <TableCell>
                          {rec.supplier?.country && rec.supplier?.vat_number ? `${rec.supplier.country} - ${rec.supplier.vat_number}` : '-'}
                        </TableCell>
                        <TableCell>{rec.sent_at ? format(new Date(rec.sent_at), 'dd/MM/yyyy HH:mm') : '-'}</TableCell>
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
                <span>{t('Attachments', 'Συνημμένα')}</span>
                <Badge variant="secondary">{attachments.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">{t('No attachments', 'Δεν υπάρχουν συνημμένα')}</p>
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
              <CardTitle>{t('Activity', 'Δραστηριότητα')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">{t('Created', 'Δημιουργήθηκε')}</p>
                  <p className="text-sm text-muted-foreground">{format(new Date(requestOffer.created_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
              </div>

              {requestOffer.sent_at && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Send className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium">{t('Sent', 'Απεστάλη')}</p>
                    <p className="text-sm text-muted-foreground">{format(new Date(requestOffer.sent_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>
              )}

              {requestOffer.status === 'closed' && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <X className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{t('Closed', 'Έκλεισε')}</p>
                  </div>
                </div>
              )}

              {requestOffer.status === 'reopened' && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium">{t('Reopened', 'Ανοιχτό Ξανά')}</p>
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

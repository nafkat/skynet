import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Megaphone, 
  ArrowLeft, 
  ExternalLink, 
  Edit, 
  Send, 
  RefreshCw,
  Loader2,
  FileText,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  title: string;
  message: string;
  status: 'draft' | 'pending' | 'sent' | 'partial' | 'failed';
  created_by: string;
  created_at: string;
  sent_at: string | null;
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
}

interface Delivery {
  id: string;
  recipient_id: string;
  channel: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  last_attempt_at: string | null;
  error_message: string | null;
  employee_name?: string;
  employee_code?: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
}

export default function AnnouncementDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [creatorProfile, setCreatorProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const t = (en: string, el: string) => (language === 'el' ? el : en);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch announcement
      const { data: announcementData, error: announcementError } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', id)
        .single();

      if (announcementError) throw announcementError;
      setAnnouncement(announcementData);

      // Fetch attachments
      const { data: attachmentsData } = await supabase
        .from('announcement_attachments')
        .select('*')
        .eq('announcement_id', id);
      
      setAttachments(attachmentsData || []);

      // Fetch deliveries with recipient info
      const { data: deliveriesData } = await supabase
        .from('announcement_deliveries')
        .select(`
          id,
          recipient_id,
          channel,
          status,
          attempts,
          last_attempt_at,
          error_message,
          announcement_recipients!inner (
            employee_id,
            employees!inner (
              first_name,
              last_name,
              employee_code
            )
          )
        `)
        .eq('announcement_id', id)
        .order('status', { ascending: true });

      const enrichedDeliveries = (deliveriesData || []).map((d: any) => ({
        id: d.id,
        recipient_id: d.recipient_id,
        channel: d.channel,
        status: d.status,
        attempts: d.attempts,
        last_attempt_at: d.last_attempt_at,
        error_message: d.error_message,
        employee_name: `${d.announcement_recipients.employees.last_name} ${d.announcement_recipients.employees.first_name}`,
        employee_code: d.announcement_recipients.employees.employee_code,
      }));

      setDeliveries(enrichedDeliveries);

      // Fetch creator profile
      if (announcementData.created_by) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .eq('user_id', announcementData.created_by)
          .single();
        
        setCreatorProfile(profileData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('Failed to load announcement', 'Αποτυχία φόρτωσης ανακοίνωσης'));
      navigate('/announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAttachment = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('announcements')
        .createSignedUrl(attachment.file_path, 3600); // 1 hour

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error getting signed URL:', error);
      toast.error(t('Failed to open file', 'Αποτυχία ανοίγματος αρχείου'));
    }
  };

  const handleSend = async () => {
    if (!announcement) return;

    setActionLoading(true);
    try {
      // Update announcement status
      const { error: updateError } = await supabase
        .from('announcements')
        .update({ 
          status: 'pending',
          sent_at: new Date().toISOString()
        })
        .eq('id', announcement.id);

      if (updateError) throw updateError;

      // Create deliveries for all recipients
      const { data: recipients } = await supabase
        .from('announcement_recipients')
        .select('id')
        .eq('announcement_id', announcement.id);

      if (recipients && recipients.length > 0) {
        const deliveryInserts = recipients.map(r => ({
          announcement_id: announcement.id,
          recipient_id: r.id,
          channel: 'viber',
          status: 'pending' as const,
        }));

        await supabase.from('announcement_deliveries').insert(deliveryInserts);
      }

      toast.success(t('Queued for sending', 'Τοποθετήθηκε στην ουρά αποστολής'));
      fetchData();
    } catch (error) {
      console.error('Error sending:', error);
      toast.error(t('Failed to send', 'Αποτυχία αποστολής'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!announcement) return;

    setActionLoading(true);
    try {
      // Reset failed deliveries to pending (where attempts < 3)
      const { error } = await supabase
        .from('announcement_deliveries')
        .update({ 
          status: 'pending',
          error_message: null
        })
        .eq('announcement_id', announcement.id)
        .eq('status', 'failed')
        .lt('attempts', 3);

      if (error) throw error;

      // Update announcement status back to pending
      await supabase
        .from('announcements')
        .update({ status: 'pending' })
        .eq('id', announcement.id);

      toast.success(t('Retrying failed deliveries', 'Επανάληψη αποτυχημένων αποστολών'));
      fetchData();
    } catch (error) {
      console.error('Error retrying:', error);
      toast.error(t('Failed to retry', 'Αποτυχία επανάληψης'));
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'sent':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'partial':
        return 'outline';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return t('Draft', 'Πρόχειρο');
      case 'pending':
        return t('Pending', 'Εκκρεμεί');
      case 'sent':
        return t('Sent', 'Απεστάλη');
      case 'partial':
        return t('Partial', 'Μερική');
      case 'failed':
        return t('Failed', 'Αποτυχία');
      default:
        return status;
    }
  };

  const getDeliveryStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const failedCount = deliveries.filter(d => d.status === 'failed' && d.attempts < 3).length;
  const canRetry = ['failed', 'partial'].includes(announcement?.status || '') && failedCount > 0;
  const isDraft = announcement?.status === 'draft';
  const isPending = announcement?.status === 'pending';

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!announcement) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('Announcement not found', 'Η ανακοίνωση δεν βρέθηκε')}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/announcements')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Megaphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {announcement.title}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getStatusBadgeVariant(announcement.status)}>
                    {getStatusLabel(announcement.status)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isDraft && (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/announcements/${announcement.id}/edit`)}
                  disabled={actionLoading}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {t('Edit', 'Επεξεργασία')}
                </Button>
                <Button onClick={handleSend} disabled={actionLoading}>
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {t('Send', 'Αποστολή')}
                </Button>
              </>
            )}
            {isPending && (
              <Badge variant="secondary" className="py-2 px-4">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('Sending in progress...', 'Αποστολή σε εξέλιξη...')}
              </Badge>
            )}
            {canRetry && (
              <Button onClick={handleRetryFailed} disabled={actionLoading}>
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {t('Retry failed deliveries', 'Επανάληψη αποτυχημένων')} ({failedCount})
              </Button>
            )}
          </div>
        </div>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t('Announcement Details', 'Λεπτομέρειες Ανακοίνωσης')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Message */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {t('Message', 'Μήνυμα')}
              </p>
              <p className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg">
                {announcement.message}
              </p>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {t('Created by', 'Δημιουργήθηκε από')}
                </p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{creatorProfile?.full_name || announcement.created_by.slice(0, 8) + '...'}</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {t('Created at', 'Δημιουργήθηκε στις')}
                </p>
                <p>{format(new Date(announcement.created_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
              {announcement.sent_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {t('Sent at', 'Απεστάλη στις')}
                  </p>
                  <p>{format(new Date(announcement.sent_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {t('Recipients', 'Παραλήπτες')}
                </p>
                <p>{deliveries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attachments */}
        {attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('Attachments', 'Συνημμένα')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{attachment.file_name}</p>
                        {attachment.file_size && (
                          <p className="text-xs text-muted-foreground">
                            {(attachment.file_size / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenAttachment(attachment)}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      {t('Open', 'Άνοιγμα')}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deliveries */}
        {deliveries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('Deliveries', 'Αποστολές')}</CardTitle>
              <CardDescription>
                {t('Delivery status for each recipient', 'Κατάσταση αποστολής για κάθε παραλήπτη')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Employee', 'Υπάλληλος')}</TableHead>
                      <TableHead>{t('Channel', 'Κανάλι')}</TableHead>
                      <TableHead>{t('Status', 'Κατάσταση')}</TableHead>
                      <TableHead className="text-center">{t('Attempts', 'Προσπάθειες')}</TableHead>
                      <TableHead>{t('Last Attempt', 'Τελευταία Προσπάθεια')}</TableHead>
                      <TableHead>{t('Error', 'Σφάλμα')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{delivery.employee_name}</p>
                            <p className="text-xs text-muted-foreground">{delivery.employee_code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{delivery.channel}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getDeliveryStatusIcon(delivery.status)}
                            <span className="capitalize">{getStatusLabel(delivery.status)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{delivery.attempts}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {delivery.last_attempt_at
                            ? format(new Date(delivery.last_attempt_at), 'dd/MM HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell className="text-destructive text-sm max-w-[200px] truncate">
                          {delivery.error_message || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

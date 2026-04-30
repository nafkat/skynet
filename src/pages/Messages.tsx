import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { format, startOfDay, endOfDay } from 'date-fns';
import { el as elLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MessageSquare,
  Search,
  Send,
  CheckCircle,
  ArrowLeft,
  Clock,
  Eye,
  Loader2,
  Settings2,
  Bell,
  Volume2,
  Image,
  FileText,
  User,
  Paperclip,
  X,
  Download,
  RefreshCw,
  Archive,
  ArchiveRestore,
  CalendarIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { el } from 'date-fns/locale';
import { formatDateTime } from '@/lib/dateUtils';

interface EmployeeMessage {
  id: string;
  employee_id: string;
  telegram_chat_id: number;
  message_text: string | null;
  message_type: string;
  attachment_file_id: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  status: string;
  admin_reply: string | null;
  admin_attachment_url: string | null;
  admin_attachment_name: string | null;
  admin_attachment_type: string | null;
  created_at: string;
  replied_at: string | null;
  replied_by: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  reopen_count: number;
  archived_at?: string | null;
  employees?: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
}

export default function Messages() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, isAdmin } = useAuth();
  const { settings, updateSettings, playNotificationSound, showBrowserNotification } = useNotificationSettings();

  const [messages, setMessages] = useState<EmployeeMessage[]>([]);
  const [archivedMessages, setArchivedMessages] = useState<EmployeeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<EmployeeMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previousMessageIds, setPreviousMessageIds] = useState<Set<string>>(new Set());
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<EmployeeMessage | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = useState<EmployeeMessage | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [employeeAttachmentUrl, setEmployeeAttachmentUrl] = useState<string | null>(null);
  const [adminAttachmentUrl, setAdminAttachmentUrl] = useState<string | null>(null);

  const t = (en: string, el_text: string) => (language === 'el' ? el_text : en);

  // Resolve a stored attachment value (path or legacy public URL) to a usable URL.
  // Buckets are private, so we generate a short-lived signed URL when given a path.
  const resolveAttachmentUrl = useCallback(async (
    bucket: 'employee-attachments' | 'message-attachments',
    stored: string | null,
  ): Promise<string | null> => {
    if (!stored) return null;
    // Legacy: full public URL stored. Try to extract the path within the bucket.
    const marker = `/storage/v1/object/public/${bucket}/`;
    let path = stored;
    if (stored.startsWith('http')) {
      const idx = stored.indexOf(marker);
      if (idx === -1) return stored; // unknown URL shape; return as-is
      path = decodeURIComponent(stored.substring(idx + marker.length));
    }
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60); // 1 hour
    if (error) {
      console.error(`Failed to sign ${bucket} URL`, error);
      return null;
    }
    return data.signedUrl;
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      let activeQuery = supabase
        .from('employee_messages')
        .select('*, employees(first_name, last_name, employee_code)')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (dateFrom) {
        activeQuery = activeQuery.gte('created_at', startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        activeQuery = activeQuery.lte('created_at', endOfDay(dateTo).toISOString());
      }

      const { data, error } = await activeQuery;
      if (error) throw error;
      setMessages((data as any[]) || []);

      // Fetch archived messages
      let archivedQuery = supabase
        .from('employee_messages')
        .select('*, employees(first_name, last_name, employee_code)')
        .eq('is_archived', true)
        .order('archived_at', { ascending: false });

      if (dateFrom) {
        archivedQuery = archivedQuery.gte('created_at', startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        archivedQuery = archivedQuery.lte('created_at', endOfDay(dateTo).toISOString());
      }

      const { data: archived, error: archivedError } = await archivedQuery;
      if (!archivedError) {
        setArchivedMessages((archived as any[]) || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription with notifications
  useEffect(() => {
    const channel = supabase
      .channel('messages_page_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'employee_messages' },
        async (payload) => {
          playNotificationSound();

          const newMsg = payload.new as any;
          const { data: emp } = await supabase
            .from('employees')
            .select('first_name, last_name')
            .eq('id', newMsg.employee_id)
            .single();

          const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';
          const preview = (newMsg.message_text || '').substring(0, 50);

          showBrowserNotification(
            `${t('New message from', 'Νέο μήνυμα από')} ${empName}`,
            preview || t('Sent an attachment', 'Έστειλε συνημμένο'),
            () => navigate('/messages')
          );

          toast.info(`${t('New message from', 'Νέο μήνυμα από')} ${empName}`, {
            description: preview || undefined,
            action: {
              label: t('View', 'Προβολή'),
              onClick: () => {},
            },
          });

          fetchMessages();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'employee_messages' },
        () => fetchMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, playNotificationSound, showBrowserNotification, navigate, t]);

  const filteredMessages = messages.filter(msg => {
    const empName = msg.employees
      ? `${msg.employees.first_name} ${msg.employees.last_name} ${msg.employees.employee_code}`.toLowerCase()
      : '';
    const matchesSearch = !searchQuery || empName.includes(searchQuery.toLowerCase()) ||
      (msg.message_text || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'unread') return matchesSearch && msg.status === 'unread';
    if (activeTab === 'replied') return matchesSearch && (msg.status === 'replied' || msg.status === 'reopened');
    if (activeTab === 'resolved') return matchesSearch && msg.status === 'resolved';
    if (activeTab === 'archived') return false; // archived handled separately
    return matchesSearch;
  });

  const filteredArchivedMessages = archivedMessages.filter(msg => {
    const empName = msg.employees
      ? `${msg.employees.first_name} ${msg.employees.last_name} ${msg.employees.employee_code}`.toLowerCase()
      : '';
    return !searchQuery || empName.includes(searchQuery.toLowerCase()) ||
      (msg.message_text || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const unreadCount = messages.filter(m => m.status === 'unread').length;

  const handleSelectMessage = async (msg: EmployeeMessage) => {
    setSelectedMessage(msg);
    setReplyText('');
    setReplyFile(null);
    if (msg.status === 'unread') {
      await supabase
        .from('employee_messages')
        .update({ status: 'read' })
        .eq('id', msg.id);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('File too large. Max 10MB.', 'Το αρχείο είναι πολύ μεγάλο. Μέγ. 10MB.'));
      return;
    }
    setReplyFile(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSendReply = async () => {
    if (!selectedMessage || (!replyText.trim() && !replyFile)) return;

    setSending(true);
    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentType: string | null = null;

      if (replyFile) {
        setUploading(true);
        const filePath = `replies/${selectedMessage.id}/${Date.now()}_${replyFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(filePath, replyFile);

        if (uploadError) {
          throw new Error(t('File upload failed', 'Αποτυχία μεταφόρτωσης αρχείου'));
        }

        const { data: urlData } = supabase.storage
          .from('message-attachments')
          .getPublicUrl(filePath);

        attachmentUrl = urlData.publicUrl;
        attachmentName = replyFile.name;
        attachmentType = replyFile.type;
        setUploading(false);
      }

      const { data, error } = await supabase.functions.invoke('send_telegram_reply', {
        body: {
          message_id: selectedMessage.id,
          reply_text: replyText.trim() || (replyFile ? `📎 ${replyFile.name}` : ''),
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
        },
      });

      if (error) throw error;

      toast.success(t('Reply sent successfully', 'Η απάντηση στάλθηκε'));
      setReplyText('');
      setReplyFile(null);
      setSelectedMessage(prev => prev ? {
        ...prev,
        status: 'replied',
        admin_reply: replyText || `📎 ${attachmentName}`,
        admin_attachment_url: attachmentUrl,
        admin_attachment_name: attachmentName,
        admin_attachment_type: attachmentType,
      } : null);
      fetchMessages();
    } catch (error: any) {
      console.error('Error sending reply:', error);
      toast.error(error.message || t('Failed to send reply', 'Αποτυχία αποστολής απάντησης'));
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!selectedMessage) return;

    try {
      await supabase
        .from('employee_messages')
        .update({ status: 'resolved' })
        .eq('id', selectedMessage.id);

      toast.success(t('Marked as resolved', 'Σημειώθηκε ως επιλυμένο'));
      setSelectedMessage(prev => prev ? { ...prev, status: 'resolved' } : null);
      fetchMessages();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleReopen = async () => {
    if (!selectedMessage || !user) return;

    try {
      const { error } = await supabase
        .from('employee_messages')
        .update({
          status: 'reopened',
          reopened_at: new Date().toISOString(),
          reopened_by: user.id,
          reopen_count: (selectedMessage.reopen_count || 0) + 1,
        })
        .eq('id', selectedMessage.id);

      if (error) throw error;

      toast.success(t('Conversation reopened', 'Η συνομιλία ξανάνοιξε'));
      setSelectedMessage(prev => prev ? {
        ...prev,
        status: 'reopened',
        reopened_at: new Date().toISOString(),
        reopened_by: user.id,
        reopen_count: (prev.reopen_count || 0) + 1,
      } : null);
      fetchMessages();
    } catch (error) {
      console.error('Error reopening:', error);
      toast.error(t('Failed to reopen', 'Αποτυχία επαναλειτουργίας'));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unread':
        return <Badge variant="destructive">{t('Unread', 'Αδιάβαστο')}</Badge>;
      case 'read':
        return <Badge variant="secondary">{t('Read', 'Διαβάστηκε')}</Badge>;
      case 'replied':
        return <Badge className="bg-blue-500 text-white">{t('Replied', 'Απαντήθηκε')}</Badge>;
      case 'resolved':
        return <Badge className="bg-green-600 text-white">{t('Resolved', 'Επιλύθηκε')}</Badge>;
      case 'reopened':
        return <Badge className="bg-orange-500 text-white">{t('Reopened', 'Ξανάνοιξε')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4 text-muted-foreground" />;
      case 'file': return <FileText className="h-4 w-4 text-muted-foreground" />;
      default: return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const timeAgo = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: language === 'el' ? el : undefined,
      });
    } catch {
      return '';
    }
  };

  const handleArchiveMessage = async () => {
    if (!archiveTarget || !user) return;
    try {
      const { error } = await supabase
        .from('employee_messages')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.id,
        })
        .eq('id', archiveTarget.id);

      if (error) throw error;
      toast.success(t('Message archived', 'Το μήνυμα αρχειοθετήθηκε'));
      setArchiveTarget(null);
      if (selectedMessage?.id === archiveTarget.id) {
        setSelectedMessage(null);
      }
      fetchMessages();
    } catch (error) {
      console.error('Error archiving message:', error);
      toast.error(t('Failed to archive', 'Αποτυχία αρχειοθέτησης'));
    }
  };

  const handleUnarchiveMessage = async () => {
    if (!unarchiveTarget || !user) return;
    try {
      const { error } = await supabase
        .from('employee_messages')
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null,
        })
        .eq('id', unarchiveTarget.id);

      if (error) throw error;
      toast.success(t('Message restored', 'Το μήνυμα επαναφέρθηκε'));
      setUnarchiveTarget(null);
      fetchMessages();
    } catch (error) {
      console.error('Error unarchiving message:', error);
      toast.error(t('Failed to restore', 'Αποτυχία επαναφοράς'));
    }
  };

  if (selectedMessage) {
    return (
      <MainLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSelectedMessage(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">
                {selectedMessage.employees
                  ? `${selectedMessage.employees.first_name} ${selectedMessage.employees.last_name}`
                  : t('Unknown Employee', 'Άγνωστος Εργαζόμενος')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedMessage.employees?.employee_code} · {timeAgo(selectedMessage.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(selectedMessage.status)}
              {selectedMessage.status !== 'resolved' && (
                <Button variant="outline" size="sm" onClick={handleMarkResolved}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('Mark Resolved', 'Επιλυμένο')}
                </Button>
              )}
              {selectedMessage.status === 'resolved' && (
                <Button variant="outline" size="sm" onClick={handleReopen}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('Reopen', 'Επαναφορά')}
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setArchiveTarget(selectedMessage)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  {t('Archive', 'Αρχειοθέτηση')}
                </Button>
              )}
            </div>
          </div>

          {/* Message Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5" />
                {t('Employee Message', 'Μήνυμα Εργαζομένου')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                {getMessageIcon(selectedMessage.message_type)}
                <p className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg flex-1">
                  {selectedMessage.message_text || t('(No text)', '(Χωρίς κείμενο)')}
                </p>
              </div>

              {selectedMessage.attachment_url ? (
                <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-lg">
                  {selectedMessage.message_type === 'image' ? (
                    <>
                      <Image className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <img
                        src={selectedMessage.attachment_url}
                        alt={selectedMessage.attachment_name || 'Image'}
                        className="max-w-xs max-h-48 rounded-md object-cover"
                      />
                    </>
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedMessage.attachment_name || t('Attachment', 'Συνημμένο')}
                    </p>
                  </div>
                  <a
                    href={selectedMessage.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={selectedMessage.attachment_name || undefined}
                    className="flex-shrink-0"
                  >
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-1" />
                      {t('Download', 'Λήψη')}
                    </Button>
                  </a>
                </div>
              ) : selectedMessage.attachment_file_id ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  {selectedMessage.message_type === 'image' ? (
                    <Image className="h-4 w-4" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  <span>{t('Attachment received via Telegram (not downloadable - older message)', 'Συνημμένο ελήφθη μέσω Telegram (μη διαθέσιμο - παλαιότερο μήνυμα)')}</span>
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                {formatDateTime(selectedMessage.created_at)}
              </p>
            </CardContent>
          </Card>

          {/* Admin Reply */}
          {selectedMessage.admin_reply && (
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-blue-600 dark:text-blue-400">
                  <Send className="h-5 w-5" />
                  {t('Admin Reply', 'Απάντηση Διαχειριστή')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-wrap bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
                  {selectedMessage.admin_reply}
                </p>
                {selectedMessage.admin_attachment_url && (
                  <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
                    {selectedMessage.admin_attachment_type?.startsWith('image/') ? (
                      <Image className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    ) : (
                      <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedMessage.admin_attachment_name}</p>
                    </div>
                    <a
                      href={selectedMessage.admin_attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0"
                    >
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                )}
                {selectedMessage.replied_at && (
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(selectedMessage.replied_at)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Reply Form */}
          {selectedMessage.status !== 'resolved' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t('Send Reply', 'Αποστολή Απάντησης')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder={t('Type your reply...', 'Γράψτε την απάντησή σας...')}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                />

                {/* File attachment */}
                <div className="space-y-2">
                  {replyFile ? (
                    <div className="flex items-center gap-3 bg-muted/50 p-3 rounded-lg">
                      {replyFile.type.startsWith('image/') ? (
                        <Image className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{replyFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(replyFile.size)}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setReplyFile(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileSelect}
                        accept="*/*"
                      />
                      <Button variant="outline" size="sm" asChild>
                        <span>
                          <Paperclip className="h-4 w-4 mr-2" />
                          {t('Attach File', 'Επισύναψη Αρχείου')}
                        </span>
                      </Button>
                    </label>
                  )}
                </div>

                <Button
                  onClick={handleSendReply}
                  disabled={(!replyText.trim() && !replyFile) || sending}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {uploading
                    ? t('Uploading...', 'Μεταφόρτωση...')
                    : t('Send via Telegram', 'Αποστολή μέσω Telegram')}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </MainLayout>
    );
  }

  const renderMessageCard = (msg: EmployeeMessage, isArchived: boolean) => (
    <Card
      key={msg.id}
      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
        !isArchived && msg.status === 'unread' ? 'border-l-4 border-l-destructive bg-destructive/5' : ''
      }`}
      onClick={() => !isArchived && handleSelectMessage(msg)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={`font-medium truncate ${!isArchived && msg.status === 'unread' ? 'font-bold' : ''}`}>
                  {msg.employees
                    ? `${msg.employees.first_name} ${msg.employees.last_name}`
                    : t('Unknown', 'Άγνωστος')}
                </p>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {msg.employees?.employee_code}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {getMessageIcon(msg.message_type)}
                <p className="text-sm text-muted-foreground truncate">
                  {(msg.message_text || t('Attachment', 'Συνημμένο')).substring(0, 60)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isArchived && isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setUnarchiveTarget(msg); }}
                className="text-muted-foreground hover:text-primary"
              >
                <ArchiveRestore className="h-4 w-4" />
              </Button>
            )}
            <div className="flex flex-col items-end gap-1">
              {getStatusBadge(msg.status)}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {isArchived && msg.archived_at
                  ? timeAgo(msg.archived_at)
                  : timeAgo(msg.created_at)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('Messages', 'Μηνύματα')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('Employee messages via Telegram', 'Μηνύματα εργαζομένων μέσω Telegram')}
              </p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-5 w-5" />
          </Button>
        </div>

        {/* Search & Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t('Search & Filters', 'Αναζήτηση & Φίλτρα')}
              </CardTitle>
              {(searchQuery || dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setDateFrom(undefined); setDateTo(undefined); }}>
                  <X className="h-4 w-4 mr-1" />
                  {t('Clear', 'Καθαρισμός')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Search by employee name or message...', 'Αναζήτηση κατά όνομα ή μήνυμα...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('From', 'Από')}:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[150px] justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : t('Select', 'Επιλογή')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      locale={language === 'el' ? elLocale : undefined}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {dateFrom && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDateFrom(undefined)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('To', 'Έως')}:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[150px] justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {dateTo ? format(dateTo, 'dd/MM/yyyy') : t('Select', 'Επιλογή')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      locale={language === 'el' ? elLocale : undefined}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {dateTo && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDateTo(undefined)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">
              {t('All', 'Όλα')} ({messages.length})
            </TabsTrigger>
            <TabsTrigger value="unread" className="relative">
              {t('Unread', 'Αδιάβαστα')}
              {unreadCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold text-white bg-destructive rounded-full min-w-[18px]">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="replied">{t('Replied', 'Απαντημένα')}</TabsTrigger>
            <TabsTrigger value="resolved">{t('Resolved', 'Επιλυμένα')}</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="archived">
                <Archive className="h-4 w-4 mr-1.5" />
                {t('Archived', 'Αρχείο')} ({archivedMessages.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Active tabs content */}
          {['all', 'unread', 'replied', 'resolved'].map(tabKey => (
            <TabsContent key={tabKey} value={tabKey} className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMessages.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{t('No messages found', 'Δεν βρέθηκαν μηνύματα')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredMessages.map((msg) => renderMessageCard(msg, false))}
                </div>
              )}
            </TabsContent>
          ))}

          {/* Archived tab content */}
          {isAdmin && (
            <TabsContent value="archived" className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredArchivedMessages.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Archive className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{t('No archived messages', 'Δεν υπάρχουν αρχειοθετημένα μηνύματα')}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredArchivedMessages.map((msg) => renderMessageCard(msg, true))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* Notification Settings Dialog */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('Notification Settings', 'Ρυθμίσεις Ειδοποιήσεων')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label>{t('Sound Notifications', 'Ηχητικές Ειδοποιήσεις')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('Play sound when new message arrives', 'Αναπαραγωγή ήχου κατά τη λήψη νέου μηνύματος')}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.soundEnabled}
                  onCheckedChange={(checked) => updateSettings({ soundEnabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label>{t('Desktop Notifications', 'Ειδοποιήσεις Επιφάνειας Εργασίας')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('Show browser notifications', 'Εμφάνιση ειδοποιήσεων browser')}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.browserEnabled}
                  onCheckedChange={(checked) => updateSettings({ browserEnabled: checked })}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Archive Confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Archive Message?', 'Αρχειοθέτηση Μηνύματος;')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget && t(
                `Are you sure you want to archive this message from "${archiveTarget.employees?.first_name} ${archiveTarget.employees?.last_name}"? It will be hidden from the list but not deleted.`,
                `Είστε σίγουροι ότι θέλετε να αρχειοθετήσετε αυτό το μήνυμα από "${archiveTarget.employees?.first_name} ${archiveTarget.employees?.last_name}"; Θα κρυφτεί από τη λίστα αλλά δεν θα διαγραφεί.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Ακύρωση')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveMessage}>
              {t('Yes, Archive', 'Ναι, Αρχειοθέτηση')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unarchive Confirmation */}
      <AlertDialog open={!!unarchiveTarget} onOpenChange={(open) => !open && setUnarchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('Restore Message?', 'Επαναφορά Μηνύματος;')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {unarchiveTarget && t(
                `Are you sure you want to restore this message from "${unarchiveTarget.employees?.first_name} ${unarchiveTarget.employees?.last_name}"? It will reappear in the active list.`,
                `Είστε σίγουροι ότι θέλετε να επαναφέρετε αυτό το μήνυμα από "${unarchiveTarget.employees?.first_name} ${unarchiveTarget.employees?.last_name}"; Θα εμφανιστεί ξανά στην ενεργή λίστα.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Ακύρωση')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnarchiveMessage}>
              {t('Yes, Restore', 'Ναι, Επαναφορά')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

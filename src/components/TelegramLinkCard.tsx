import { useState, useEffect } from 'react';
import { formatDateTime } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Copy, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface TelegramLinkCardProps {
  employeeId: string;
  hasElevatedRole: boolean;
}

interface ContactChannel {
  id: string;
  channel_identifier: string;
  is_verified: boolean;
  updated_at: string;
}

interface LinkCode {
  id: string;
  code: string;
  expires_at: string;
  used_at: string | null;
}

export function TelegramLinkCard({ employeeId, hasElevatedRole }: TelegramLinkCardProps) {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [contactChannel, setContactChannel] = useState<ContactChannel | null>(null);
  const [activeCode, setActiveCode] = useState<LinkCode | null>(null);

  useEffect(() => {
    if (employeeId && hasElevatedRole) {
      fetchTelegramStatus();
    }
  }, [employeeId, hasElevatedRole]);

  const fetchTelegramStatus = async () => {
    setLoading(true);
    try {
      const { data: channel, error: channelError } = await supabase
        .from('employee_contact_channels')
        .select('id, channel_identifier, is_verified, updated_at')
        .eq('employee_id', employeeId)
        .eq('channel_type', 'telegram')
        .maybeSingle();

      if (channelError) {
        console.error('Error fetching contact channel:', channelError);
      }
      setContactChannel(channel || null);

      const { data: codes, error: codesError } = await supabase
        .from('viber_link_codes')
        .select('id, code, expires_at, used_at')
        .eq('employee_id', employeeId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (codesError) {
        console.error('Error fetching link codes:', codesError);
      }
      setActiveCode(codes && codes.length > 0 ? codes[0] : null);
    } catch (error) {
      console.error('Error fetching Telegram status:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async () => {
    setGenerating(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error(language === 'el' ? 'Δεν είστε συνδεδεμένοι' : 'Not authenticated');
        return;
      }

      const { error } = await supabase
        .from('viber_link_codes')
        .insert({
          employee_id: employeeId,
          code,
          created_by: userData.user.id,
          expires_at: expiresAt.toISOString(),
        });

      if (error) {
        console.error('Error generating code:', error);
        toast.error(language === 'el' ? 'Σφάλμα δημιουργίας κωδικού' : 'Error generating code');
        return;
      }

      toast.success(language === 'el' ? 'Κωδικός δημιουργήθηκε' : 'Code generated');
      fetchTelegramStatus();
    } catch (error) {
      console.error('Error generating code:', error);
      toast.error(language === 'el' ? 'Σφάλμα' : 'Error');
    } finally {
      setGenerating(false);
    }
  };

  const revokeCode = async () => {
    if (!activeCode) return;
    try {
      const { error } = await supabase
        .from('viber_link_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', activeCode.id);

      if (error) {
        console.error('Error revoking code:', error);
        toast.error(language === 'el' ? 'Σφάλμα ανάκλησης' : 'Error revoking code');
        return;
      }

      toast.success(language === 'el' ? 'Κωδικός ανακλήθηκε' : 'Code revoked');
      setActiveCode(null);
    } catch (error) {
      console.error('Error revoking code:', error);
    }
  };

  const copyCode = () => {
    if (!activeCode) return;
    navigator.clipboard.writeText(`/link ${activeCode.code}`);
    toast.success(language === 'el' ? 'Αντιγράφηκε στο πρόχειρο' : 'Copied to clipboard');
  };

  const formatDateLocal = (dateString: string) => {
    return formatDateTime(dateString);
  };

  if (!hasElevatedRole) return null;

  if (loading) {
    return (
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {language === 'el' ? 'Σύνδεση Telegram' : 'Telegram Link'}
          </h3>
        </div>
        <div className="animate-pulse bg-muted h-16 rounded-md"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4" />
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {language === 'el' ? 'Σύνδεση Telegram' : 'Telegram Link'}
        </h3>
      </div>

      {contactChannel?.channel_identifier ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
              {language === 'el' ? 'Συνδεδεμένο' : 'Linked'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {language === 'el' ? 'Συνδέθηκε:' : 'Linked on:'}{' '}
            {formatDate(contactChannel.updated_at)}
          </p>
        </div>
      ) : activeCode ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {language === 'el' ? 'Ενεργός κωδικός:' : 'Active code:'}
            </span>
            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
              {language === 'el' ? 'Σε αναμονή' : 'Pending'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <code className="flex-1 text-2xl font-mono font-bold tracking-wider bg-background px-3 py-2 rounded border text-center">
              {activeCode.code}
            </code>
            <Button variant="outline" size="icon" onClick={copyCode} title={language === 'el' ? 'Αντιγραφή' : 'Copy'}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {language === 'el' ? 'Λήγει:' : 'Expires:'} {formatDate(activeCode.expires_at)}
          </p>

          <div className="text-sm text-muted-foreground bg-background/50 p-3 rounded border">
            <p className="font-medium mb-1">
              {language === 'el' ? 'Οδηγίες:' : 'Instructions:'}
            </p>
            <p>
              {language === 'el' 
                ? `Ανοίξτε το Telegram, βρείτε το @skynet_shipyard_bot και στείλτε: /link ${activeCode.code}`
                : `Open Telegram, find @skynet_shipyard_bot, and send: /link ${activeCode.code}`
              }
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={revokeCode} className="flex-1">
              <XCircle className="h-4 w-4 mr-1" />
              {language === 'el' ? 'Ανάκληση' : 'Revoke'}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchTelegramStatus}>
              <RefreshCw className="h-4 w-4 mr-1" />
              {language === 'el' ? 'Ανανέωση' : 'Refresh'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-muted/50 border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {language === 'el' ? 'Δεν έχει συνδεθεί' : 'Not linked'}
            </span>
          </div>
          
          <Button 
            onClick={generateCode} 
            disabled={generating}
            className="w-full"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {language === 'el' ? 'Δημιουργία...' : 'Generating...'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {language === 'el' ? 'Δημιουργία κωδικού σύνδεσης' : 'Generate link code'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

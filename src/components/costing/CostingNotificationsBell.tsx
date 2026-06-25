import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Bell, Check } from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface Notif {
  id: string;
  report_id: string;
  type: string;
  message: string | null;
  read_at: string | null;
  created_at: string;
}

export default function CostingNotificationsBell() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = (en: string, el: string) => (language === 'el' ? el : en);
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const fetchItems = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('cost_report_notifications')
      .select('id, report_id, type, message, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    setItems((data || []) as Notif[]);
  };

  useEffect(() => {
    if (!user) return;
    fetchItems();
    const channel = supabase
      .channel(`cost_notifs_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cost_report_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchItems(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unread = items.filter((i) => !i.read_at).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('cost_report_notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
      .eq('user_id', user.id);
    fetchItems();
  };

  const openItem = async (n: Notif) => {
    if (!n.read_at) {
      await supabase
        .from('cost_report_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', n.id);
    }
    setOpen(false);
    navigate(`/costing/reports/${n.report_id}`);
  };

  const typeLabel = (type: string) => {
    const map: Record<string, [string, string]> = {
      submitted_for_review: ['Submitted for review', 'Υποβλήθηκε προς έλεγχο'],
      approved: ['Approved', 'Εγκρίθηκε'],
      changes_requested: ['Changes requested', 'Ζητήθηκαν αλλαγές'],
    };
    const [en, el] = map[type] || [type, type];
    return language === 'el' ? el : en;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-80 p-0 z-50">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-medium text-sm">{t('Notifications', 'Ειδοποιήσεις')}</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAllRead}>
              <Check className="h-3 w-3 mr-1" />
              {t('Mark all read', 'Όλα ως αναγνωσμένα')}
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t('No notifications', 'Καμία ειδοποίηση')}
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={`w-full text-left p-3 border-b hover:bg-muted/50 transition ${
                  !n.read_at ? 'bg-blue-50' : ''
                }`}
              >
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span className="font-medium">{typeLabel(n.type)}</span>
                  <span>{new Date(n.created_at).toLocaleString('el-GR')}</span>
                </div>
                <div className="text-sm mt-0.5">{n.message || '—'}</div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

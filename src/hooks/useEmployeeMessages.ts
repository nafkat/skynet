import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface EmployeeMessage {
  id: string;
  employee_id: string;
  telegram_chat_id: number;
  message_text: string | null;
  message_type: string;
  attachment_url: string | null;
  attachment_file_id: string | null;
  status: string;
  admin_reply: string | null;
  created_at: string;
  replied_at: string | null;
  replied_by: string | null;
  employees?: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
}

export function useEmployeeMessages() {
  const [messages, setMessages] = useState<EmployeeMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { hasElevatedRole } = useAuth();

  const fetchMessages = useCallback(async () => {
    if (!hasElevatedRole) {
      setMessages([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('employee_messages')
        .select('*, employees(first_name, last_name, employee_code)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages((data as any[]) || []);
      setUnreadCount((data as any[])?.filter((m: any) => m.status === 'unread').length || 0);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [hasElevatedRole]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!hasElevatedRole) return;

    const channel = supabase
      .channel('employee_messages_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employee_messages' },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasElevatedRole, fetchMessages]);

  return { messages, unreadCount, loading, refetch: fetchMessages };
}

export function useUnreadMessageCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const { hasElevatedRole } = useAuth();

  const fetchCount = useCallback(async () => {
    if (!hasElevatedRole) {
      setUnreadCount(0);
      return;
    }

    try {
      const { count, error } = await supabase
        .from('employee_messages')
        .select('*', { count: 'exact', head: true })
        .in('status', ['unread', 'reopened']);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [hasElevatedRole]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (!hasElevatedRole) return;

    const channel = supabase
      .channel('unread_messages_count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employee_messages' },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasElevatedRole, fetchCount]);

  return { unreadCount };
}

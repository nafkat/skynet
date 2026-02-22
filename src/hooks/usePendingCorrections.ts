import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePendingCorrections = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingByEmployee, setPendingByEmployee] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { hasElevatedRole } = useAuth();

  useEffect(() => {
    if (!hasElevatedRole) {
      setPendingCount(0);
      setPendingByEmployee({});
      setLoading(false);
      return;
    }

    const fetchPendingCount = async () => {
      try {
        const { data, error } = await supabase
          .from('correction_requests')
          .select('id, time_entries(employee_id)')
          .eq('status', 'pending');

        if (error) throw error;

        const total = data?.length || 0;
        setPendingCount(total);

        // Count by employee
        const byEmployee: Record<string, number> = {};
        data?.forEach((req: any) => {
          const employeeId = req.time_entries?.employee_id;
          if (employeeId) {
            byEmployee[employeeId] = (byEmployee[employeeId] || 0) + 1;
          }
        });
        setPendingByEmployee(byEmployee);
      } catch (error) {
        console.error('Error fetching pending corrections:', error);
        setPendingCount(0);
        setPendingByEmployee({});
      } finally {
        setLoading(false);
      }
    };

    fetchPendingCount();

    const channel = supabase
      .channel('corrections_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'correction_requests',
        },
        () => {
          fetchPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasElevatedRole]);

  return { pendingCount, pendingByEmployee, loading };
};

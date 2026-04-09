import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CorrectionStatus {
  status: 'pending' | 'approved' | 'rejected';
  review_notes: string | null;
  request_type: 'EDIT' | 'DELETE';
}

export const usePendingCorrections = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingByEmployee, setPendingByEmployee] = useState<Record<string, number>>({});
  const [correctionsByEntryId, setCorrectionsByEntryId] = useState<Record<string, CorrectionStatus>>({});
  const [loading, setLoading] = useState(true);
  const { user, hasElevatedRole } = useAuth();

  const fetchData = async () => {
    if (!user) {
      setPendingCount(0);
      setPendingByEmployee({});
      setCorrectionsByEntryId({});
      setLoading(false);
      return;
    }

    try {
      if (hasElevatedRole) {
        const { data: pendingData, error: pendingError } = await supabase
          .from('correction_requests')
          .select('id, time_entries(employee_id)')
          .eq('status', 'pending');

        if (!pendingError && pendingData) {
          setPendingCount(pendingData.length);
          const byEmployee: Record<string, number> = {};
          pendingData.forEach((req: any) => {
            const employeeId = req.time_entries?.employee_id;
            if (employeeId) {
              byEmployee[employeeId] = (byEmployee[employeeId] || 0) + 1;
            }
          });
          setPendingByEmployee(byEmployee);
        }
      } else {
        setPendingCount(0);
        setPendingByEmployee({});
      }

      // All users: fetch their own corrections (or all for elevated) to build entry status map
      let query = supabase
        .from('correction_requests')
        .select('id, time_entry_id, status, review_notes, request_type, created_at')
        .order('created_at', { ascending: false });

      if (!hasElevatedRole) {
        query = query.eq('requested_by', user.id);
      }

      const { data: allData, error: allError } = await query;

      if (!allError && allData) {
        const byEntryId: Record<string, CorrectionStatus> = {};
        allData.forEach((req: any) => {
          if (!byEntryId[req.time_entry_id]) {
            byEntryId[req.time_entry_id] = {
              status: req.status,
              review_notes: req.review_notes,
              request_type: req.request_type,
            };
          }
        });
        setCorrectionsByEntryId(byEntryId);
      }
    } catch (error) {
      console.error('Error fetching corrections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('corrections_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'correction_requests' },
        () => { fetchData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, hasElevatedRole]);

  return { pendingCount, pendingByEmployee, correctionsByEntryId, loading };
};

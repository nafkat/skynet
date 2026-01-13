import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, X, Clock, AlertCircle, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CorrectionRequest {
  id: string;
  time_entry_id: string;
  requested_by: string;
  request_reason: string;
  request_type: 'EDIT' | 'DELETE';
  new_start_time: string | null;
  new_end_time: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  time_entries: {
    id: string;
    entry_date: string;
    start_time: string;
    end_time: string;
    is_deleted: boolean;
    employees: {
      first_name: string;
      last_name: string;
      employee_code: string;
    };
    projects: {
      project_code: string;
      project_name: string;
    };
  };
}

export default function Corrections() {
  const { t } = useLanguage();
  const { user, hasElevatedRole } = useAuth();
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<CorrectionRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('correction_requests')
        .select(`
          *,
          time_entries (
            id,
            entry_date,
            start_time,
            end_time,
            is_deleted,
            employees (first_name, last_name, employee_code),
            projects (project_code, project_name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data as CorrectionRequest[]) || []);
    } catch (error) {
      console.error('Error fetching correction requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest || !user) return;
    
    setProcessing(true);

    try {
      // Update correction request
      const { error: updateError } = await supabase
        .from('correction_requests')
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      // If approved, apply the change based on request type
      if (status === 'approved') {
        if (selectedRequest.request_type === 'DELETE') {
          // Soft delete the time entry
          const { error: deleteError } = await supabase
            .from('time_entries')
            .update({
              is_deleted: true,
              deleted_at: new Date().toISOString(),
              deleted_by: user.id,
              delete_reason: selectedRequest.request_reason,
            })
            .eq('id', selectedRequest.time_entry_id);

          if (deleteError) throw deleteError;
        } else {
          // EDIT request - update the time entry
          const updateData: any = {};
          if (selectedRequest.new_start_time) {
            updateData.start_time = selectedRequest.new_start_time;
          }
          if (selectedRequest.new_end_time) {
            updateData.end_time = selectedRequest.new_end_time;
          }

          if (Object.keys(updateData).length > 0) {
            const { error: entryError } = await supabase
              .from('time_entries')
              .update(updateData)
              .eq('id', selectedRequest.time_entry_id);

            if (entryError) throw entryError;
          }
        }
      }

      toast.success(status === 'approved' ? 'Request approved' : 'Request rejected');
      setSelectedRequest(null);
      setReviewNotes('');
      fetchRequests();
    } catch (error: any) {
      console.error('Error processing request:', error);
      toast.error(error.message || 'Error processing request');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'badge-pending',
      approved: 'badge-active',
      rejected: 'badge-inactive',
    };

    const labels = {
      pending: t('corrections.pending'),
      approved: t('corrections.approved'),
      rejected: t('corrections.rejected'),
    };

    return (
      <span className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
        styles[status as keyof typeof styles]
      )}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getRequestTypeBadge = (requestType: 'EDIT' | 'DELETE') => {
    if (requestType === 'DELETE') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-destructive/10 text-destructive border-destructive/30">
          <Trash2 className="h-3 w-3" />
          {t('corrections.deleteRequest')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-primary/10 text-primary border-primary/30">
        <Edit2 className="h-3 w-3" />
        {t('corrections.editRequest')}
      </span>
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">{t('common.loading')}</div>
        </div>
      </MainLayout>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">{t('corrections.title')}</h1>
        <p className="page-subtitle">
          {pendingRequests.length} {t('corrections.pending').toLowerCase()}
        </p>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            {t('corrections.pending')}
          </h2>
          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <div key={request.id} className="card-elevated p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">
                        {request.time_entries.employees.first_name} {request.time_entries.employees.last_name}
                      </h3>
                      {getRequestTypeBadge(request.request_type)}
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {request.time_entries.projects.project_code} - {request.time_entries.projects.project_name}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('common.date')}</p>
                        <p className="font-mono">{format(new Date(request.time_entries.entry_date), 'MMM d, yyyy')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">{t('common.time')}</p>
                        <p className="font-mono">
                          {request.time_entries.start_time.slice(0, 5)} - {request.time_entries.end_time.slice(0, 5)}
                        </p>
                      </div>
                    </div>

                    {/* Only show new time section for EDIT requests */}
                    {request.request_type === 'EDIT' && (request.new_start_time || request.new_end_time) && (
                      <div className="bg-muted/50 rounded-lg p-3 mb-4">
                        <p className="text-xs text-muted-foreground mb-1">{t('corrections.newTime')}</p>
                        <p className="font-mono">
                          {request.new_start_time?.slice(0, 5) || request.time_entries.start_time.slice(0, 5)} -{' '}
                          {request.new_end_time?.slice(0, 5) || request.time_entries.end_time.slice(0, 5)}
                        </p>
                      </div>
                    )}
                    
                    {/* Show delete warning for DELETE requests */}
                    {request.request_type === 'DELETE' && (
                      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4">
                        <p className="text-xs text-destructive font-medium mb-1">⚠️ {t('corrections.deleteRequest')}</p>
                        <p className="text-sm text-destructive/80">
                          This entry will be permanently marked as deleted if approved.
                        </p>
                      </div>
                    )}

                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">{t('corrections.reason')}</p>
                      <p className="text-sm">{request.request_reason}</p>
                    </div>
                  </div>

                  {hasElevatedRole && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-success border-success/30 hover:bg-success/10"
                        onClick={() => setSelectedRequest(request)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {t('corrections.approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => {
                          setSelectedRequest(request);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        {t('corrections.reject')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">{t('common.all')}</h2>
          <div className="card-elevated overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="table-cell text-left">{t('employees.title')}</th>
                    <th className="table-cell text-left">{t('common.date')}</th>
                    <th className="table-cell text-left">{t('corrections.reason')}</th>
                    <th className="table-cell text-left">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {processedRequests.map((request) => (
                    <tr key={request.id} className="table-row">
                      <td className="table-cell">
                        {request.time_entries.employees.first_name} {request.time_entries.employees.last_name}
                      </td>
                      <td className="table-cell font-mono text-sm">
                        {format(new Date(request.time_entries.entry_date), 'MMM d, yyyy')}
                      </td>
                      <td className="table-cell text-sm text-muted-foreground">
                        {request.request_reason.slice(0, 50)}...
                      </td>
                      <td className="table-cell">
                        {getStatusBadge(request.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="card-elevated p-12 text-center text-muted-foreground">
          {t('common.noData')}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => {
        setSelectedRequest(null);
        setReviewNotes('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('corrections.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Review Notes (optional)</label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes about this decision..."
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => handleReview('rejected')}
                disabled={processing}
              >
                <X className="h-4 w-4 mr-2" />
                {t('corrections.reject')}
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleReview('approved')}
                disabled={processing}
              >
                <Check className="h-4 w-4 mr-2" />
                {t('corrections.approve')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

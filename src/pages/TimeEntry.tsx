import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RefreshButton } from '@/components/RefreshButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Clock, Plus, Edit2, AlertCircle, X, Save, FileEdit, Trash2, Users, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePendingCorrections } from '@/hooks/usePendingCorrections';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { format, subHours } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  specialty_id: string;
  regular_hourly_rate?: number;
  regular_rate_all_in?: number;
  overtime_hourly_rate?: number;
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
}

interface TimeEntryData {
  id: string;
  employee_id: string;
  project_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  regular_minutes: number;
  overtime_minutes: number;
  created_at: string;
  created_by: string;
  is_deleted?: boolean;
  employees: Employee;
  projects: Project;
}

type FormMode = 'create' | 'edit';

// Helper to get today's date in Europe/Athens timezone
const getTodayAthens = (): string => {
  const now = new Date();
  const athensTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return athensTime; // Returns YYYY-MM-DD format
};

export default function TimeEntry() {
  const { t, language } = useLanguage();
  const { user, hasElevatedRole, role } = useAuth();
  const navigate = useNavigate();
  const { pendingByEmployee } = usePendingCorrections();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Form mode and editing state
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingEntry, setEditingEntry] = useState<TimeEntryData | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<TimeEntryData | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleteRequest, setIsDeleteRequest] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Timekeeper only flag
  const isTimekeeperOnly = role === 'timekeeper' && !hasElevatedRole;

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('14:00');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // For Timekeeper: use limited view that doesn't expose sensitive data
      // RLS policies already filter what they can see
      // Include pay rates only for elevated roles to check validity
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, employee_code, first_name, last_name, specialty_id, regular_hourly_rate, regular_rate_all_in, overtime_hourly_rate')
        .eq('status', 'active')
        .order('last_name');

      // Projects - only OPEN projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, project_code, project_name')
        .eq('status', 'OPEN')
        .order('project_code');

      // Fetch today's entries only (Europe/Athens timezone)
      // This is the "Today's Entries" panel - shows same day only
      const todayAthens = getTodayAthens();
      const { data: entriesData } = await supabase
        .from('time_entries')
        .select(`
          *,
          employees (id, employee_code, first_name, last_name, specialty_id),
          projects (id, project_code, project_name)
        `)
        .eq('is_deleted', false)
        .eq('entry_date', todayAthens)
        .order('start_time', { ascending: false })
        .limit(50);

      setEmployees(employeesData || []);
      setProjects(projectsData || []);
      setRecentEntries((entriesData as TimeEntryData[]) || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetForm = () => {
    setFormMode('create');
    setEditingEntry(null);
    setSelectedEmployee('');
    setSelectedProject('');
    setEntryDate(format(new Date(), 'yyyy-MM-dd'));
    setStartTime('07:00');
    setEndTime('14:00');
    setCorrectionReason('');
  };

  const handleEdit = (entry: TimeEntryData) => {
    setFormMode('edit');
    setEditingEntry(entry);
    setSelectedEmployee(entry.employee_id);
    setSelectedProject(entry.project_id);
    setEntryDate(entry.entry_date);
    setStartTime(entry.start_time.slice(0, 5));
    setEndTime(entry.end_time.slice(0, 5));
    setCorrectionReason('');

    // Scroll to form
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast.info(t('timeEntry.entryLoadedForEditing'));
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  // Check if selected employee has valid pay rates
  const selectedEmployeeData = employees.find(e => e.id === selectedEmployee);
  const hasValidPayRates = selectedEmployeeData ? 
    (selectedEmployeeData.regular_hourly_rate && selectedEmployeeData.regular_hourly_rate > 0) &&
    (selectedEmployeeData.regular_rate_all_in && selectedEmployeeData.regular_rate_all_in > 0) &&
    (selectedEmployeeData.overtime_hourly_rate && selectedEmployeeData.overtime_hourly_rate > 0) : true;

  // Calculate entry counts per employee for today
  const employeeEntryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    recentEntries.forEach(entry => {
      const current = counts.get(entry.employee_id) || 0;
      counts.set(entry.employee_id, current + 1);
    });
    return counts;
  }, [recentEntries]);

  // Get recently used employees today (last 5 unique, most recent first)
  const recentlyUsedEmployees = useMemo(() => {
    const seenIds = new Set<string>();
    const recent: Employee[] = [];
    
    for (const entry of recentEntries) {
      if (!seenIds.has(entry.employee_id)) {
        seenIds.add(entry.employee_id);
        const emp = employees.find(e => e.id === entry.employee_id);
        if (emp) {
          recent.push(emp);
        }
        if (recent.length >= 5) break;
      }
    }
    
    return recent;
  }, [recentEntries, employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEmployee || !selectedProject || !startTime || !endTime) {
      toast.error(t('common.fillAllFields') || 'Please fill in all fields');
      return;
    }

    // Validate pay rates
    if (!hasValidPayRates) {
      toast.error(t('timeEntry.incompletePayRates'));
      return;
    }

    // Validate times
    if (startTime >= endTime) {
      toast.error(t('timeEntry.endAfterStart') || 'End time must be after start time');
      return;
    }

    // Client-side overlap check before submitting
    const overlappingEntry = recentEntries.find(entry => {
      // Only check entries for the same employee and date
      if (entry.employee_id !== selectedEmployee || entry.entry_date !== entryDate) {
        return false;
      }
      // Exclude current entry when editing
      if (formMode === 'edit' && editingEntry && entry.id === editingEntry.id) {
        return false;
      }
      // Check overlap: new_start < existing_end AND new_end > existing_start
      const existingStart = entry.start_time.slice(0, 5);
      const existingEnd = entry.end_time.slice(0, 5);
      return startTime < existingEnd && endTime > existingStart;
    });

    if (overlappingEntry) {
      toast.error(t('timeEntry.overlapError'));
      return;
    }

    setSubmitting(true);

    try {
      if (formMode === 'create') {
        // Create new entry
        const { error } = await supabase.from('time_entries').insert({
          employee_id: selectedEmployee,
          project_id: selectedProject,
          entry_date: entryDate,
          start_time: startTime,
          end_time: endTime,
          created_by: user?.id,
        });

        if (error) {
          // Check for overlap error from trigger
          if (error.message?.includes('Overlap detected')) {
            toast.error(t('timeEntry.overlapError'));
          } else {
            throw error;
          }
          return;
        }
        toast.success(t('timeEntry.success'));
      } else {
        // Edit mode
        if (!editingEntry) return;

        if (hasElevatedRole) {
          // Admin/HR can directly update
          const { error } = await supabase
            .from('time_entries')
            .update({
              project_id: selectedProject,
              entry_date: entryDate,
              start_time: startTime,
              end_time: endTime,
            })
            .eq('id', editingEntry.id);

          if (error) {
            if (error.message?.includes('Overlap detected')) {
              toast.error(t('timeEntry.overlapError'));
            } else {
              throw error;
            }
            return;
          }
          toast.success(t('timeEntry.changesSaved'));
        } else {
          // Timekeeper must submit correction request
          if (!correctionReason.trim()) {
            toast.error(t('timeEntry.reasonRequired') || 'Please provide a reason for the correction');
            setSubmitting(false);
            return;
          }

          const { error } = await supabase.from('correction_requests').insert({
            time_entry_id: editingEntry.id,
            requested_by: user?.id,
            new_start_time: startTime,
            new_end_time: endTime,
            new_entry_date: entryDate,
            new_project_id: selectedProject,
            request_reason: correctionReason.trim(),
            status: 'pending',
          });

          if (error) throw error;
          toast.success(t('timeEntry.correctionSubmitted'));
        }
      }
      
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Check if entry can be directly edited (within 24h by creator or elevated role)
  const canDirectEdit = (entry: TimeEntryData) => {
    if (!user) return false;
    if (hasElevatedRole) return true;
    
    if (entry.created_by !== user.id) return false;
    
    const createdAt = new Date(entry.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    return hoursDiff <= 24;
  };

  // Check if user can request correction (their own entry, past 24h)
  const canRequestCorrection = (entry: TimeEntryData) => {
    if (!user) return false;
    if (hasElevatedRole) return false; // Admin/HR edit directly
    if (entry.created_by !== user.id) return false;
    
    const createdAt = new Date(entry.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    return hoursDiff > 24;
  };

  // Check if timekeeper can delete directly (same calendar day in Europe/Athens)
  const canDirectDelete = (entry: TimeEntryData) => {
    if (!user) return false;
    if (hasElevatedRole) return true; // Admin/HR can always delete
    if (entry.created_by !== user.id) return false;
    
    const todayAthens = getTodayAthens();
    return entry.entry_date === todayAthens;
  };

  // Check if user needs to request deletion (their own entry, not today)
  const needsDeleteRequest = (entry: TimeEntryData) => {
    if (!user) return false;
    if (hasElevatedRole) return false; // Admin/HR delete directly
    if (entry.created_by !== user.id) return false;
    
    const todayAthens = getTodayAthens();
    return entry.entry_date !== todayAthens;
  };

  // Handle delete button click
  const handleDeleteClick = (entry: TimeEntryData) => {
    setDeletingEntry(entry);
    setDeleteReason('');
    
    if (needsDeleteRequest(entry)) {
      setIsDeleteRequest(true);
    } else {
      setIsDeleteRequest(false);
    }
    
    setDeleteDialogOpen(true);
  };

  // Perform soft delete
  const handleDelete = async () => {
    if (!deletingEntry || !user) return;
    
    setDeleting(true);
    
    try {
      if (isDeleteRequest) {
        // Submit deletion request for approval
        if (!deleteReason.trim()) {
          toast.error(t('timeEntry.reasonRequired'));
          setDeleting(false);
          return;
        }
        
        const { error } = await supabase.from('correction_requests').insert({
          time_entry_id: deletingEntry.id,
          requested_by: user.id,
          request_reason: deleteReason.trim(),
          request_type: 'DELETE',
          status: 'pending',
        });
        
        if (error) throw error;
        toast.success(t('timeEntry.deletionRequestSubmitted'));
      } else {
        // Direct soft delete
        const { error } = await supabase
          .from('time_entries')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: user.id,
            delete_reason: deleteReason.trim() || null,
          })
          .eq('id', deletingEntry.id);
        
        if (error) throw error;
        toast.success(t('timeEntry.deleteSuccess'));
      }
      
      setDeleteDialogOpen(false);
      setDeletingEntry(null);
      setDeleteReason('');
      fetchData();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || t('common.error'));
    } finally {
      setDeleting(false);
    }
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

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">{t('timeEntry.title')}</h1>
        <p className="page-subtitle">{formatDateLong(new Date(), language)}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Time Entry Form */}
        <div className="card-elevated p-6" ref={formRef}>
          {/* Edit mode banner */}
          {formMode === 'edit' && editingEntry && (
            <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileEdit className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {t('timeEntry.editingEntry')}: {editingEntry.employees.first_name} {editingEntry.employees.last_name} • {formatDate(editingEntry.entry_date)}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-7 px-2">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-semibold">
              {formMode === 'create' ? t('timeEntry.register') : t('timeEntry.editEntry')}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('common.date')}</Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="input-tablet"
              />
            </div>

            {/* Employee */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('timeEntry.selectEmployee')}</Label>
              <Select 
                value={selectedEmployee} 
                onValueChange={setSelectedEmployee}
                disabled={formMode === 'edit'}
              >
                <SelectTrigger className="input-tablet">
                  <SelectValue placeholder={t('timeEntry.selectEmployee')} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {/* Recently used today section */}
                  {recentlyUsedEmployees.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Users className="h-3 w-3" />
                        {t('timeEntry.recentlyUsedToday')}
                      </div>
                      {recentlyUsedEmployees.map((emp) => {
                        const count = employeeEntryCounts.get(emp.id) || 0;
                        return (
                          <SelectItem key={`recent-${emp.id}`} value={emp.id}>
                            <div className="flex items-center justify-between w-full gap-3">
                              <span>{emp.first_name} {emp.last_name} ({emp.employee_code})</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0">
                                {count} {t('timeEntry.entriesToday')}
                              </Badge>
                            </div>
                          </SelectItem>
                        );
                      })}
                      <Separator className="my-1" />
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        {language === 'el' ? 'Όλοι οι εργαζόμενοι' : 'All employees'}
                      </div>
                    </>
                  )}
                  {/* All employees */}
                  {employees.map((emp) => {
                    const count = employeeEntryCounts.get(emp.id) || 0;
                    return (
                      <SelectItem key={emp.id} value={emp.id}>
                        <div className="flex items-center justify-between w-full gap-3">
                          <span>{emp.first_name} {emp.last_name} ({emp.employee_code})</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0">
                            {count} {t('timeEntry.entriesToday')}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {formMode === 'edit' && (
                <p className="text-xs text-muted-foreground">{t('timeEntry.employeeReadOnly')}</p>
              )}
              {/* Pay rate warning */}
              {selectedEmployee && !hasValidPayRates && (
                <div className="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-destructive font-medium">{t('timeEntry.incompletePayRatesTitle')}</p>
                    <p className="text-xs text-destructive/80 mt-1">{t('timeEntry.incompletePayRatesDesc')}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Project */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('timeEntry.selectProject')}</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="input-tablet">
                  <SelectValue placeholder={t('timeEntry.selectProject')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      {proj.project_code} - {proj.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('timeEntry.startTime')}</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input-tablet time-display"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('timeEntry.endTime')}</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input-tablet time-display"
                />
              </div>
            </div>

            {/* Correction Reason (Timekeeper in edit mode only) */}
            {formMode === 'edit' && isTimekeeperOnly && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('timeEntry.correctionReason')} *</Label>
                <Textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder={t('timeEntry.correctionReasonPlaceholder')}
                  className="min-h-[80px]"
                  required
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {formMode === 'edit' && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCancelEdit}
                  className="flex-1"
                >
                  {t('timeEntry.cancelEdit')}
                </Button>
              )}
              
              <Button type="submit" className="flex-1 btn-tablet" disabled={submitting || (selectedEmployee && !hasValidPayRates)}>
                {formMode === 'create' ? (
                  <>
                    <Plus className="h-5 w-5 mr-2" />
                    {submitting ? t('common.loading') : t('timeEntry.register')}
                  </>
                ) : hasElevatedRole ? (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    {submitting ? t('common.loading') : t('timeEntry.saveChanges')}
                  </>
                ) : (
                  <>
                    <FileEdit className="h-5 w-5 mr-2" />
                    {submitting ? t('common.loading') : t('timeEntry.requestCorrection')}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Recent Entries */}
        <div className="card-elevated p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold">{t('timeEntry.recentEntries')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <RefreshButton onRefresh={fetchData} lastRefresh={lastRefresh} />
          </div>
          
          {recentEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('timeEntry.noEntriesToday')}
            </div>
          ) : (
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    editingEntry?.id === entry.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border bg-muted/30 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        {pendingByEmployee[entry.employee_id] > 0 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="inline-flex items-center gap-1 text-destructive cursor-pointer hover:underline"
                                  onClick={() => navigate('/corrections')}
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  {entry.employees.first_name} {entry.employees.last_name}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">
                                  {pendingByEmployee[entry.employee_id]} {language === 'el' ? 'εκκρεμή αιτήματα διόρθωσης' : `pending correction request${pendingByEmployee[entry.employee_id] > 1 ? 's' : ''}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {language === 'el' ? 'Κλικ για προβολή' : 'Click to view details'}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span>{entry.employees.first_name} {entry.employees.last_name}</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.projects.project_code} - {entry.projects.project_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm">
                        {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.entry_date), 'MMM d')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <div className="flex gap-4 text-sm">
                      <span>
                        <span className="text-muted-foreground">{t('timeEntry.regular')}:</span>{' '}
                        {formatDuration(entry.regular_minutes)}
                      </span>
                      {entry.overtime_minutes > 0 && (
                        <span className="text-warning">
                          <span className="text-muted-foreground">{t('timeEntry.overtime')}:</span>{' '}
                          {formatDuration(entry.overtime_minutes)}
                        </span>
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex gap-1">
                      {/* Edit button - show if can edit or request correction */}
                      {(canDirectEdit(entry) || canRequestCorrection(entry)) && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8"
                          onClick={() => handleEdit(entry)}
                          disabled={editingEntry?.id === entry.id}
                        >
                          {canDirectEdit(entry) ? (
                            <Edit2 className="h-4 w-4" />
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 mr-1" />
                              <span className="text-xs">{t('timeEntry.requestCorrection')}</span>
                            </>
                          )}
                        </Button>
                      )}
                      
                      {/* Delete button - show if can delete or request deletion */}
                      {(canDirectDelete(entry) || needsDeleteRequest(entry)) && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteClick(entry)}
                          disabled={editingEntry?.id === entry.id}
                        >
                          {canDirectDelete(entry) ? (
                            <Trash2 className="h-4 w-4" />
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-1" />
                              <span className="text-xs">{t('timeEntry.requestDeletion')}</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setDeleteDialogOpen(false);
          setDeletingEntry(null);
          setDeleteReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isDeleteRequest ? t('timeEntry.requestDeletion') : t('timeEntry.delete')}
            </DialogTitle>
            <DialogDescription>
              {isDeleteRequest 
                ? t('timeEntry.cannotDeleteOldEntry')
                : t('timeEntry.deleteConfirm')
              }
            </DialogDescription>
          </DialogHeader>
          
          {deletingEntry && (
            <div className="py-4 space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium">
                  {deletingEntry.employees.first_name} {deletingEntry.employees.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {deletingEntry.projects.project_code} - {format(new Date(deletingEntry.entry_date), 'MMM d, yyyy')}
                </p>
                <p className="text-sm font-mono">
                  {deletingEntry.start_time.slice(0, 5)} - {deletingEntry.end_time.slice(0, 5)}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t('timeEntry.deleteReason')} {isDeleteRequest ? '*' : `(${t('timeEntry.optional')})`}
                </Label>
                <Textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder={t('timeEntry.deleteReasonPlaceholder')}
                  className="min-h-[80px]"
                  required={isDeleteRequest}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingEntry(null);
                setDeleteReason('');
              }}
              disabled={deleting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || (isDeleteRequest && !deleteReason.trim())}
            >
              {deleting ? t('common.loading') : (isDeleteRequest ? t('timeEntry.requestDeletion') : t('common.delete'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

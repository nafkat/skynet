import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Plus, Edit2, AlertCircle, X, Save, FileEdit } from 'lucide-react';
import { toast } from 'sonner';
import { format, subHours } from 'date-fns';

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  specialty_id: string;
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
  employees: Employee;
  projects: Project;
}

type FormMode = 'create' | 'edit';

export default function TimeEntry() {
  const { t, language } = useLanguage();
  const { user, hasElevatedRole, role } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form mode and editing state
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingEntry, setEditingEntry] = useState<TimeEntryData | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

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

  const fetchData = async () => {
    try {
      // For Timekeeper: use limited view that doesn't expose sensitive data
      // RLS policies already filter what they can see
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, employee_code, first_name, last_name, specialty_id')
        .eq('status', 'active')
        .order('last_name');

      // Projects - RLS filters to open projects for Timekeeper
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, project_code, project_name')
        .order('project_code');

      // Fetch recent entries - RLS restricts to own entries for Timekeeper
      const sevenDaysAgo = format(subHours(new Date(), 168), 'yyyy-MM-dd');
      const { data: entriesData } = await supabase
        .from('time_entries')
        .select(`
          *,
          employees (id, employee_code, first_name, last_name, specialty_id),
          projects (id, project_code, project_name)
        `)
        .gte('entry_date', sevenDaysAgo)
        .order('entry_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(20);

      setEmployees(employeesData || []);
      setProjects(projectsData || []);
      setRecentEntries((entriesData as TimeEntryData[]) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEmployee || !selectedProject || !startTime || !endTime) {
      toast.error(t('common.fillAllFields') || 'Please fill in all fields');
      return;
    }

    // Validate times
    if (startTime >= endTime) {
      toast.error(t('timeEntry.endAfterStart') || 'End time must be after start time');
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

        if (error) throw error;
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

          if (error) throw error;
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
        <p className="page-subtitle">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
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
                  {t('timeEntry.editingEntry')}: {editingEntry.employees.first_name} {editingEntry.employees.last_name} • {format(new Date(editingEntry.entry_date), 'MMM d, yyyy')}
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
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formMode === 'edit' && (
                <p className="text-xs text-muted-foreground">{t('timeEntry.employeeReadOnly')}</p>
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
              
              <Button type="submit" className="flex-1 btn-tablet" disabled={submitting}>
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
          <h2 className="text-lg font-semibold mb-6">{t('timeEntry.recentEntries')}</h2>
          
          {recentEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('common.noData')}
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
                        {entry.employees.first_name} {entry.employees.last_name}
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
                    
                    {/* Edit button - always show if can edit or request correction */}
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

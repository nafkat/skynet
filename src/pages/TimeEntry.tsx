import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Plus, Edit2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, isWithinInterval, subHours } from 'date-fns';

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

interface TimeEntry {
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

export default function TimeEntry() {
  const { t, language } = useLanguage();
  const { user, hasElevatedRole, role } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
      setRecentEntries((entriesData as TimeEntry[]) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEmployee || !selectedProject || !startTime || !endTime) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);

    try {
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
      
      // Reset form
      setSelectedEmployee('');
      setSelectedProject('');
      setStartTime('07:00');
      setEndTime('14:00');
      
      // Refresh entries
      fetchData();
    } catch (error: any) {
      console.error('Error creating time entry:', error);
      toast.error(error.message || 'Error creating time entry');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const canEdit = (entry: TimeEntry) => {
    if (!user) return false;
    if (entry.created_by !== user.id) return false;
    
    const createdAt = new Date(entry.created_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    return hoursDiff <= 24;
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
        <div className="card-elevated p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-semibold">{t('timeEntry.register')}</h2>
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
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
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

            <Button type="submit" className="w-full btn-tablet" disabled={submitting}>
              <Plus className="h-5 w-5 mr-2" />
              {submitting ? t('common.loading') : t('timeEntry.register')}
            </Button>
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
                  className="p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
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
                    
                    {canEdit(entry) ? (
                      <Button variant="ghost" size="sm" className="h-8">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    ) : entry.created_by === user?.id ? (
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {t('timeEntry.requestCorrection')}
                      </Button>
                    ) : null}
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

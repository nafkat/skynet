import { useState, useEffect, useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Clock, 
  Timer, 
  DollarSign, 
  FolderOpen, 
  AlertTriangle,
  CalendarIcon,
  Users,
  FileSpreadsheet
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface TimeEntry {
  id: string;
  entry_date: string;
  regular_minutes: number;
  overtime_minutes: number;
  duration_minutes: number;
  employee_id: string;
  project_id: string;
  employees: {
    id: string;
    first_name: string;
    last_name: string;
    specialty_id: string;
    regular_hourly_rate: number;
    overtime_hourly_rate: number;
  };
  projects: {
    id: string;
    project_code: string;
    project_name: string;
  };
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  status: string;
}

interface Specialty {
  id: string;
  code: string;
  name_en: string;
  name_el: string;
}

interface LaborByProject {
  projectCode: string;
  projectName: string;
  totalHours: number;
  overtimeHours: number;
  totalLaborCost: number;
  overtimePercentage: number;
}

interface LaborBySpecialty {
  specialty: string;
  specialtyId: string;
  totalHours: number;
  overtimeHours: number;
  totalLaborCost: number;
}

interface Alert {
  type: 'overtime_employee' | 'overtime_project';
  message: string;
  severity: 'warning' | 'critical';
}

type DateRangeType = 'today' | 'thisWeek' | 'custom';

export default function AdminDashboard() {
  const { t, language } = useLanguage();
  const { hasElevatedRole, loading: authLoading } = useAuth();
  
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('today');
  const [customDateFrom, setCustomDateFrom] = useState<Date>(new Date());
  const [customDateTo, setCustomDateTo] = useState<Date>(new Date());
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateRangeType) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'thisWeek':
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'custom':
        return { from: startOfDay(customDateFrom), to: endOfDay(customDateTo) };
      default:
        return { from: startOfDay(now), to: endOfDay(now) };
    }
  }, [dateRangeType, customDateFrom, customDateTo]);

  useEffect(() => {
    if (hasElevatedRole) {
      fetchData();
    }
  }, [hasElevatedRole, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    
    const fromDate = format(dateRange.from, 'yyyy-MM-dd');
    const toDate = format(dateRange.to, 'yyyy-MM-dd');

    const [entriesRes, projectsRes, specialtiesRes] = await Promise.all([
      supabase
        .from('time_entries')
        .select(`
          id,
          entry_date,
          regular_minutes,
          overtime_minutes,
          duration_minutes,
          employee_id,
          project_id,
          employees!inner (
            id,
            first_name,
            last_name,
            specialty_id,
            regular_hourly_rate,
            overtime_hourly_rate
          ),
          projects!inner (
            id,
            project_code,
            project_name
          )
        `)
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate),
      supabase.from('projects').select('*'),
      supabase.from('specialties').select('*'),
    ]);

    if (entriesRes.data) {
      setTimeEntries(entriesRes.data as unknown as TimeEntry[]);
    }
    if (projectsRes.data) {
      setProjects(projectsRes.data);
    }
    if (specialtiesRes.data) {
      setSpecialties(specialtiesRes.data);
    }

    setLoading(false);
  };

  // Filter entries based on selected filters
  const filteredEntries = useMemo(() => {
    return timeEntries.filter(entry => {
      if (selectedProject !== 'all' && entry.project_id !== selectedProject) {
        return false;
      }
      if (selectedSpecialty !== 'all' && entry.employees.specialty_id !== selectedSpecialty) {
        return false;
      }
      return true;
    });
  }, [timeEntries, selectedProject, selectedSpecialty]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const totalWorkMinutes = filteredEntries.reduce((sum, e) => sum + e.duration_minutes, 0);
    const totalOvertimeMinutes = filteredEntries.reduce((sum, e) => sum + e.overtime_minutes, 0);
    
    // Calculate labor cost
    let totalLaborCost = 0;
    filteredEntries.forEach(entry => {
      const regularCost = (entry.regular_minutes / 60) * entry.employees.regular_hourly_rate;
      const overtimeCost = (entry.overtime_minutes / 60) * entry.employees.overtime_hourly_rate;
      totalLaborCost += regularCost + overtimeCost;
    });

    const openProjectsCount = projects.filter(p => p.status === 'OPEN').length;

    return {
      totalWorkHours: totalWorkMinutes / 60,
      overtimeHours: totalOvertimeMinutes / 60,
      laborCost: totalLaborCost,
      openProjects: openProjectsCount,
    };
  }, [filteredEntries, projects]);

  // Labor by Project
  const laborByProject = useMemo(() => {
    const projectMap = new Map<string, LaborByProject>();
    
    filteredEntries.forEach(entry => {
      const existing = projectMap.get(entry.project_id) || {
        projectCode: entry.projects.project_code,
        projectName: entry.projects.project_name,
        totalHours: 0,
        overtimeHours: 0,
        totalLaborCost: 0,
        overtimePercentage: 0,
      };
      
      existing.totalHours += entry.duration_minutes / 60;
      existing.overtimeHours += entry.overtime_minutes / 60;
      
      const regularCost = (entry.regular_minutes / 60) * entry.employees.regular_hourly_rate;
      const overtimeCost = (entry.overtime_minutes / 60) * entry.employees.overtime_hourly_rate;
      existing.totalLaborCost += regularCost + overtimeCost;
      
      projectMap.set(entry.project_id, existing);
    });

    // Calculate overtime percentage
    projectMap.forEach((value, key) => {
      value.overtimePercentage = value.totalHours > 0 
        ? (value.overtimeHours / value.totalHours) * 100 
        : 0;
      projectMap.set(key, value);
    });

    return Array.from(projectMap.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredEntries]);

  // Labor by Specialty
  const laborBySpecialty = useMemo(() => {
    const specialtyMap = new Map<string, LaborBySpecialty>();
    
    filteredEntries.forEach(entry => {
      const specialty = specialties.find(s => s.id === entry.employees.specialty_id);
      const specialtyName = specialty 
        ? (language === 'el' ? specialty.name_el : specialty.name_en)
        : 'Unknown';
      
      const existing = specialtyMap.get(entry.employees.specialty_id) || {
        specialty: specialtyName,
        specialtyId: entry.employees.specialty_id,
        totalHours: 0,
        overtimeHours: 0,
        totalLaborCost: 0,
      };
      
      existing.totalHours += entry.duration_minutes / 60;
      existing.overtimeHours += entry.overtime_minutes / 60;
      
      const regularCost = (entry.regular_minutes / 60) * entry.employees.regular_hourly_rate;
      const overtimeCost = (entry.overtime_minutes / 60) * entry.employees.overtime_hourly_rate;
      existing.totalLaborCost += regularCost + overtimeCost;
      
      specialtyMap.set(entry.employees.specialty_id, existing);
    });

    return Array.from(specialtyMap.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredEntries, specialties, language]);

  // Alerts
  const alerts = useMemo(() => {
    const alertList: Alert[] = [];
    
    // Check for employees with more than 2 overtime hours today
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const employeeOvertimeMap = new Map<string, { name: string; overtime: number }>();
    
    timeEntries
      .filter(e => e.entry_date === todayStr)
      .forEach(entry => {
        const key = entry.employee_id;
        const existing = employeeOvertimeMap.get(key) || {
          name: `${entry.employees.first_name} ${entry.employees.last_name}`,
          overtime: 0,
        };
        existing.overtime += entry.overtime_minutes / 60;
        employeeOvertimeMap.set(key, existing);
      });

    employeeOvertimeMap.forEach((value) => {
      if (value.overtime > 2) {
        alertList.push({
          type: 'overtime_employee',
          message: language === 'el' 
            ? `${value.name}: ${value.overtime.toFixed(1)} ώρες υπερωρίας σήμερα`
            : `${value.name}: ${value.overtime.toFixed(1)} overtime hours today`,
          severity: value.overtime > 4 ? 'critical' : 'warning',
        });
      }
    });

    // Check for projects where overtime exceeds 30%
    laborByProject.forEach(project => {
      if (project.overtimePercentage > 30) {
        alertList.push({
          type: 'overtime_project',
          message: language === 'el'
            ? `${project.projectName}: ${project.overtimePercentage.toFixed(0)}% υπερωρίες`
            : `${project.projectName}: ${project.overtimePercentage.toFixed(0)}% overtime`,
          severity: project.overtimePercentage > 50 ? 'critical' : 'warning',
        });
      }
    });

    return alertList;
  }, [timeEntries, laborByProject, language]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!hasElevatedRole) {
    return <Navigate to="/dashboard" replace />;
  }

  const formatCurrency = (value: number) => `€${value.toFixed(2)}`;
  const formatHours = (value: number) => value.toFixed(1);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {language === 'el' ? 'Διοικητικός Πίνακας' : 'Admin Dashboard'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === 'el' ? 'Επισκόπηση εργασίας και κόστους' : 'Labor and cost overview'}
            </p>
          </div>
          <Link to="/admin/payroll-export">
            <Button className="btn-tablet gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {language === 'el' ? 'Εξαγωγή Μισθοδοσίας (Excel)' : 'Export Payroll (Excel)'}
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              {/* Date Range Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {language === 'el' ? 'Περίοδος' : 'Period'}
                </label>
                <Select value={dateRangeType} onValueChange={(v) => setDateRangeType(v as DateRangeType)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">{t('common.today')}</SelectItem>
                    <SelectItem value="thisWeek">{t('common.thisWeek')}</SelectItem>
                    <SelectItem value="custom">
                      {language === 'el' ? 'Προσαρμοσμένο' : 'Custom'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Date Range */}
              {dateRangeType === 'custom' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('common.from')}</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-40 justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(customDateFrom, 'dd/MM/yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customDateFrom}
                          onSelect={(date) => date && setCustomDateFrom(date)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('common.to')}</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-40 justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(customDateTo, 'dd/MM/yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customDateTo}
                          onSelect={(date) => date && setCustomDateTo(date)}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}

              {/* Project Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {language === 'el' ? 'Έργο' : 'Project'}
                </label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.project_code} - {p.project_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Specialty Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {language === 'el' ? 'Ειδικότητα' : 'Specialty'}
                </label>
                <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.all')}</SelectItem>
                    {specialties.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {language === 'el' ? s.name_el : s.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === 'el' ? 'Συνολικές Ώρες' : 'Total Work Hours'}
              </CardTitle>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? '-' : formatHours(kpis.totalWorkHours)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {dateRangeType === 'today' ? t('common.today') : 
                 dateRangeType === 'thisWeek' ? t('common.thisWeek') : 
                 `${format(dateRange.from, 'dd/MM')} - ${format(dateRange.to, 'dd/MM')}`}
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === 'el' ? 'Ώρες Υπερωρίας' : 'Overtime Hours'}
              </CardTitle>
              <Timer className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? '-' : formatHours(kpis.overtimeHours)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {kpis.totalWorkHours > 0 
                  ? `${((kpis.overtimeHours / kpis.totalWorkHours) * 100).toFixed(0)}% ${language === 'el' ? 'του συνόλου' : 'of total'}`
                  : '-'}
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === 'el' ? 'Κόστος Εργασίας' : 'Labor Cost'}
              </CardTitle>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? '-' : formatCurrency(kpis.laborCost)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {dateRangeType === 'thisWeek' 
                  ? (language === 'el' ? 'Τρέχουσα εβδομάδα' : 'Current week')
                  : dateRangeType === 'today'
                  ? t('common.today')
                  : (language === 'el' ? 'Επιλεγμένη περίοδος' : 'Selected period')}
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === 'el' ? 'Ανοιχτά Έργα' : 'Open Projects'}
              </CardTitle>
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loading ? '-' : kpis.openProjects}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'el' ? 'Ενεργά έργα' : 'Active projects'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <Card className="card-elevated border-l-4 border-l-foreground/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {language === 'el' ? 'Ειδοποιήσεις' : 'Alerts'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.map((alert, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg",
                      alert.severity === 'critical' ? 'bg-foreground/10' : 'bg-muted'
                    )}
                  >
                    {alert.type === 'overtime_employee' ? (
                      <Users className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <FolderOpen className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="text-sm">{alert.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Labor by Project */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base">
              {language === 'el' ? 'Εργασία ανά Έργο' : 'Labor by Project'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
            ) : laborByProject.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.noData')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                        {language === 'el' ? 'Κωδικός' : 'Code'}
                      </th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                        {language === 'el' ? 'Όνομα Έργου' : 'Project Name'}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {language === 'el' ? 'Συν. Ώρες' : 'Total Hours'}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {language === 'el' ? 'Υπερωρίες' : 'Overtime'}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {language === 'el' ? 'Κόστος' : 'Cost'}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {language === 'el' ? 'Υπερ. %' : 'OT %'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborByProject.map((item, index) => (
                      <tr key={index} className="border-b border-border/50 last:border-0">
                        <td className="py-3 px-2 font-mono text-sm">{item.projectCode}</td>
                        <td className="py-3 px-2">{item.projectName}</td>
                        <td className="py-3 px-2 text-right tabular-nums">{formatHours(item.totalHours)}</td>
                        <td className="py-3 px-2 text-right tabular-nums">{formatHours(item.overtimeHours)}</td>
                        <td className="py-3 px-2 text-right tabular-nums">{formatCurrency(item.totalLaborCost)}</td>
                        <td className={cn(
                          "py-3 px-2 text-right tabular-nums",
                          item.overtimePercentage > 30 && "font-semibold"
                        )}>
                          {item.overtimePercentage.toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Labor by Specialty */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base">
              {language === 'el' ? 'Εργασία ανά Ειδικότητα' : 'Labor by Specialty'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
            ) : laborBySpecialty.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.noData')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                        {language === 'el' ? 'Ειδικότητα' : 'Specialty'}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {language === 'el' ? 'Συν. Ώρες' : 'Total Hours'}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {language === 'el' ? 'Υπερωρίες' : 'Overtime'}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {language === 'el' ? 'Κόστος' : 'Cost'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborBySpecialty.map((item, index) => (
                      <tr key={index} className="border-b border-border/50 last:border-0">
                        <td className="py-3 px-2">{item.specialty}</td>
                        <td className="py-3 px-2 text-right tabular-nums">{formatHours(item.totalHours)}</td>
                        <td className="py-3 px-2 text-right tabular-nums">{formatHours(item.overtimeHours)}</td>
                        <td className="py-3 px-2 text-right tabular-nums">{formatCurrency(item.totalLaborCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
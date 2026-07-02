import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { Navigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { PayrollExportModal } from '@/components/PayrollExportModal';
import { RefreshButton } from '@/components/RefreshButton';
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
  AlertCircle,
  ArrowRight,
  CalendarIcon,
  Users,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePendingCorrections } from '@/hooks/usePendingCorrections';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { EntryReviewFlagButton } from '@/components/EntryReviewFlagButton';
import { EntryReviewFlagBell } from '@/components/EntryReviewFlagBell';
import { useEntryReviewFlags } from '@/hooks/useEntryReviewFlags';

interface TimeEntry {
  id: string;
  entry_date: string;
  regular_minutes: number;
  overtime_minutes: number;
  duration_minutes: number;
  employee_id: string;
  project_id: string;
  specialty_id: string | null;
  employees: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string | null;
    afm: string | null;
    specialty_id: string;
    regular_hourly_rate: number;
    regular_rate_all_in: number;
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
  projectId: string;
  projectCode: string;
  projectName: string;
  totalHours: number;
  overtimeHours: number;
  regularCost: number;
  allInCost: number;
  otCost: number;
  overtimePercentage: number;
  entryIds: string[];
}

interface EmployeeBreakdown {
  employeeId: string;
  employeeName: string;
  specialtyName: string;
  totalHours: number;
  overtimeHours: number;
  regularCost: number;
  allInCost: number;
  otCost: number;
  overtimePercentage: number;
  entryIds: string[];
}

interface LaborBySpecialty {
  specialty: string;
  specialtyId: string;
  totalHours: number;
  overtimeHours: number;
  regularCost: number;
  allInCost: number;
  otCost: number;
}

interface Alert {
  type: 'overtime_employee' | 'overtime_project';
  message: string;
  severity: 'warning' | 'critical';
}

type DateRangeType = 'today' | 'thisWeek' | 'custom';

export default function AdminDashboard() {
  const { t, language } = useLanguage();
  const { hasElevatedRole, isAdmin, loading: authLoading } = useAuth();
  const { pendingCount } = usePendingCorrections();
  const { hasOpenFlags, getFlagsForEntries } = useEntryReviewFlags();
  
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
  const [employeeSearch, setEmployeeSearch] = useState<string>('');
  
  // Payroll Export Modal
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  
  // Expanded project rows (for employee breakdown)
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };
  
  // Last refresh timestamp
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    const fromDate = format(dateRange.from, 'yyyy-MM-dd');
    const toDate = format(dateRange.to, 'yyyy-MM-dd');

    try {
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
            specialty_id,
            employees!inner (
              id,
              first_name,
              last_name,
              employee_code,
              afm,
              specialty_id,
              regular_hourly_rate,
              regular_rate_all_in,
              overtime_hourly_rate
            ),
            projects!inner (
              id,
              project_code,
              project_name
            )
          `)
          .eq('is_deleted', false)
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

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  // Filter entries based on selected filters
  const filteredEntries = useMemo(() => {
    return timeEntries.filter(entry => {
      if (selectedProject !== 'all' && entry.project_id !== selectedProject) {
        return false;
      }
      const entrySpecialtyId = entry.specialty_id ?? entry.employees.specialty_id;
      if (selectedSpecialty !== 'all' && entrySpecialtyId !== selectedSpecialty) {
        return false;
      }
      return true;
    });
  }, [timeEntries, selectedProject, selectedSpecialty]);

  // KPI Calculations - aligned with Reports logic
  const kpis = useMemo(() => {
    const totalRegularMinutes = filteredEntries.reduce((sum, e) => sum + e.regular_minutes, 0);
    const totalOvertimeMinutes = filteredEntries.reduce((sum, e) => sum + e.overtime_minutes, 0);
    
    // Calculate costs using same logic as Reports
    let regularCost = 0;
    let allInCost = 0;
    let otCost = 0;
    
    filteredEntries.forEach(entry => {
      const regularHours = entry.regular_minutes / 60;
      const overtimeHours = entry.overtime_minutes / 60;
      
      regularCost += regularHours * (entry.employees.regular_hourly_rate || 0);
      allInCost += regularHours * (entry.employees.regular_rate_all_in || 0);
      otCost += overtimeHours * (entry.employees.overtime_hourly_rate || 0);
    });

    const openProjectsCount = projects.filter(p => p.status === 'OPEN').length;

    return {
      regularHours: totalRegularMinutes / 60,
      overtimeHours: totalOvertimeMinutes / 60,
      totalRegular: regularCost,
      totalRegularPlusOT: regularCost + otCost,
      totalAllInPlusOT: allInCost + otCost,
      totalOT: otCost,
      openProjects: openProjectsCount,
    };
  }, [filteredEntries, projects]);

  // Labor by Project - aligned with dashboard cost logic
  const laborByProject = useMemo(() => {
    const projectMap = new Map<string, LaborByProject>();
    
    filteredEntries.forEach(entry => {
      const existing = projectMap.get(entry.project_id) || {
        projectId: entry.project_id,
        projectCode: entry.projects.project_code,
        projectName: entry.projects.project_name,
        totalHours: 0,
        overtimeHours: 0,
        regularCost: 0,
        allInCost: 0,
        otCost: 0,
        overtimePercentage: 0,
        entryIds: [] as string[],
      };
      
      const regularHours = entry.regular_minutes / 60;
      const overtimeHours = entry.overtime_minutes / 60;
      
      existing.totalHours += entry.duration_minutes / 60;
      existing.overtimeHours += overtimeHours;
      
      // Per-entry cost calculation (respecting individual employee rates)
      existing.regularCost += regularHours * (entry.employees.regular_hourly_rate || 0);
      existing.allInCost += regularHours * (entry.employees.regular_rate_all_in || 0);
      existing.otCost += overtimeHours * (entry.employees.overtime_hourly_rate || 0);
      existing.entryIds.push(entry.id);
      
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

  // Employee breakdown per project (for expandable rows)
  const employeesByProject = useMemo(() => {
    const result = new Map<string, EmployeeBreakdown[]>();

    filteredEntries.forEach(entry => {
      const projectKey = entry.project_id;
      const employeeKey = entry.employee_id;
      const list = result.get(projectKey) || [];

      let row = list.find(r => r.employeeId === employeeKey);
      if (!row) {
        const entrySpecialtyId = entry.specialty_id ?? entry.employees.specialty_id;
        const specialty = specialties.find(s => s.id === entrySpecialtyId);
        const specialtyName = specialty
          ? (language === 'el' ? specialty.name_el : specialty.name_en)
          : (language === 'el' ? 'Άγνωστη' : 'Unknown');
        row = {
          employeeId: employeeKey,
          employeeName: `${entry.employees.first_name} ${entry.employees.last_name}`,
          specialtyName,
          totalHours: 0,
          overtimeHours: 0,
          regularCost: 0,
          allInCost: 0,
          otCost: 0,
          overtimePercentage: 0,
          entryIds: [],
        };
        list.push(row);
      }

      const regularHours = entry.regular_minutes / 60;
      const overtimeHours = entry.overtime_minutes / 60;

      row.totalHours += entry.duration_minutes / 60;
      row.overtimeHours += overtimeHours;
      row.regularCost += regularHours * (entry.employees.regular_hourly_rate || 0);
      row.allInCost += regularHours * (entry.employees.regular_rate_all_in || 0);
      row.otCost += overtimeHours * (entry.employees.overtime_hourly_rate || 0);
      row.entryIds.push(entry.id);

      result.set(projectKey, list);
    });

    // Compute OT% and sort
    result.forEach((list, key) => {
      list.forEach(r => {
        r.overtimePercentage = r.totalHours > 0 ? (r.overtimeHours / r.totalHours) * 100 : 0;
      });
      list.sort((a, b) => b.totalHours - a.totalHours);
      result.set(key, list);
    });

    return result;
  }, [filteredEntries, specialties, language]);


  // Labor by Specialty - aligned with dashboard cost logic
  const laborBySpecialty = useMemo(() => {
    const specialtyMap = new Map<string, LaborBySpecialty>();
    
    filteredEntries.forEach(entry => {
      const entrySpecialtyId = entry.specialty_id ?? entry.employees.specialty_id;
      const specialty = specialties.find(s => s.id === entrySpecialtyId);
      const specialtyName = specialty 
        ? (language === 'el' ? specialty.name_el : specialty.name_en)
        : 'Unknown';
      
      const existing = specialtyMap.get(entrySpecialtyId) || {
        specialty: specialtyName,
        specialtyId: entrySpecialtyId,
        totalHours: 0,
        overtimeHours: 0,
        regularCost: 0,
        allInCost: 0,
        otCost: 0,
      };
      
      const regularHours = entry.regular_minutes / 60;
      const overtimeHours = entry.overtime_minutes / 60;
      
      existing.totalHours += entry.duration_minutes / 60;
      existing.overtimeHours += overtimeHours;
      
      // Per-entry cost calculation (respecting individual employee rates)
      existing.regularCost += regularHours * (entry.employees.regular_hourly_rate || 0);
      existing.allInCost += regularHours * (entry.employees.regular_rate_all_in || 0);
      existing.otCost += overtimeHours * (entry.employees.overtime_hourly_rate || 0);
      
      specialtyMap.set(entrySpecialtyId, existing);
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
              {isAdmin
                ? (language === 'el' ? 'Διοικητικός Πίνακας' : 'Admin Dashboard')
                : (language === 'el' ? 'Πίνακας HR' : 'HR Dashboard')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === 'el' ? 'Επισκόπηση εργασίας και κόστους' : 'Labor and cost overview'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <EntryReviewFlagBell />
            <RefreshButton onRefresh={fetchData} lastRefresh={lastRefresh} />
            <Button className="btn-tablet gap-2" onClick={() => setPayrollModalOpen(true)}>
              <FileSpreadsheet className="h-5 w-5" />
              {language === 'el' ? 'Εξαγωγή Μισθοδοσίας (Excel)' : 'Export Payroll (Excel)'}
            </Button>
          </div>
        </div>

        {/* Payroll Export Modal */}
        <PayrollExportModal open={payrollModalOpen} onOpenChange={setPayrollModalOpen} />

        {/* Pending Corrections Alert */}
        {pendingCount > 0 && (
          <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-200">
                      {language === 'el' ? 'Εκκρεμείς Ενέργειες' : 'Pending Actions'}
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      {language === 'el'
                        ? `${pendingCount} αίτημα${pendingCount > 1 ? 'τα' : ''} διόρθωσης περιμένε${pendingCount > 1 ? 'ουν' : 'ι'} έγκριση`
                        : `${pendingCount} correction request${pendingCount > 1 ? 's' : ''} awaiting approval`}
                    </p>
                  </div>
                </div>
                <Link to="/corrections">
                  <Button variant="outline" size="sm" className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-900/40">
                    {language === 'el' ? 'Προβολή Αιτημάτων' : 'View Requests'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('reports.regularHours')}
              </CardTitle>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '-' : formatHours(kpis.regularHours)}
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('reports.overtimeHours')}
              </CardTitle>
              <Timer className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '-' : formatHours(kpis.overtimeHours)}
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === 'el' ? 'Σύνολο (Κανονικά)' : 'Total (Regular)'}
              </CardTitle>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '-' : formatCurrency(kpis.totalRegular)}
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('reports.totalRegularPlusOT')}
              </CardTitle>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '-' : formatCurrency(kpis.totalRegularPlusOT)}
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('reports.totalAllInPlusOT')}
              </CardTitle>
              <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '-' : formatCurrency(kpis.totalAllInPlusOT)}
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('reports.totalOT')}
              </CardTitle>
              <DollarSign className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '-' : formatCurrency(kpis.totalOT)}
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('dashboard.openProjects')}
              </CardTitle>
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '-' : kpis.openProjects}
              </div>
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
                      <th className="w-8 py-3 px-1"></th>
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
                        {language === 'el' ? 'Σύνολο (Κανονικά)' : 'Total (Regular)'}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {t('reports.totalRegularPlusOT')}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {t('reports.totalAllInPlusOT')}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {t('reports.totalOT')}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {language === 'el' ? 'Υπερ. %' : 'OT %'}
                      </th>
                      <th className="w-12 py-3 px-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborByProject.map((item) => {
                      const isExpanded = expandedProjects.has(item.projectId);
                      const employees = employeesByProject.get(item.projectId) ?? [];
                      const projectHasFlags = hasOpenFlags(item.entryIds);
                      return (
                        <Fragment key={item.projectId}>
                          <tr
                            key={item.projectId}
                            className={cn(
                              "border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors",
                              isExpanded && "bg-muted/20"
                            )}
                            onClick={() => toggleProject(item.projectId)}
                          >
                            <td className="py-3 px-1 text-center">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 inline text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 inline text-muted-foreground" />
                              )}
                            </td>
                            <td className="py-3 px-2 font-mono text-sm">{item.projectCode}</td>
                            <td className="py-3 px-2">
                              <span className="inline-flex items-center gap-2">
                                {item.projectName}
                                {projectHasFlags && (
                                  <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-300">
                                    ⚠ {language === 'el' ? 'Υπό επανέλεγχο' : 'Under review'}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right tabular-nums">{formatHours(item.totalHours)}</td>
                            <td className="py-3 px-2 text-right tabular-nums">{formatHours(item.overtimeHours)}</td>
                            <td className="py-3 px-2 text-right tabular-nums">{formatCurrency(item.regularCost)}</td>
                            <td className="py-3 px-2 text-right tabular-nums">{formatCurrency(item.regularCost + item.otCost)}</td>
                            <td className="py-3 px-2 text-right tabular-nums text-primary font-medium">{formatCurrency(item.allInCost + item.otCost)}</td>
                            <td className="py-3 px-2 text-right tabular-nums">{formatCurrency(item.otCost)}</td>
                            <td className={cn(
                              "py-3 px-2 text-right tabular-nums",
                              item.overtimePercentage > 30 && "font-semibold"
                            )}>
                              {item.overtimePercentage.toFixed(0)}%
                            </td>
                            <td className="py-3 px-1"></td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${item.projectId}-exp`} className="border-b border-border/50 bg-muted/10">
                              <td colSpan={11} className="p-0">
                                <div className="px-4 py-3">
                                  <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                                    {language === 'el' ? 'Εργαζόμενοι' : 'Employees'} ({employees.length})
                                  </div>
                                  {employees.length === 0 ? (
                                    <div className="text-sm text-muted-foreground py-3 text-center">
                                      {t('common.noData')}
                                    </div>
                                  ) : (
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-border/60">
                                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">
                                            {language === 'el' ? 'Εργαζόμενος' : 'Employee'}
                                          </th>
                                          <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">
                                            {language === 'el' ? 'Ειδικότητα' : 'Specialty'}
                                          </th>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">
                                            {language === 'el' ? 'Συν. Ώρες' : 'Total Hours'}
                                          </th>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">
                                            {language === 'el' ? 'Υπερωρίες' : 'Overtime'}
                                          </th>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">
                                            {language === 'el' ? 'Σύνολο (Κανονικά)' : 'Total (Regular)'}
                                          </th>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">
                                            {t('reports.totalRegularPlusOT')}
                                          </th>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">
                                            {t('reports.totalAllInPlusOT')}
                                          </th>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">
                                            {t('reports.totalOT')}
                                          </th>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">
                                            {language === 'el' ? 'Υπερ. %' : 'OT %'}
                                          </th>
                                          <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground w-32">
                                            {language === 'el' ? 'Ενέργειες' : 'Actions'}
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {employees.map((emp) => {
                                          const empFlags = getFlagsForEntries(emp.entryIds);
                                          return (
                                            <tr
                                              key={emp.employeeId}
                                              className={cn(
                                                "border-b border-border/30 last:border-0 hover:bg-background/60",
                                                empFlags.length > 0 && "bg-orange-50/40"
                                              )}
                                            >
                                              <td className="py-2 px-2">
                                                <span className="inline-flex items-center gap-1.5">
                                                  {emp.employeeName}
                                                  {empFlags.length > 0 && (
                                                    <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-300">
                                                      ⚠ {empFlags.length}
                                                    </span>
                                                  )}
                                                </span>
                                              </td>
                                              <td className="py-2 px-2 text-muted-foreground">{emp.specialtyName}</td>
                                              <td className="py-2 px-2 text-right tabular-nums">{formatHours(emp.totalHours)}</td>
                                              <td className="py-2 px-2 text-right tabular-nums">{formatHours(emp.overtimeHours)}</td>
                                              <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(emp.regularCost)}</td>
                                              <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(emp.regularCost + emp.otCost)}</td>
                                              <td className="py-2 px-2 text-right tabular-nums text-primary font-medium">{formatCurrency(emp.allInCost + emp.otCost)}</td>
                                              <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(emp.otCost)}</td>
                                              <td className={cn(
                                                "py-2 px-2 text-right tabular-nums",
                                                emp.overtimePercentage > 30 && "font-semibold"
                                              )}>
                                                {emp.overtimePercentage.toFixed(0)}%
                                              </td>
                                              <td className="py-2 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                <EntryReviewFlagButton
                                                  timeEntryIds={emp.entryIds}
                                                  contextLabel={`${emp.employeeName} — ${item.projectName}`}
                                                />
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
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
                        {language === 'el' ? 'Σύνολο (Κανονικά)' : 'Total (Regular)'}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {t('reports.totalRegularPlusOT')}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {t('reports.totalAllInPlusOT')}
                      </th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">
                        {t('reports.totalOT')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborBySpecialty.map((item, index) => (
                      <tr key={index} className="border-b border-border/50 last:border-0">
                        <td className="py-3 px-2">{item.specialty}</td>
                        <td className="py-3 px-2 text-right tabular-nums">{formatHours(item.totalHours)}</td>
                        <td className="py-3 px-2 text-right tabular-nums">{formatHours(item.overtimeHours)}</td>
                        <td className="py-3 px-2 text-right tabular-nums">{formatCurrency(item.regularCost)}</td>
                        <td className="py-3 px-2 text-right tabular-nums">{formatCurrency(item.regularCost + item.otCost)}</td>
                        <td className="py-3 px-2 text-right tabular-nums text-primary font-medium">{formatCurrency(item.allInCost + item.otCost)}</td>
                        <td className="py-3 px-2 text-right tabular-nums">{formatCurrency(item.otCost)}</td>
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
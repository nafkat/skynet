import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
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
import { DatePicker } from '@/components/ui/date-picker';
import { FileBarChart, Download, Clock, DollarSign } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  regular_hourly_rate: number;
  regular_rate_all_in: number;
  overtime_hourly_rate: number;
  employment_type?: string;
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
}

interface Specialty {
  id: string;
  name_en: string;
  name_el: string;
  code: string;
}

interface ReportData {
  totalRegularMinutes: number;
  totalOvertimeMinutes: number;
  totalRegularPay: number;
  totalRegularAllInPay: number;
  totalOvertimePay: number;
  byEmployee: {
    employee: Employee;
    regularMinutes: number;
    overtimeMinutes: number;
    regularPay: number;
    regularAllInPay: number;
    overtimePay: number;
  }[];
  byProject: {
    project: Project;
    regularMinutes: number;
    overtimeMinutes: number;
    laborCost: number;
    laborCostAllIn: number;
  }[];
}

export default function Reports() {
  const { t, language } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  // Filter state
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');

  useEffect(() => {
    fetchFilterData();
  }, []);

  const fetchFilterData = async () => {
    try {
      const [employeesRes, projectsRes, specialtiesRes] = await Promise.all([
        supabase.from('employees').select('id, employee_code, first_name, last_name, regular_hourly_rate, regular_rate_all_in, overtime_hourly_rate, employment_type').order('employee_code'),
        supabase.from('projects').select('id, project_code, project_name').order('project_code'),
        supabase.from('specialties').select('*').order('code'),
      ]);

      setEmployees((employeesRes.data as Employee[]) || []);
      setProjects((projectsRes.data as Project[]) || []);
      setSpecialties((specialtiesRes.data as Specialty[]) || []);
    } catch (error) {
      console.error('Error fetching filter data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setGenerating(true);

    try {
      let query = supabase
        .from('time_entries')
        .select(`
          *,
          employees (id, employee_code, first_name, last_name, specialty_id, employment_type, regular_hourly_rate, overtime_hourly_rate),
          projects (id, project_code, project_name)
        `)
        .eq('is_deleted', false)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee);
      }

      if (selectedProject !== 'all') {
        query = query.eq('project_id', selectedProject);
      }

      const { data: entries, error } = await query;

      if (error) throw error;

      // Filter by specialty if needed
      let filteredEntries = entries || [];
      if (selectedSpecialty !== 'all') {
        filteredEntries = filteredEntries.filter(
          (entry: any) => (entry.specialty_id ?? entry.employees?.specialty_id) === selectedSpecialty
        );
      }

      // Calculate totals
      let totalRegularMinutes = 0;
      let totalOvertimeMinutes = 0;
      let totalRegularPay = 0;
      let totalRegularAllInPay = 0;
      let totalOvertimePay = 0;

      const employeeMap = new Map<string, any>();
      const projectMap = new Map<string, any>();

      filteredEntries.forEach((entry: any) => {
        const emp = entry.employees;
        const proj = entry.projects;

        totalRegularMinutes += entry.regular_minutes;
        totalOvertimeMinutes += entry.overtime_minutes;

        const regularPay = (entry.regular_minutes / 60) * (emp?.regular_hourly_rate || 0);
        const regularAllInPay = (entry.regular_minutes / 60) * (emp?.regular_rate_all_in || 0);
        const overtimePay = (entry.overtime_minutes / 60) * (emp?.overtime_hourly_rate || 0);

        totalRegularPay += regularPay;
        totalRegularAllInPay += regularAllInPay;
        totalOvertimePay += overtimePay;

        // Aggregate by employee
        if (emp) {
          const existing = employeeMap.get(emp.id) || {
            employee: emp,
            regularMinutes: 0,
            overtimeMinutes: 0,
            regularPay: 0,
            regularAllInPay: 0,
            overtimePay: 0,
          };
          existing.regularMinutes += entry.regular_minutes;
          existing.overtimeMinutes += entry.overtime_minutes;
          existing.regularPay += regularPay;
          existing.regularAllInPay += regularAllInPay;
          existing.overtimePay += overtimePay;
          employeeMap.set(emp.id, existing);
        }

        // Aggregate by project
        if (proj) {
          const existing = projectMap.get(proj.id) || {
            project: proj,
            regularMinutes: 0,
            overtimeMinutes: 0,
            laborCost: 0,
            laborCostAllIn: 0,
          };
          existing.regularMinutes += entry.regular_minutes;
          existing.overtimeMinutes += entry.overtime_minutes;
          existing.laborCost += regularPay + overtimePay;
          existing.laborCostAllIn += regularAllInPay + overtimePay;
          projectMap.set(proj.id, existing);
        }
      });

      setReportData({
        totalRegularMinutes,
        totalOvertimeMinutes,
        totalRegularPay,
        totalRegularAllInPay,
        totalOvertimePay,
        byEmployee: Array.from(employeeMap.values()),
        byProject: Array.from(projectMap.values()),
      });
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const exportCSV = () => {
    if (!reportData) return;

    const headers = ['Employee', 'Regular Hours', 'Overtime Hours', 'Regular Pay', 'Overtime Pay', 'Total Pay'];
    const rows = reportData.byEmployee.map(row => [
      `${row.employee.first_name} ${row.employee.last_name}`,
      formatHours(row.regularMinutes),
      formatHours(row.overtimeMinutes),
      row.regularPay.toFixed(2),
      row.overtimePay.toFixed(2),
      (row.regularPay + row.overtimePay).toFixed(2),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${startDate}_${endDate}.csv`;
    a.click();
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
        <h1 className="page-title">{t('reports.title')}</h1>
        <p className="page-subtitle">{t('reports.dateRange')}</p>
      </div>

      {/* Filters */}
      <div className="card-elevated p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label>{t('common.from')}</Label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder={t('common.from')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('common.to')}</Label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder={t('common.to')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('employees.title')}</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="input-tablet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('projects.title')}</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="input-tablet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {projects.map((proj) => (
                  <SelectItem key={proj.id} value={proj.id}>
                    {proj.project_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('specialties.title')}</Label>
            <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
              <SelectTrigger className="input-tablet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {specialties.map((spec) => (
                  <SelectItem key={spec.id} value={spec.id}>
                    {language === 'el' ? spec.name_el : spec.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <Button onClick={generateReport} disabled={generating} className="btn-tablet">
            <FileBarChart className="h-5 w-5 mr-2" />
            {generating ? t('common.loading') : t('reports.generate')}
          </Button>
          {reportData && (
            <Button variant="outline" onClick={exportCSV} className="btn-tablet">
              <Download className="h-5 w-5 mr-2" />
              {t('reports.exportCSV')}
            </Button>
          )}
        </div>
      </div>

      {/* Report Results */}
      {reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="stat-label">{t('reports.regularHours')}</span>
              </div>
              <span className="stat-value">{formatHours(reportData.totalRegularMinutes)}</span>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-warning" />
                <span className="stat-label">{t('reports.overtimeHours')}</span>
              </div>
              <span className="stat-value">{formatHours(reportData.totalOvertimeMinutes)}</span>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <span className="stat-label">{t('reports.totalRegularPlusOT')}</span>
              </div>
              <span className="stat-value">{formatCurrency(reportData.totalRegularPay + reportData.totalOvertimePay)}</span>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="stat-label">{t('reports.totalAllInPlusOT')}</span>
              </div>
              <span className="stat-value">{formatCurrency(reportData.totalRegularAllInPay + reportData.totalOvertimePay)}</span>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-warning" />
                <span className="stat-label">{t('reports.totalOT')}</span>
              </div>
              <span className="stat-value">{formatCurrency(reportData.totalOvertimePay)}</span>
            </div>
          </div>

          {/* By Employee Table */}
          <div className="card-elevated overflow-hidden mb-8">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">{t('employees.title')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="table-cell text-left">{t('employees.title')}</th>
                    <th className="table-cell text-right">{t('reports.regularHours')}</th>
                    <th className="table-cell text-right">{t('reports.overtimeHours')}</th>
                    <th className="table-cell text-right">{t('reports.totalRegularPlusOT')}</th>
                    <th className="table-cell text-right">{t('reports.totalAllInPlusOT')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.byEmployee.map((row) => (
                    <tr key={row.employee.id} className="table-row">
                      <td className="table-cell">
                        <div>
                          <p className="font-medium">{row.employee.first_name} {row.employee.last_name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{row.employee.employee_code}</p>
                        </div>
                      </td>
                      <td className="table-cell text-right font-mono">{formatHours(row.regularMinutes)}</td>
                      <td className="table-cell text-right font-mono text-warning">{formatHours(row.overtimeMinutes)}</td>
                      <td className="table-cell text-right font-medium">{formatCurrency(row.regularPay + row.overtimePay)}</td>
                      <td className="table-cell text-right font-medium text-primary">{formatCurrency(row.regularAllInPay + row.overtimePay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Project Table */}
          <div className="card-elevated overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">{t('projects.title')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="table-cell text-left">{t('projects.title')}</th>
                    <th className="table-cell text-right">{t('reports.regularHours')}</th>
                    <th className="table-cell text-right">{t('reports.overtimeHours')}</th>
                    <th className="table-cell text-right">{t('reports.totalRegularPlusOT')}</th>
                    <th className="table-cell text-right">{t('reports.totalAllInPlusOT')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.byProject.map((row) => (
                    <tr key={row.project.id} className="table-row">
                      <td className="table-cell">
                        <div>
                          <p className="font-medium">{row.project.project_name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{row.project.project_code}</p>
                        </div>
                      </td>
                      <td className="table-cell text-right font-mono">{formatHours(row.regularMinutes)}</td>
                      <td className="table-cell text-right font-mono text-warning">{formatHours(row.overtimeMinutes)}</td>
                      <td className="table-cell text-right font-medium">{formatCurrency(row.laborCost)}</td>
                      <td className="table-cell text-right font-medium text-primary">{formatCurrency(row.laborCostAllIn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}

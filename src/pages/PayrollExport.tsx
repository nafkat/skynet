import { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  CalendarIcon, 
  Download, 
  FileSpreadsheet,
  Users,
  Clock,
  Timer,
  DollarSign
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface TimeEntry {
  id: string;
  entry_date: string;
  regular_minutes: number;
  overtime_minutes: number;
  employee_id: string;
  project_id: string;
}

interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  specialty_id: string;
  regular_hourly_rate: number;
  regular_rate_all_in: number;
  overtime_hourly_rate: number;
  regular_start_time: string;
  regular_end_time: string;
  afm: string | null;
  iban: string | null;
  bank_name: string | null;
  employment_type?: string;
}

interface Specialty {
  id: string;
  code: string;
  name_en: string;
  name_el: string;
}

interface Project {
  id: string;
  project_code: string;
  project_name: string;
}

interface PayrollRow {
  employee_code: string;
  first_name: string;
  last_name: string;
  specialty: string;
  employment_type: string;
  afm: string;
  iban: string;
  bank_name: string;
  regular_hours: number;
  overtime_hours: number;
  regular_hourly_rate: number;
  regular_rate_all_in: number;
  overtime_hourly_rate: number;
  regular_amount: number;
  regular_all_in_amount: number;
  overtime_amount: number;
  total_amount: number;
  total_all_in_ot: number;
  project_code?: string;
  project_name?: string;
}

interface PreviewSummary {
  employeeCount: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalAmount: number;
}

export default function PayrollExport() {
  const { language } = useLanguage();
  const { hasElevatedRole, loading: authLoading } = useAuth();

  // Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');

  // Fetch static data on mount
  useEffect(() => {
    if (hasElevatedRole) {
      fetchStaticData();
    }
  }, [hasElevatedRole]);

  // Fetch time entries when date range changes
  useEffect(() => {
    if (hasElevatedRole && dateFrom && dateTo) {
      fetchTimeEntries();
    }
  }, [hasElevatedRole, dateFrom, dateTo]);

  const fetchStaticData = async () => {
    const [employeesRes, specialtiesRes, projectsRes] = await Promise.all([
      supabase.from('employees').select('*').eq('status', 'active'),
      supabase.from('specialties').select('*'),
      supabase.from('projects').select('*').eq('status', 'OPEN'),
    ]);

    if (employeesRes.data) setEmployees(employeesRes.data);
    if (specialtiesRes.data) setSpecialties(specialtiesRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    setLoading(false);
  };

  const fetchTimeEntries = async () => {
    const fromDate = format(dateFrom, 'yyyy-MM-dd');
    const toDate = format(dateTo, 'yyyy-MM-dd');

    const { data } = await supabase
      .from('time_entries')
      .select('id, entry_date, regular_minutes, overtime_minutes, employee_id, project_id')
      .eq('is_deleted', false)
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate);

    if (data) setTimeEntries(data);
  };

  // Get selected project details
  const selectedProjectDetails = useMemo(() => {
    if (selectedProject === 'all') return null;
    return projects.find(p => p.id === selectedProject) || null;
  }, [selectedProject, projects]);

  // Calculate payroll data
  const payrollData = useMemo(() => {
    const employeeMap = new Map<string, {
      employee: Employee;
      specialty: Specialty | undefined;
      regular_minutes: number;
      overtime_minutes: number;
    }>();

    // Filter entries by project/specialty
    const filteredEntries = timeEntries.filter(entry => {
      if (selectedProject !== 'all' && entry.project_id !== selectedProject) {
        return false;
      }
      const employee = employees.find(e => e.id === entry.employee_id);
      if (selectedSpecialty !== 'all' && employee?.specialty_id !== selectedSpecialty) {
        return false;
      }
      return true;
    });

    // Group by employee
    filteredEntries.forEach(entry => {
      const employee = employees.find(e => e.id === entry.employee_id);
      if (!employee) return;

      const specialty = specialties.find(s => s.id === employee.specialty_id);
      const existing = employeeMap.get(employee.id);

      if (existing) {
        existing.regular_minutes += entry.regular_minutes;
        existing.overtime_minutes += entry.overtime_minutes;
      } else {
        employeeMap.set(employee.id, {
          employee,
          specialty,
          regular_minutes: entry.regular_minutes,
          overtime_minutes: entry.overtime_minutes,
        });
      }
    });

    // Calculate derived fields
    const rows: PayrollRow[] = [];
    employeeMap.forEach(data => {
      const { employee, specialty, regular_minutes, overtime_minutes } = data;
      
      const regular_hours = Math.round((regular_minutes / 60) * 100) / 100;
      const overtime_hours = Math.round((overtime_minutes / 60) * 100) / 100;
      const regular_amount = Math.round(regular_hours * employee.regular_hourly_rate * 100) / 100;
      const regular_all_in_amount = Math.round(regular_hours * (employee.regular_rate_all_in || 0) * 100) / 100;
      const overtime_amount = Math.round(overtime_hours * employee.overtime_hourly_rate * 100) / 100;
      const total_amount = Math.round((regular_amount + overtime_amount) * 100) / 100;
      const total_all_in_ot = Math.round((regular_all_in_amount + overtime_amount) * 100) / 100;

      const row: PayrollRow = {
        employee_code: employee.employee_code,
        first_name: employee.first_name,
        last_name: employee.last_name,
        specialty: specialty ? (language === 'el' ? specialty.name_el : specialty.name_en) : '',
        employment_type: employee.employment_type || 'permanent',
        afm: employee.afm || '',
        iban: employee.iban || '',
        bank_name: employee.bank_name || '',
        regular_hours,
        overtime_hours,
        regular_hourly_rate: employee.regular_hourly_rate,
        regular_rate_all_in: employee.regular_rate_all_in || 0,
        overtime_hourly_rate: employee.overtime_hourly_rate,
        regular_amount,
        regular_all_in_amount,
        overtime_amount,
        total_amount,
        total_all_in_ot,
      };

      // Add project info if filtered by project
      if (selectedProjectDetails) {
        row.project_code = selectedProjectDetails.project_code;
        row.project_name = selectedProjectDetails.project_name;
      }

      rows.push(row);
    });

    // Sort by employee code
    rows.sort((a, b) => a.employee_code.localeCompare(b.employee_code));

    return rows;
  }, [timeEntries, employees, specialties, selectedProject, selectedSpecialty, selectedProjectDetails, language]);

  // Preview summary
  const previewSummary = useMemo((): PreviewSummary => {
    return {
      employeeCount: payrollData.length,
      totalRegularHours: payrollData.reduce((sum, r) => sum + r.regular_hours, 0),
      totalOvertimeHours: payrollData.reduce((sum, r) => sum + r.overtime_hours, 0),
      totalAmount: payrollData.reduce((sum, r) => sum + r.total_amount, 0),
    };
  }, [payrollData]);

  const handleExport = () => {
    if (payrollData.length === 0) {
      toast.error(language === 'el' ? 'Δεν υπάρχουν δεδομένα για εξαγωγή' : 'No data to export');
      return;
    }

    setExporting(true);

    try {
      // Prepare worksheet data with all required fields
      const wsData = payrollData.map(row => {
        const baseData: Record<string, string | number> = {
          'Employee Code': row.employee_code,
          'First Name': row.first_name,
          'Last Name': row.last_name,
          'Specialty': row.specialty,
          'Type': row.employment_type === 'permanent'
            ? 'Μόνιμος / Permanent'
            : 'Έκτακτος / Temporary',
          'Regular Hours': row.regular_hours,
          'Overtime Hours': row.overtime_hours,
          'Regular Rate (€/hr)': row.regular_hourly_rate,
          'Regular All-in Rate (€/hr)': row.regular_rate_all_in,
          'Overtime Rate (€/hr)': row.overtime_hourly_rate,
          'Regular Cost (€)': row.regular_amount,
          'Regular All-in Cost (€)': row.regular_all_in_amount,
          'Overtime Cost (€)': row.overtime_amount,
          'Total (Regular + OT) (€)': row.total_amount,
          'Total (All-in + OT) (€)': row.total_all_in_ot,
          'AFM': row.afm,
          'IBAN': row.iban,
          'Bank Name': row.bank_name,
        };

        // Add project columns if filtered
        if (row.project_code) {
          baseData['Project Code'] = row.project_code;
          baseData['Project Name'] = row.project_name || '';
        }

        return baseData;
      });

      // Build header row
      const headers = [
        'Employee Code', 'First Name', 'Last Name', 'Specialty', 'Type',
        'Regular Hours', 'Overtime Hours',
        'Regular Rate (€/hr)', 'Overtime Rate (€/hr)',
        'Regular Cost (€)', 'Overtime Cost (€)',
        'Total (Regular + OT) (€)',
        'AFM', 'IBAN', 'Bank Name',
      ];
      if (selectedProjectDetails) {
        headers.push('Project Code', 'Project Name');
      }

      // Build data rows from wsData
      const dataRows = wsData.map(row => headers.map(h => (row as Record<string, string | number>)[h] ?? ''));

      // Calculate totals for numeric columns
      const totalRegularHours   = Math.round(payrollData.reduce((s, r) => s + r.regular_hours, 0) * 100) / 100;
      const totalOvertimeHours  = Math.round(payrollData.reduce((s, r) => s + r.overtime_hours, 0) * 100) / 100;
      const totalRegularAmt     = Math.round(payrollData.reduce((s, r) => s + r.regular_amount, 0) * 100) / 100;
      const totalOvertimeAmt    = Math.round(payrollData.reduce((s, r) => s + r.overtime_amount, 0) * 100) / 100;
      const totalAllInAmt       = Math.round(payrollData.reduce((s, r) => s + ((r as unknown as Record<string, number>).all_in_amount || 0), 0) * 100) / 100;
      const grandTotal          = Math.round(payrollData.reduce((s, r) => s + r.total_amount, 0) * 100) / 100;
      const grandTotalAllIn     = Math.round(payrollData.reduce((s, r) => s + ((r as unknown as Record<string, number>).total_all_in_amount || 0), 0) * 100) / 100;

      // Empty separator row
      const emptyRow = headers.map(() => '');

      // Totals row — label in first cell, numbers in correct positions
      const totalsRow: (string | number)[] = headers.map((h) => {
        if (h === 'Employee Code') return 'ΣΥΝΟΛΟ / TOTAL';
        if (h === 'Regular Hours') return totalRegularHours;
        if (h === 'Overtime Hours') return totalOvertimeHours;
        if (h === 'Regular Cost (€)') return totalRegularAmt;
        if (h === 'Overtime Cost (€)') return totalOvertimeAmt;
        if (h === 'Total (Regular + OT) (€)') return grandTotal;
        return '';
      });

      // Assemble all rows: header + data + empty + totals
      const allRows = [headers, ...dataRows, emptyRow, totalsRow];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(allRows);

      // Set column widths
      const baseCols = [
        { wch: 14 }, // Employee Code
        { wch: 14 }, // First Name
        { wch: 16 }, // Last Name
        { wch: 20 }, // Specialty
        { wch: 14 }, // Regular Hours
        { wch: 14 }, // Overtime Hours
        { wch: 18 }, // Regular Rate
        { wch: 18 }, // Overtime Rate
        { wch: 16 }, // Regular Cost
        { wch: 16 }, // Overtime Cost
        { wch: 20 }, // Total (Regular + OT)
        { wch: 14 }, // AFM
        { wch: 28 }, // IBAN
        { wch: 16 }, // Bank Name
      ];

      // Add project columns if filtered
      if (selectedProjectDetails) {
        baseCols.push({ wch: 14 }); // Project Code
        baseCols.push({ wch: 24 }); // Project Name
      }

      ws['!cols'] = baseCols;

      XLSX.utils.book_append_sheet(wb, ws, 'Payroll');

      // Generate filename: SKYNET_payroll_YYYYMMDD_YYYYMMDD.xlsx
      const fromStr = format(dateFrom, 'yyyyMMdd');
      const toStr = format(dateTo, 'yyyyMMdd');
      const filename = `SKYNET_payroll_${fromStr}_${toStr}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);

      toast.success(
        language === 'el' 
          ? `Εξαγωγή ολοκληρώθηκε: ${filename}` 
          : `Export complete: ${filename}`
      );
    } catch (error) {
      console.error('Export error:', error);
      toast.error(language === 'el' ? 'Σφάλμα κατά την εξαγωγή' : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">
          {language === 'el' ? 'Φόρτωση...' : 'Loading...'}
        </div>
      </div>
    );
  }

  if (!hasElevatedRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="h-7 w-7" />
            {language === 'el' ? 'Εξαγωγή Μισθοδοσίας' : 'Payroll Export'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === 'el' 
              ? 'Εξαγωγή δεδομένων μισθοδοσίας σε Excel' 
              : 'Export payroll data to Excel'}
          </p>
        </div>

        {/* Filters */}
        <Card className="card-elevated">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              {language === 'el' ? 'Φίλτρα Εξαγωγής' : 'Export Filters'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'el' ? 'Από Ημερομηνία' : 'From Date'} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateFrom, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => date && setDateFrom(date)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{language === 'el' ? 'Έως Ημερομηνία' : 'To Date'} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateTo, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => date && setDateTo(date)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Optional Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'el' ? 'Έργο (προαιρετικό)' : 'Project (optional)'}</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {language === 'el' ? 'Όλα τα έργα' : 'All projects'}
                    </SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.project_code} - {p.project_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === 'el' ? 'Ειδικότητα (προαιρετικό)' : 'Specialty (optional)'}</Label>
                <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {language === 'el' ? 'Όλες οι ειδικότητες' : 'All specialties'}
                    </SelectItem>
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

        {/* Preview Summary */}
        <Card className="card-elevated">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              {language === 'el' ? 'Προεπισκόπηση' : 'Preview Summary'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">
                {language === 'el' ? 'Φόρτωση...' : 'Loading...'}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{previewSummary.employeeCount}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'el' ? 'Εργαζόμενοι' : 'Employees'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{previewSummary.totalRegularHours.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'el' ? 'Κανονικές Ώρες' : 'Regular Hours'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                  <Timer className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{previewSummary.totalOvertimeHours.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'el' ? 'Υπερωρίες' : 'Overtime Hours'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">€{previewSummary.totalAmount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'el' ? 'Συνολικό Ποσό' : 'Total Amount'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Info */}
        <Card className="card-elevated">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              {language === 'el' ? 'Πεδία Εξαγωγής' : 'Export Fields'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {language === 'el' 
                  ? 'Το αρχείο Excel θα περιέχει τα εξής πεδία:' 
                  : 'The Excel file will include the following fields:'}
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{language === 'el' ? 'Κωδικός Εργαζομένου, Όνομα, Επώνυμο, Ειδικότητα' : 'Employee Code, First Name, Last Name, Specialty'}</li>
                <li>{language === 'el' ? 'ΑΦΜ, IBAN, Τράπεζα' : 'AFM (Tax Number), IBAN, Bank Name'}</li>
                <li>{language === 'el' ? 'Κανονικές Ώρες, Υπερωρίες' : 'Regular Hours, Overtime Hours'}</li>
                <li>{language === 'el' ? 'Ωριαία Αμοιβή (Κανονική & Υπερωρίας)' : 'Hourly Rate (Regular & Overtime)'}</li>
                <li>{language === 'el' ? 'Ποσά (Κανονικό, Υπερωρίας, Σύνολο)' : 'Amounts (Regular, Overtime, Total)'}</li>
                {selectedProjectDetails && (
                  <li className="text-primary">
                    {language === 'el' 
                      ? `Κωδικός & Όνομα Έργου (φιλτραρισμένο: ${selectedProjectDetails.project_code})` 
                      : `Project Code & Name (filtered: ${selectedProjectDetails.project_code})`}
                  </li>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Export Button */}
        <div className="flex justify-end">
          <Button
            size="lg"
            className="btn-tablet gap-2 min-w-[200px]"
            onClick={handleExport}
            disabled={exporting || payrollData.length === 0}
          >
            <Download className="h-5 w-5" />
            {exporting 
              ? (language === 'el' ? 'Εξαγωγή...' : 'Exporting...') 
              : (language === 'el' ? 'Εξαγωγή Excel' : 'Export Excel')}
          </Button>
        </div>

        {/* Filename Preview */}
        {payrollData.length > 0 && (
          <p className="text-sm text-muted-foreground text-right">
            {language === 'el' ? 'Αρχείο' : 'Filename'}: <code className="bg-muted px-2 py-0.5 rounded">payroll_{format(dateFrom, 'yyyyMMdd')}_{format(dateTo, 'yyyyMMdd')}.xlsx</code>
          </p>
        )}
      </div>
    </MainLayout>
  );
}

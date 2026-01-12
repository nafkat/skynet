import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  CalendarIcon, 
  Download, 
  Users,
  Clock,
  Timer,
  DollarSign
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface PayrollExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
  overtime_hourly_rate: number;
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
  last_name: string;
  first_name: string;
  specialty_code: string;
  regular_minutes: number;
  overtime_minutes: number;
  regular_hours: number;
  overtime_hours: number;
  regular_hourly_rate: number;
  overtime_hourly_rate: number;
  regular_amount: number;
  overtime_amount: number;
  total_amount: number;
}

export function PayrollExportModal({ open, onOpenChange }: PayrollExportModalProps) {
  const { language } = useLanguage();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, dateFrom, dateTo]);

  const fetchData = async () => {
    setLoading(true);
    const fromDate = format(dateFrom, 'yyyy-MM-dd');
    const toDate = format(dateTo, 'yyyy-MM-dd');

    const [employeesRes, specialtiesRes, projectsRes, entriesRes] = await Promise.all([
      supabase.from('employees').select('id, employee_code, first_name, last_name, specialty_id, regular_hourly_rate, overtime_hourly_rate').eq('status', 'active'),
      supabase.from('specialties').select('id, code, name_en, name_el'),
      supabase.from('projects').select('id, project_code, project_name'),
      supabase.from('time_entries')
        .select('id, entry_date, regular_minutes, overtime_minutes, employee_id, project_id')
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate),
    ]);

    if (employeesRes.data) setEmployees(employeesRes.data);
    if (specialtiesRes.data) setSpecialties(specialtiesRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    if (entriesRes.data) setTimeEntries(entriesRes.data);
    setLoading(false);
  };

  const payrollData = useMemo(() => {
    const employeeMap = new Map<string, PayrollRow>();

    const filteredEntries = timeEntries.filter(entry => {
      if (selectedProject !== 'all' && entry.project_id !== selectedProject) return false;
      const employee = employees.find(e => e.id === entry.employee_id);
      if (selectedSpecialty !== 'all' && employee?.specialty_id !== selectedSpecialty) return false;
      return true;
    });

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
          employee_code: employee.employee_code,
          last_name: employee.last_name,
          first_name: employee.first_name,
          specialty_code: specialty?.code || '',
          regular_minutes: entry.regular_minutes,
          overtime_minutes: entry.overtime_minutes,
          regular_hours: 0,
          overtime_hours: 0,
          regular_hourly_rate: employee.regular_hourly_rate,
          overtime_hourly_rate: employee.overtime_hourly_rate,
          regular_amount: 0,
          overtime_amount: 0,
          total_amount: 0,
        });
      }
    });

    const rows: PayrollRow[] = [];
    employeeMap.forEach(row => {
      row.regular_hours = Math.round((row.regular_minutes / 60) * 100) / 100;
      row.overtime_hours = Math.round((row.overtime_minutes / 60) * 100) / 100;
      row.regular_amount = Math.round(row.regular_hours * row.regular_hourly_rate * 100) / 100;
      row.overtime_amount = Math.round(row.overtime_hours * row.overtime_hourly_rate * 100) / 100;
      row.total_amount = Math.round((row.regular_amount + row.overtime_amount) * 100) / 100;
      rows.push(row);
    });

    rows.sort((a, b) => a.employee_code.localeCompare(b.employee_code));
    return rows;
  }, [timeEntries, employees, specialties, selectedProject, selectedSpecialty]);

  const preview = useMemo(() => ({
    employeeCount: payrollData.length,
    totalRegularHours: payrollData.reduce((sum, r) => sum + r.regular_hours, 0),
    totalOvertimeHours: payrollData.reduce((sum, r) => sum + r.overtime_hours, 0),
    totalAmount: payrollData.reduce((sum, r) => sum + r.total_amount, 0),
  }), [payrollData]);

  const handleExport = () => {
    if (payrollData.length === 0) {
      toast.error(language === 'el' ? 'Δεν υπάρχουν δεδομένα' : 'No data to export');
      return;
    }

    setExporting(true);

    try {
      const wsData = payrollData.map(row => ({
        employee_code: row.employee_code,
        last_name: row.last_name,
        first_name: row.first_name,
        specialty_code: row.specialty_code,
        regular_minutes: row.regular_minutes,
        overtime_minutes: row.overtime_minutes,
        regular_hours: row.regular_hours,
        overtime_hours: row.overtime_hours,
        regular_hourly_rate: row.regular_hourly_rate,
        overtime_hourly_rate: row.overtime_hourly_rate,
        regular_amount: row.regular_amount,
        overtime_amount: row.overtime_amount,
        total_amount: row.total_amount,
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(wsData);

      ws['!cols'] = [
        { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
        { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Payroll');

      const filename = `payroll_${format(dateFrom, 'yyyyMMdd')}-${format(dateTo, 'yyyyMMdd')}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success(language === 'el' ? `Εξαγωγή: ${filename}` : `Exported: ${filename}`);
      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(language === 'el' ? 'Σφάλμα εξαγωγής' : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {language === 'el' ? 'Εξαγωγή Μισθοδοσίας' : 'Export Payroll'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{language === 'el' ? 'Από' : 'From'} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{language === 'el' ? 'Έως' : 'To'} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{language === 'el' ? 'Έργο' : 'Project'}</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'el' ? 'Όλα' : 'All'}</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.project_code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{language === 'el' ? 'Ειδικότητα' : 'Specialty'}</Label>
              <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'el' ? 'Όλες' : 'All'}</SelectItem>
                  {specialties.map(s => (
                    <SelectItem key={s.id} value={s.id}>{language === 'el' ? s.name_el : s.name_en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">
              {language === 'el' ? 'ΠΡΟΕΠΙΣΚΟΠΗΣΗ' : 'PREVIEW'}
            </p>
            {loading ? (
              <p className="text-sm text-muted-foreground">{language === 'el' ? 'Φόρτωση...' : 'Loading...'}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold">{preview.employeeCount}</p>
                    <p className="text-xs text-muted-foreground">{language === 'el' ? 'Εργαζόμενοι' : 'Employees'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold">{preview.totalRegularHours.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{language === 'el' ? 'Κανονικές' : 'Regular hrs'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold">{preview.totalOvertimeHours.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{language === 'el' ? 'Υπερωρίες' : 'Overtime hrs'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold">€{preview.totalAmount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{language === 'el' ? 'Σύνολο' : 'Total'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export Button */}
          <Button
            className="w-full btn-tablet gap-2"
            onClick={handleExport}
            disabled={exporting || payrollData.length === 0}
          >
            <Download className="h-5 w-5" />
            {exporting 
              ? (language === 'el' ? 'Εξαγωγή...' : 'Exporting...') 
              : (language === 'el' ? 'Εξαγωγή Excel' : 'Export Excel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
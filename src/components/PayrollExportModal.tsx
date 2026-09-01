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
import {
  fetchPayrollTimeEntries,
  fetchPayrollEmployees,
  buildPayrollRows,
  summarizePayroll,
  type PayrollEmployee,
  type PayrollSpecialty,
  type PayrollTimeEntry,
} from '@/lib/payrollCalc';

interface PayrollExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TimeEntry = PayrollTimeEntry;
type Employee = PayrollEmployee;
type Specialty = PayrollSpecialty;

interface Project {
  id: string;
  project_code: string;
  project_name: string;
}


export function PayrollExportModal({ open, onOpenChange }: PayrollExportModalProps) {
  const { language } = useLanguage();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [rateHistory, setRateHistory] = useState<Record<string, PayRateRow[]>>({});

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

    try {
      const [employeesData, specialtiesRes, projectsRes, entriesData] = await Promise.all([
        fetchPayrollEmployees(),
        supabase.from('specialties').select('id, code, name_en, name_el'),
        supabase.from('projects').select('id, project_code, project_name'),
        fetchPayrollTimeEntries(fromDate, toDate),
      ]);

      setEmployees(employeesData);
      if (specialtiesRes.data) setSpecialties(specialtiesRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
      setTimeEntries(entriesData);
    } catch (error) {
      console.error('Payroll fetch error:', error);
      toast.error(language === 'el' ? 'Σφάλμα φόρτωσης δεδομένων' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Get selected project details
  const selectedProjectDetails = useMemo(() => {
    if (selectedProject === 'all') return null;
    return projects.find(p => p.id === selectedProject) || null;
  }, [selectedProject, projects]);

  const payrollData = useMemo(
    () =>
      buildPayrollRows({
        entries: timeEntries,
        employees,
        specialties,
        selectedProject,
        selectedSpecialty,
        language,
        projectDetails: selectedProjectDetails,
      }),
    [timeEntries, employees, specialties, selectedProject, selectedSpecialty, selectedProjectDetails, language]
  );

  const preview = useMemo(() => {
    const s = summarizePayroll(payrollData);
    return {
      employeeCount: s.employeeCount,
      totalRegularHours: s.totalRegularHours,
      totalOvertimeHours: s.totalOvertimeHours,
      totalRegularOT: s.totalAmount,
      totalAllInOT: s.totalAllInOT,
      hasMissingLegalData: s.hasMissingLegalData,
      employeesWithMissingData: s.employeesWithMissingData,
    };
  }, [payrollData]);



  const handleExport = () => {
    if (payrollData.length === 0) {
      toast.error(language === 'el' ? 'Δεν υπάρχουν δεδομένα' : 'No data to export');
      return;
    }

    // Block export if any employee has missing legal data
    if (preview.hasMissingLegalData) {
      toast.error(
        language === 'el' 
          ? `Η εξαγωγή αποκλείεται: ${preview.employeesWithMissingData} εργαζόμενο(ι) χωρίς ΑΦΜ, IBAN ή Τράπεζα` 
          : `Export blocked: ${preview.employeesWithMissingData} employee(s) missing AFM, IBAN, or Bank`
      );
      return;
    }

    setExporting(true);

    try {
      const wsData = payrollData.map(row => {
        const baseData: Record<string, string | number> = {
          'Employee Code': row.employee_code,
          'First Name': row.first_name,
          'Last Name': row.last_name,
          'Specialty': row.specialty,
          'Regular Hours': row.regular_hours,
          'Overtime Hours': row.overtime_hours,
          'Regular Rate (€/hr)': row.regular_hourly_rate,
          'Regular All-in (€/hr)': row.regular_rate_all_in,
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

        if (row.project_code) {
          baseData['Project Code'] = row.project_code;
          baseData['Project Name'] = row.project_name || '';
        }

        return baseData;
      });

      // --- Add empty separator row + TOTALS row ---
      if (wsData.length > 0) {
        const colKeys = Object.keys(wsData[0]);
        const numericCols = new Set([
          'Regular Hours',
          'Overtime Hours',
          'Regular Cost (€)',
          'Regular All-in Cost (€)',
          'Overtime Cost (€)',
          'Total (Regular + OT) (€)',
          'Total (All-in + OT) (€)',
        ]);
        const emptyRow: Record<string, string | number> = {};
        colKeys.forEach(k => { emptyRow[k] = ''; });
        const totalsRow: Record<string, string | number> = {};
        colKeys.forEach((key, idx) => {
          if (idx === 0) {
            totalsRow[key] = 'ΣΥΝΟΛΟ / TOTAL';
          } else if (numericCols.has(key)) {
            const sum = wsData.reduce((acc, row) => {
              const val = row[key];
              return acc + (typeof val === 'number' ? val : 0);
            }, 0);
            totalsRow[key] = Math.round(sum * 100) / 100;
          } else {
            totalsRow[key] = '';
          }
        });
        wsData.push(emptyRow);
        wsData.push(totalsRow);
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(wsData);

      const baseCols = [
        { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, // Employee info
        { wch: 14 }, { wch: 14 }, // Hours
        { wch: 16 }, { wch: 18 }, { wch: 16 }, // Rates
        { wch: 14 }, { wch: 18 }, { wch: 14 }, // Costs
        { wch: 18 }, { wch: 18 }, // Totals
        { wch: 12 }, { wch: 28 }, { wch: 16 }, // Legal
      ];

      if (selectedProjectDetails) {
        baseCols.push({ wch: 14 }, { wch: 24 });
      }

      ws['!cols'] = baseCols;

      XLSX.utils.book_append_sheet(wb, ws, 'Payroll');

      // Filename: payroll_YYYYMMDD_YYYYMMDD.xlsx
      const filename = `payroll_${format(dateFrom, 'yyyyMMdd')}_${format(dateTo, 'yyyyMMdd')}.xlsx`;
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
              <div className="space-y-3">
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
                      <p className="text-lg font-bold">€{preview.totalRegularOT.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{language === 'el' ? 'Κανονικό + ΥΩ' : 'Regular + OT'}</p>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{language === 'el' ? 'Σύνολο (All-in + ΥΩ)' : 'Total (All-in + OT)'}</span>
                    <span className="font-bold">€{preview.totalAllInOT.toFixed(2)}</span>
                  </div>
                </div>
                {preview.hasMissingLegalData && (
                  <div className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                    ⚠️ {language === 'el' 
                      ? `${preview.employeesWithMissingData} εργαζόμενο(ι) χωρίς ΑΦΜ/IBAN/Τράπεζα - η εξαγωγή θα αποκλειστεί` 
                      : `${preview.employeesWithMissingData} employee(s) missing AFM/IBAN/Bank - export will be blocked`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filename Preview */}
          <p className="text-xs text-muted-foreground text-center">
            {language === 'el' ? 'Αρχείο' : 'File'}: <code className="bg-muted px-1.5 py-0.5 rounded">payroll_{format(dateFrom, 'yyyyMMdd')}_{format(dateTo, 'yyyyMMdd')}.xlsx</code>
          </p>

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

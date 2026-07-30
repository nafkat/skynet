// Shared payroll aggregation used by BOTH payroll exports:
//  - src/pages/PayrollExport.tsx        (page)
//  - src/components/PayrollExportModal.tsx (Admin Dashboard modal)
//
// Single source of truth so the two exports can never diverge again.
// Rules enforced here:
//  1. Only non-deleted entries (is_deleted = false)
//  2. All employees are considered (active + inactive that have hours in the period)
//  3. Paginated fetch (no silent 1000-row cut-off)

import { supabase } from '@/integrations/supabase/client';

export interface PayrollEmployee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  specialty_id: string;
  status?: string;
  regular_hourly_rate: number;
  regular_rate_all_in: number;
  overtime_hourly_rate: number;
  afm: string | null;
  iban: string | null;
  bank_name: string | null;
  employment_type?: string;
}

export interface PayrollSpecialty {
  id: string;
  code?: string;
  name_en: string;
  name_el: string;
}

export interface PayrollTimeEntry {
  id: string;
  entry_date: string;
  regular_minutes: number;
  overtime_minutes: number;
  employee_id: string;
  project_id: string;
}

export interface PayrollRow {
  employee_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  specialty: string;
  employment_type: string;
  status: string;
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
  hasMissingLegalData: boolean;
}

const PAGE_SIZE = 1000;

/** Fetch every non-deleted time entry in the range, paginated. */
export async function fetchPayrollTimeEntries(
  fromDate: string,
  toDate: string
): Promise<PayrollTimeEntry[]> {
  const all: PayrollTimeEntry[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('time_entries')
      .select('id, entry_date, regular_minutes, overtime_minutes, employee_id, project_id')
      .eq('is_deleted', false)
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
      .order('entry_date', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

/** All employees (active + inactive) — inactive ones may still have hours in the period. */
export async function fetchPayrollEmployees(): Promise<PayrollEmployee[]> {
  const { data, error } = await supabase.from('employees').select('*');
  if (error) throw error;
  return (data ?? []) as unknown as PayrollEmployee[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface BuildPayrollOptions {
  entries: PayrollTimeEntry[];
  employees: PayrollEmployee[];
  specialties: PayrollSpecialty[];
  selectedProject?: string;
  selectedSpecialty?: string;
  language?: string;
  projectDetails?: { project_code: string; project_name: string } | null;
}

export function buildPayrollRows({
  entries,
  employees,
  specialties,
  selectedProject = 'all',
  selectedSpecialty = 'all',
  language = 'en',
  projectDetails = null,
}: BuildPayrollOptions): PayrollRow[] {
  const employeeById = new Map(employees.map(e => [e.id, e]));
  const specialtyById = new Map(specialties.map(s => [s.id, s]));

  const totals = new Map<string, { regular_minutes: number; overtime_minutes: number }>();

  for (const entry of entries) {
    if (selectedProject !== 'all' && entry.project_id !== selectedProject) continue;
    const employee = employeeById.get(entry.employee_id);
    if (!employee) continue;
    if (selectedSpecialty !== 'all' && employee.specialty_id !== selectedSpecialty) continue;

    const existing = totals.get(employee.id);
    if (existing) {
      existing.regular_minutes += entry.regular_minutes;
      existing.overtime_minutes += entry.overtime_minutes;
    } else {
      totals.set(employee.id, {
        regular_minutes: entry.regular_minutes,
        overtime_minutes: entry.overtime_minutes,
      });
    }
  }

  const rows: PayrollRow[] = [];

  totals.forEach((mins, employeeId) => {
    const employee = employeeById.get(employeeId);
    if (!employee) return;
    const specialty = specialtyById.get(employee.specialty_id);

    const regular_hours = round2(mins.regular_minutes / 60);
    const overtime_hours = round2(mins.overtime_minutes / 60);

    const regular_amount = round2(regular_hours * (employee.regular_hourly_rate || 0));
    const regular_all_in_amount = round2(regular_hours * (employee.regular_rate_all_in || 0));
    const overtime_amount = round2(overtime_hours * (employee.overtime_hourly_rate || 0));

    const row: PayrollRow = {
      employee_id: employee.id,
      employee_code: employee.employee_code,
      first_name: employee.first_name,
      last_name: employee.last_name,
      specialty: specialty ? (language === 'el' ? specialty.name_el : specialty.name_en) : '',
      employment_type: employee.employment_type || 'permanent',
      status: employee.status || 'active',
      afm: employee.afm || '',
      iban: employee.iban || '',
      bank_name: employee.bank_name || '',
      regular_hours,
      overtime_hours,
      regular_hourly_rate: employee.regular_hourly_rate || 0,
      regular_rate_all_in: employee.regular_rate_all_in || 0,
      overtime_hourly_rate: employee.overtime_hourly_rate || 0,
      regular_amount,
      regular_all_in_amount,
      overtime_amount,
      total_amount: round2(regular_amount + overtime_amount),
      total_all_in_ot: round2(regular_all_in_amount + overtime_amount),
      hasMissingLegalData: !employee.afm || !employee.iban || !employee.bank_name,
    };

    if (projectDetails) {
      row.project_code = projectDetails.project_code;
      row.project_name = projectDetails.project_name;
    }

    rows.push(row);
  });

  rows.sort((a, b) => a.employee_code.localeCompare(b.employee_code));
  return rows;
}

export interface PayrollSummary {
  employeeCount: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalRegularAmount: number;
  totalRegularAllInAmount: number;
  totalOvertimeAmount: number;
  totalAmount: number;
  totalAllInOT: number;
  employeesWithMissingData: number;
  hasMissingLegalData: boolean;
}

export function summarizePayroll(rows: PayrollRow[]): PayrollSummary {
  const sum = (pick: (r: PayrollRow) => number) => round2(rows.reduce((s, r) => s + pick(r), 0));
  const missing = rows.filter(r => r.hasMissingLegalData).length;

  return {
    employeeCount: rows.length,
    totalRegularHours: sum(r => r.regular_hours),
    totalOvertimeHours: sum(r => r.overtime_hours),
    totalRegularAmount: sum(r => r.regular_amount),
    totalRegularAllInAmount: sum(r => r.regular_all_in_amount),
    totalOvertimeAmount: sum(r => r.overtime_amount),
    totalAmount: sum(r => r.total_amount),
    totalAllInOT: sum(r => r.total_all_in_ot),
    employeesWithMissingData: missing,
    hasMissingLegalData: missing > 0,
  };
}

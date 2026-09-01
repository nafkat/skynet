import { describe, it, expect } from 'vitest';
import { buildPayrollRows, summarizePayroll, resolveRatesForDate, type PayrollEmployee, type PayrollTimeEntry } from './payrollCalc';

const specialties = [{ id: 'sp1', name_en: 'Welder', name_el: 'Συγκολλητής' }];

const emp = (over: Partial<PayrollEmployee> = {}): PayrollEmployee => ({
  id: 'e1',
  employee_code: 'WORK-0002',
  first_name: 'A',
  last_name: 'B',
  specialty_id: 'sp1',
  status: 'active',
  regular_hourly_rate: 10,
  regular_rate_all_in: 14,
  overtime_hourly_rate: 15,
  afm: '123',
  iban: 'GR1',
  bank_name: 'Bank',
  employment_type: 'permanent',
  ...over,
});

const entry = (over: Partial<PayrollTimeEntry> = {}): PayrollTimeEntry => ({
  id: 't1',
  entry_date: '2026-07-23',
  regular_minutes: 420,
  overtime_minutes: 180,
  employee_id: 'e1',
  project_id: 'p1',
  ...over,
});

describe('buildPayrollRows', () => {
  it('aggregates hours and amounts per employee', () => {
    const rows = buildPayrollRows({
      entries: [entry(), entry({ id: 't2', regular_minutes: 420, overtime_minutes: 0 })],
      employees: [emp()],
      specialties,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].regular_hours).toBe(14);
    expect(rows[0].overtime_hours).toBe(3);
    expect(rows[0].regular_amount).toBe(140);
    expect(rows[0].regular_all_in_amount).toBe(196);
    expect(rows[0].overtime_amount).toBe(45);
    expect(rows[0].total_amount).toBe(185);
    expect(rows[0].total_all_in_ot).toBe(241);
  });

  it('includes inactive employees that have hours', () => {
    const rows = buildPayrollRows({
      entries: [entry()],
      employees: [emp({ status: 'inactive' })],
      specialties,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('inactive');
  });

  it('handles all-in rate of zero', () => {
    const rows = buildPayrollRows({
      entries: [entry({ overtime_minutes: 0 })],
      employees: [emp({ regular_rate_all_in: 0 })],
      specialties,
    });
    expect(rows[0].regular_all_in_amount).toBe(0);
    expect(rows[0].total_all_in_ot).toBe(0);
  });

  it('filters by project and specialty', () => {
    const employees = [emp(), emp({ id: 'e2', employee_code: 'WORK-0003', specialty_id: 'sp2' })];
    const entries = [entry(), entry({ id: 't2', employee_id: 'e2', project_id: 'p2' })];

    expect(buildPayrollRows({ entries, employees, specialties, selectedProject: 'p1' })).toHaveLength(1);
    expect(buildPayrollRows({ entries, employees, specialties, selectedSpecialty: 'sp2' })).toHaveLength(1);
  });

  it('flags missing legal data', () => {
    const rows = buildPayrollRows({
      entries: [entry()],
      employees: [emp({ iban: null })],
      specialties,
    });
    expect(rows[0].hasMissingLegalData).toBe(true);
  });
});

describe('summarizePayroll', () => {
  it('totals match the sum of rows', () => {
    const rows = buildPayrollRows({
      entries: [entry(), entry({ id: 't2', employee_id: 'e2' })],
      employees: [emp(), emp({ id: 'e2', employee_code: 'WORK-0003', regular_rate_all_in: 0 })],
      specialties,
    });
    const s = summarizePayroll(rows);
    expect(s.employeeCount).toBe(2);
    expect(s.totalRegularHours).toBe(14);
    expect(s.totalOvertimeHours).toBe(6);
    expect(s.totalAmount).toBe(rows[0].total_amount + rows[1].total_amount);
    expect(s.totalAllInOT).toBe(rows[0].total_all_in_ot + rows[1].total_all_in_ot);
  });
});

describe('effective-dated rates', () => {
  it('falls back to current employee rates when no history exists', () => {
    const rows = buildPayrollRows({ entries: [entry()], employees: [emp()], specialties, rateHistory: {} });
    expect(rows[0].regular_amount).toBe(70);
    expect(rows[0].overtime_amount).toBe(45);
  });

  it('uses the rate in force on each work date across a change', () => {
    const rateHistory = {
      e1: [
        { effective_from: '2026-01-01', regular_hourly_rate: 10, regular_rate_all_in: 14, overtime_hourly_rate: 15 },
        { effective_from: '2026-07-25', regular_hourly_rate: 20, regular_rate_all_in: 24, overtime_hourly_rate: 30 },
      ],
    };
    const rows = buildPayrollRows({
      entries: [
        entry({ entry_date: '2026-07-23', regular_minutes: 60, overtime_minutes: 0 }),
        entry({ id: 't2', entry_date: '2026-07-26', regular_minutes: 60, overtime_minutes: 60 }),
      ],
      employees: [emp()],
      specialties,
      rateHistory,
    });
    expect(rows[0].regular_amount).toBe(30); // 10 + 20
    expect(rows[0].overtime_amount).toBe(30);
    expect(rows[0].regular_hourly_rate).toBe(20); // rate on last work day
  });

  it('ignores scheduled future rates', () => {
    const rateHistory = {
      e1: [
        { effective_from: '2026-01-01', regular_hourly_rate: 10, regular_rate_all_in: 14, overtime_hourly_rate: 15 },
        { effective_from: '2099-01-01', regular_hourly_rate: 99, regular_rate_all_in: 99, overtime_hourly_rate: 99 },
      ],
    };
    const rows = buildPayrollRows({ entries: [entry({ overtime_minutes: 0, regular_minutes: 60 })], employees: [emp()], specialties, rateHistory });
    expect(rows[0].regular_amount).toBe(10);
  });

  it('resolveRatesForDate uses earliest known rate for dates before history', () => {
    const r = resolveRatesForDate(
      [{ effective_from: '2026-05-01', regular_hourly_rate: 12, regular_rate_all_in: 16, overtime_hourly_rate: 18 }],
      '2026-01-01',
      { effective_from: '0001-01-01', regular_hourly_rate: 1, regular_rate_all_in: 1, overtime_hourly_rate: 1 }
    );
    expect(r.regular_hourly_rate).toBe(12);
  });
});

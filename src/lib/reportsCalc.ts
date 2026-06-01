// Pure aggregation helpers for Reports page.
// Extracted so we can unit-test the math without hitting Supabase.

export interface RateEmployee {
  id: string;
  regular_hourly_rate?: number | null;
  regular_rate_all_in?: number | null;
  overtime_hourly_rate?: number | null;
}

export interface TimeEntryLike {
  regular_minutes: number;
  overtime_minutes: number;
  employees?: RateEmployee | null;
  projects?: { id: string } | null;
}

export interface ReportTotals {
  totalRegularMinutes: number;
  totalOvertimeMinutes: number;
  totalRegularPay: number;
  totalRegularAllInPay: number;
  totalOvertimePay: number;
  totalRegularPlusOT: number;
  totalAllInPlusOT: number;
}

export function aggregateReport(entries: TimeEntryLike[]): ReportTotals {
  let totalRegularMinutes = 0;
  let totalOvertimeMinutes = 0;
  let totalRegularPay = 0;
  let totalRegularAllInPay = 0;
  let totalOvertimePay = 0;

  for (const entry of entries) {
    const emp = entry.employees;
    totalRegularMinutes += entry.regular_minutes;
    totalOvertimeMinutes += entry.overtime_minutes;

    totalRegularPay += (entry.regular_minutes / 60) * (emp?.regular_hourly_rate || 0);
    totalRegularAllInPay += (entry.regular_minutes / 60) * (emp?.regular_rate_all_in || 0);
    totalOvertimePay += (entry.overtime_minutes / 60) * (emp?.overtime_hourly_rate || 0);
  }

  return {
    totalRegularMinutes,
    totalOvertimeMinutes,
    totalRegularPay,
    totalRegularAllInPay,
    totalOvertimePay,
    totalRegularPlusOT: totalRegularPay + totalOvertimePay,
    totalAllInPlusOT: totalRegularAllInPay + totalOvertimePay,
  };
}

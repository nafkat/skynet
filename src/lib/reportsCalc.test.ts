import { describe, it, expect } from "vitest";
import { aggregateReport, type TimeEntryLike } from "./reportsCalc";

const EMP_WITH_ALLIN = {
  id: "e1",
  regular_hourly_rate: 10,
  regular_rate_all_in: 12.5,
  overtime_hourly_rate: 20,
};

const EMP_NO_ALLIN = {
  id: "e2",
  regular_hourly_rate: 10,
  regular_rate_all_in: 0,
  overtime_hourly_rate: 20,
};

const round = (n: number) => Math.round(n * 100) / 100;

describe("aggregateReport", () => {
  it("computes totals when all-in rate > 0 (8h regular + 2h OT)", () => {
    const entries: TimeEntryLike[] = [
      { regular_minutes: 480, overtime_minutes: 120, employees: EMP_WITH_ALLIN },
    ];
    const r = aggregateReport(entries);

    expect(r.totalRegularMinutes).toBe(480);
    expect(r.totalOvertimeMinutes).toBe(120);
    expect(round(r.totalRegularPay)).toBe(80); // 8 * 10
    expect(round(r.totalRegularAllInPay)).toBe(100); // 8 * 12.5
    expect(round(r.totalOvertimePay)).toBe(40); // 2 * 20
    expect(round(r.totalRegularPlusOT)).toBe(120); // 80 + 40
    expect(round(r.totalAllInPlusOT)).toBe(140); // 100 + 40
  });

  it("treats missing/zero all-in as 0 (regression: was previously always 0)", () => {
    const entries: TimeEntryLike[] = [
      { regular_minutes: 480, overtime_minutes: 0, employees: EMP_NO_ALLIN },
    ];
    const r = aggregateReport(entries);

    expect(round(r.totalRegularPay)).toBe(80);
    expect(r.totalRegularAllInPay).toBe(0);
    expect(r.totalOvertimePay).toBe(0);
    expect(round(r.totalRegularPlusOT)).toBe(80);
    // All-in+OT must equal Regular pay (since all-in=0 means we still show 0)
    expect(round(r.totalAllInPlusOT)).toBe(0);
  });

  it("OT-only entry for no-all-in employee yields All-in+OT = OT only", () => {
    const entries: TimeEntryLike[] = [
      { regular_minutes: 0, overtime_minutes: 690, employees: EMP_NO_ALLIN }, // 11.5h
    ];
    const r = aggregateReport(entries);

    expect(round(r.totalOvertimePay)).toBe(230); // 11.5 * 20
    expect(round(r.totalAllInPlusOT)).toBe(230);
    expect(round(r.totalRegularPlusOT)).toBe(230);
  });

  it("aggregates across mixed employees correctly", () => {
    const entries: TimeEntryLike[] = [
      { regular_minutes: 480, overtime_minutes: 60, employees: EMP_WITH_ALLIN }, // 8h + 1h OT
      { regular_minutes: 240, overtime_minutes: 0, employees: EMP_NO_ALLIN }, // 4h
    ];
    const r = aggregateReport(entries);

    expect(r.totalRegularMinutes).toBe(720);
    expect(r.totalOvertimeMinutes).toBe(60);
    expect(round(r.totalRegularPay)).toBe(120); // 80 + 40
    expect(round(r.totalRegularAllInPay)).toBe(100); // 100 + 0
    expect(round(r.totalOvertimePay)).toBe(20); // 1 * 20
    expect(round(r.totalRegularPlusOT)).toBe(140);
    expect(round(r.totalAllInPlusOT)).toBe(120);
  });

  it("handles null employees join gracefully", () => {
    const entries: TimeEntryLike[] = [
      { regular_minutes: 60, overtime_minutes: 60, employees: null },
    ];
    const r = aggregateReport(entries);
    expect(r.totalRegularPay).toBe(0);
    expect(r.totalRegularAllInPay).toBe(0);
    expect(r.totalOvertimePay).toBe(0);
  });

  it("Regular + Overtime + All-in are internally consistent", () => {
    const entries: TimeEntryLike[] = [
      { regular_minutes: 600, overtime_minutes: 120, employees: EMP_WITH_ALLIN },
    ];
    const r = aggregateReport(entries);
    // Identity: AllInPlusOT - RegularPlusOT === AllInPay - RegularPay
    expect(round(r.totalAllInPlusOT - r.totalRegularPlusOT)).toBe(
      round(r.totalRegularAllInPay - r.totalRegularPay),
    );
  });
});

import { createHash } from "node:crypto";
import type { DayRecord, SyntheticDay } from "./types";

export function isWeekend(date: string) {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
}

export function median(xs: number[]) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function toRecords(days: SyntheticDay[]): DayRecord[] {
  return days.map((d) => ({
    date: d.date,
    isEmptyDay: d.isEmptyDay,
    items: d.expenses.map((e) => ({ category: e.categoryName, amount: e.amount })),
  }));
}

// dipakai untuk data asli DAN sintesis, jadi perbandingannya adil
export function computeStats(records: DayRecord[]) {
  const per = records.map((r) => ({
    weekend: isWeekend(r.date),
    total: r.items.reduce((a, i) => a + i.amount, 0),
    count: r.items.length,
    empty: r.isEmptyDay,
  }));
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const avg = (rows: typeof per) =>
    rows.length ? sum(rows.map((r) => r.total)) / rows.length : 0;

  const weekday = per.filter((p) => !p.weekend);
  const weekend = per.filter((p) => p.weekend);
  const items = sum(per.map((p) => p.count));
  const total = sum(per.map((p) => p.total));
  const expenseDays = per.filter((p) => p.count > 0).length;

  const byCategory = new Map<string, { items: number; total: number }>();
  for (const r of records) {
    for (const i of r.items) {
      const c = byCategory.get(i.category) ?? { items: 0, total: 0 };
      c.items++;
      c.total += i.amount;
      byCategory.set(i.category, c);
    }
  }

  return {
    days: per.length,
    emptyDays: per.filter((p) => p.empty).length,
    expenseDays,
    items,
    total,
    avgPerDay: per.length ? total / per.length : 0,
    weekdayDays: weekday.length,
    weekendDays: weekend.length,
    weekdayAvg: avg(weekday),
    weekendAvg: avg(weekend),
    itemsPerExpenseDay: expenseDays ? items / expenseDays : 0,
    byCategory,
  };
}

export function fingerprint(days: SyntheticDay[]) {
  return createHash("sha256").update(JSON.stringify(days)).digest("hex");
}
import { addDays } from "@/lib/dates";
import { computeStats, isWeekend, median, toRecords } from "./stats";
import type { Dist, SyntheticDay, SyntheticProfile } from "./types";

export type Check = { name: string; ok: boolean; detail: string };

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const binomTol = (p: number, n: number) =>
  3.5 * Math.sqrt(Math.max(p * (1 - p), 0.0001) / Math.max(n, 1));

function distStats(d: Dist) {
  const total = d.weights.reduce((a, b) => a + b, 0);
  const mean = d.values.reduce((a, v, i) => a + v * d.weights[i], 0) / total;
  const variance =
    d.values.reduce((a, v, i) => a + (v - mean) ** 2 * d.weights[i], 0) / total;
  return { mean, variance };
}

export function checkPlausibility(profile: SyntheticProfile, days: SyntheticDay[]): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  const stats = computeStats(toRecords(days));
  const spikeCount = profile.spikes?.count ?? 0;
  const allExpenses = days.flatMap((d) => d.expenses);

  // 1. kalender
  let contiguous = days.length === profile.days;
  for (let i = 1; i < days.length && contiguous; i++) {
    if (days[i].date !== addDays(days[i - 1].date, 1)) contiguous = false;
  }
  add("Jumlah hari dan urutan tanggal", contiguous, `${days.length} hari (profil: ${profile.days})`);

  // 2. nilai sah
  const allowed = new Set([
    ...profile.categories.map((c) => c.name),
    ...(profile.spikes?.categories.map((c) => c.name) ?? []),
  ]);
  const invalid = allExpenses.filter(
    (e) => !allowed.has(e.categoryName) || !Number.isInteger(e.amount) || e.amount < 1000,
  );
  add(
    "Kategori dan nominal sah",
    invalid.length === 0,
    invalid.length ? `${invalid.length} item tidak sah` : "semua sah",
  );

  const inconsistent = days.filter((d) => d.isEmptyDay !== (d.expenses.length === 0));
  add(
    "Penanda hari kosong konsisten",
    inconsistent.length === 0,
    inconsistent.length ? `${inconsistent.length} hari tidak konsisten` : "konsisten",
  );

  // 3. proporsi hari kosong per jenis hari
  for (const [label, weekend, expected] of [
    ["hari kerja", false, profile.emptyRate.weekday],
    ["akhir pekan", true, profile.emptyRate.weekend],
  ] as const) {
    const rows = days.filter((d) => isWeekend(d.date) === weekend);
    if (rows.length === 0) continue;
    const observed = rows.filter((d) => d.isEmptyDay).length / rows.length;
    const tol = binomTol(expected, rows.length) + spikeCount / rows.length;
    add(
      `Proporsi hari kosong (${label})`,
      Math.abs(observed - expected) <= tol,
      `${pct(observed)} vs profil ${pct(expected)} (toleransi ±${pct(tol)})`,
    );
  }

  // 4. item per hari berpengeluaran
  const expenseDays = days.filter((d) => d.expenses.length > 0);
  if (expenseDays.length > 0) {
    const wd = distStats(profile.itemsPerDay.weekday);
    const we = distStats(profile.itemsPerDay.weekend);
    let m = 0;
    let v = 0;
    for (const d of expenseDays) {
      const s = isWeekend(d.date) ? we : wd;
      m += s.mean;
      v += s.variance;
    }
    const expected = m / expenseDays.length;
    const tol = (3.5 * Math.sqrt(v)) / expenseDays.length + spikeCount / expenseDays.length;
    add(
      "Rata-rata item per hari berpengeluaran",
      Math.abs(stats.itemsPerExpenseDay - expected) <= tol,
      `${stats.itemsPerExpenseDay.toFixed(2)} vs harapan ${expected.toFixed(2)} (±${tol.toFixed(2)})`,
    );
  }

  // 5. porsi kategori (per item)
  for (const c of profile.categories) {
    const observed = (stats.byCategory.get(c.name)?.items ?? 0) / Math.max(stats.items, 1);
    const tol = binomTol(c.weight, stats.items) + spikeCount / Math.max(stats.items, 1);
    add(
      `Porsi kategori: ${c.name}`,
      Math.abs(observed - c.weight) <= tol,
      `${pct(observed)} vs profil ${pct(c.weight)} (±${pct(tol)})`,
    );
  }

  // 6. median nominal per kategori (di luar lonjakan)
  const minSpike = profile.spikes?.minAmount ?? Infinity;
  for (const c of profile.categories) {
    const amounts = allExpenses
      .filter((e) => e.categoryName === c.name && e.amount < minSpike)
      .map((e) => e.amount);
    if (amounts.length < 15) continue;
    const med = median(amounts);
    const tol = (3.5 * 1.2533 * c.sigma) / Math.sqrt(amounts.length) + 0.06;
    add(
      `Median nominal: ${c.name}`,
      Math.abs(Math.log(med) - c.mu) <= tol,
      `${Math.round(med)} vs profil ${Math.round(Math.exp(c.mu))}`,
    );
  }

  // 7. lonjakan
  if (profile.spikes) {
    const expected = Math.min(profile.spikes.count, days.length);
    const big = allExpenses.filter((e) => e.amount >= profile.spikes!.minAmount).length;
    add("Jumlah lonjakan", big === expected, `${big} item besar (profil: ${expected})`);
  }

  return checks;
}
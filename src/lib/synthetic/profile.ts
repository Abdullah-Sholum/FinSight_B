import { createRng, deriveSeed, type Rng } from "./rng";
import { isWeekend, median } from "./stats";
import {
  GENERATOR_VERSION,
  type DayRecord,
  type Dist,
  type PrivacyLevel,
  type SyntheticProfile,
} from "./types";

// Kategori yang tidak pernah masuk data sintesis
export const EXCLUDED_CATEGORIES = ["Uncategorized", "Lain-lain"];
export const MIN_GROUP = 10; // ambang k: kelompok lebih kecil dibuang atau digabung
export const MIN_SPIKES = 5; // kurang dari ini, lonjakan tidak dimodelkan
export const SPIKE_SCALE = 0.5; // "lonjakan kecil": ~separuh besar aslinya

export const PRIVACY_NOISE: Record<PrivacyLevel, number> = {
  LOW: 0.05,
  BALANCED: 0.12,
  HIGH: 0.25,
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const perturb = (rng: Rng, value: number, noise: number) =>
  value * Math.exp(noise * rng.normal());
const normalize = (ws: number[]) => {
  const t = ws.reduce((a, b) => a + b, 0);
  return ws.map((w) => w / t);
};
const roundTo = (x: number, step: number) => Math.round(x / step) * step;

// cap = n terbesar yang dicapai minimal MIN_GROUP hari; sisanya digabung ke cap
function buildDist(counts: number[], rng: Rng, noise: number): Dist {
  const maxN = Math.max(...counts);
  let cap = 1;
  for (let n = 1; n <= maxN; n++) {
    if (counts.filter((c) => c >= n).length >= MIN_GROUP) cap = n;
  }
  const values = Array.from({ length: cap }, (_, i) => i + 1);
  const raw = values.map((v) => counts.filter((c) => Math.min(c, cap) === v).length);
  const weights = normalize(raw.map((r) => perturb(rng, Math.max(r, 0.5), noise)));
  return { values, weights };
}

export function buildProfile(
  records: DayRecord[],
  opts: { privacy: PrivacyLevel; seed: number },
): SyntheticProfile {
  if (records.length === 0) throw new Error("Tidak ada data untuk dibuat profilnya.");
  const noise = PRIVACY_NOISE[opts.privacy];
  // urutan penarikan acak di bawah ini TETAP; mengubahnya berarti naikkan GENERATOR_VERSION
  const rng = createRng(deriveSeed(opts.seed, "profile"));
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

  const first = sorted[0].date;
  const last = sorted[sorted.length - 1].date;
  const span =
    Math.round(
      (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000,
    ) + 1;

  // --- klasifikasi item (tanpa penarikan acak) ---
  const kept = sorted.flatMap((r) =>
    r.items.filter((i) => !EXCLUDED_CATEGORIES.includes(i.category)),
  );
  if (kept.length === 0) {
    throw new Error("Tidak ada item yang bisa dipakai setelah kategori dikecualikan.");
  }
  const spikeThreshold = Math.max(300_000, 15 * median(kept.map((i) => i.amount)));
  const isSpike = (amount: number) => amount >= spikeThreshold;

  // --- 1. hari kosong ---
  const daysOf = (weekend: boolean) => sorted.filter((r) => isWeekend(r.date) === weekend);
  const rateOf = (rows: DayRecord[]) => rows.filter((r) => r.isEmptyDay).length / rows.length;
  const baseRate = (weekend: boolean) =>
    daysOf(weekend).length >= MIN_GROUP ? rateOf(daysOf(weekend)) : rateOf(sorted);
  const emptyRate = {
    weekday: clamp(perturb(rng, baseRate(false), noise), 0, 0.95),
    weekend: clamp(perturb(rng, baseRate(true), noise), 0, 0.95),
  };

  // --- 2. item per hari berpengeluaran ---
  const countsOf = (list: DayRecord[]) =>
    list
      .filter((r) => !r.isEmptyDay)
      .map(
        (r) =>
          r.items.filter((i) => !EXCLUDED_CATEGORIES.includes(i.category) && !isSpike(i.amount))
            .length,
      )
      .filter((n) => n >= 1);
  const allCounts = countsOf(sorted);
  if (allCounts.length < MIN_GROUP) {
    throw new Error(
      `Data terlalu sedikit: hanya ${allCounts.length} hari berpengeluaran (minimal ${MIN_GROUP}).`,
    );
  }
  const countsFor = (weekend: boolean) => {
    const c = countsOf(daysOf(weekend));
    return c.length >= MIN_GROUP ? c : allCounts;
  };
  const itemsPerDay = {
    weekday: buildDist(countsFor(false), rng, noise),
    weekend: buildDist(countsFor(true), rng, noise),
  };

  // --- 3. kategori: bobot dan sebaran nominal (log-normal) ---
  const byCat = new Map<string, number[]>();
  for (const i of kept) {
    if (isSpike(i.amount)) continue;
    const list = byCat.get(i.category) ?? [];
    list.push(i.amount);
    byCat.set(i.category, list);
  }
  const names = [...byCat.keys()].sort();
  const dropped = names.filter((n) => byCat.get(n)!.length < MIN_GROUP);
  const keptNames = names.filter((n) => !dropped.includes(n));
  if (keptNames.length === 0) {
    throw new Error(`Tidak ada kategori dengan minimal ${MIN_GROUP} item.`);
  }

  const totalItems = keptNames.reduce((a, n) => a + byCat.get(n)!.length, 0);
  const weights = normalize(
    keptNames.map((n) => perturb(rng, byCat.get(n)!.length / totalItems, noise)),
  );
  const categories = keptNames.map((name, idx) => {
    const logs = byCat.get(name)!.map((x) => Math.log(x));
    const m = logs.reduce((a, b) => a + b, 0) / logs.length;
    const sd = Math.sqrt(logs.reduce((a, x) => a + (x - m) ** 2, 0) / (logs.length - 1));
    return {
      name,
      weight: weights[idx],
      mu: m + 0.5 * noise * rng.normal(),
      sigma: clamp(Math.max(sd, 0.2) * Math.exp(0.5 * noise * rng.normal()), 0.2, 2),
    };
  });

  // --- 4. lonjakan (pembelian besar), diskalakan dan dikaburkan ---
  const spikeItems = kept.filter((i) => isSpike(i.amount));
  let spikes: SyntheticProfile["spikes"] = null;
  if (spikeItems.length >= MIN_SPIKES) {
    const amounts = spikeItems.map((i) => i.amount);
    const count = Math.max(1, Math.round(spikeItems.length * Math.exp(noise * rng.normal())));
    const lo = Math.max(
      10_000,
      roundTo(Math.min(...amounts) * SPIKE_SCALE * Math.exp(noise * rng.normal()), 10_000),
    );
    const hiRaw = Math.max(...amounts) * SPIKE_SCALE * Math.exp(noise * rng.normal());
    const hi = roundTo(Math.max(hiRaw, lo * 1.5), 10_000);

    const catCounts = new Map<string, number>();
    for (const i of spikeItems) catCounts.set(i.category, (catCounts.get(i.category) ?? 0) + 1);
    const spikeNames = [...catCounts.keys()].sort();
    const spikeWeights = normalize(
      spikeNames.map((n) => perturb(rng, catCounts.get(n)!, noise)),
    );
    spikes = {
      count,
      minAmount: lo,
      maxAmount: hi,
      categories: spikeNames.map((name, i) => ({ name, weight: spikeWeights[i] })),
    };
  }

  return {
    schemaVersion: 1,
    generatorVersion: GENERATOR_VERSION,
    privacy: opts.privacy,
    noise,
    days: span,
    emptyRate,
    itemsPerDay,
    categories,
    spikes,
    review: {
      excluded: [...EXCLUDED_CATEGORIES],
      droppedCategories: dropped,
      minGroupSize: MIN_GROUP,
    },
  };
}
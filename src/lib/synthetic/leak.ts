import { containsPhrase, normalizeText } from "@/lib/categorize";
import type { Check } from "./checks";
import { MIN_GROUP } from "./profile";
import { isWeekend } from "./stats";
import type { SyntheticDay } from "./types";
import type { Vocabulary } from "./vocabulary";

export type RealDay = {
  date: string;
  isEmptyDay: boolean;
  items: { item: string; category: string; amount: number }[];
};

export type LeakInput = { vocabulary: Vocabulary; forbidden: string[] };

export const CHECK = {
  vocab: "Kosakata item",
  rare: "Kata langka dari data asli",
  forbidden: "Daftar larang",
  days: "Hari identik atau nyaris identik",
  amounts: "Nominal besar khas",
  pattern: "Pola waktu",
  topDay: "Hari termahal berbeda",
} as const;

const MIN_SIMILAR_DAY_ITEMS = 6;
const SIM_LIMIT = 0.8;
const CORR_LIMIT = 0.25;
const BIG_AMOUNT = 100_000;

const sum = (xs: { amount: number }[]) => xs.reduce((a, i) => a + i.amount, 0);
const tokensOf = (text: string) =>
  normalizeText(text)
    .split(" ")
    .filter((t) => /[a-z]/.test(t));

function vocabPhrases(v: Vocabulary) {
  const set = new Set<string>();
  for (const group of [v.regular, v.big]) {
    for (const list of Object.values(group)) {
      for (const p of list) set.add(normalizeText(p));
    }
  }
  return set;
}

function realTokenCounts(real: RealDay[]) {
  const counts = new Map<string, number>();
  for (const d of real) {
    for (const i of d.items) {
      for (const t of tokensOf(i.item)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return counts;
}

// nominal besar yang di data asli muncul sekali dan bukan kelipatan 10.000
function khasAmounts(real: RealDay[]) {
  const counts = new Map<number, number>();
  for (const d of real) {
    for (const i of d.items) counts.set(i.amount, (counts.get(i.amount) ?? 0) + 1);
  }
  return new Set(
    [...counts]
      .filter(([a, n]) => n === 1 && a >= BIG_AMOUNT && a % 10_000 !== 0)
      .map(([a]) => a),
  );
}

type Bag = Map<string, number>;
const toBag = (items: { category: string; amount: number }[]): Bag => {
  const m: Bag = new Map();
  for (const i of items) {
    const k = `${i.category}|${i.amount}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
};

function jaccard(a: Bag, b: Bag) {
  let inter = 0;
  let union = 0;
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(k) ?? 0;
    const y = b.get(k) ?? 0;
    inter += Math.min(x, y);
    union += Math.max(x, y);
  }
  return union === 0 ? 0 : inter / union;
}

// log total harian, dikurangi rata-rata per jenis hari (agar pola mingguan yang wajar tidak dianggap penyalinan)
function residuals(rows: { date: string; total: number }[]) {
  const logv = rows.map((r) => Math.log1p(r.total / 1000));
  const acc = { we: [0, 0], wd: [0, 0] };
  rows.forEach((r, i) => {
    const a = isWeekend(r.date) ? acc.we : acc.wd;
    a[0] += logv[i];
    a[1]++;
  });
  const mean = (a: number[]) => (a[1] ? a[0] / a[1] : 0);
  const mWe = mean(acc.we);
  const mWd = mean(acc.wd);
  return rows.map((r, i) => ({
    date: r.date,
    v: logv[i] - (isWeekend(r.date) ? mWe : mWd),
  }));
}

function pearson(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const d = Math.sqrt(sxx * syy);
  return d === 0 ? 0 : sxy / d;
}

const topOf = (rows: { date: string; total: number }[]) =>
  rows.reduce((b, r) => (r.total > b.total ? r : b), { date: "", total: -1 });

const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);

export function checkLeaks(
  synthetic: SyntheticDay[],
  real: RealDay[],
  input: LeakInput,
): Check[] {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  const synItems = synthetic.flatMap((d) => d.expenses);

  // 1. semua nama item harus ada di daftar putih
  const phrases = vocabPhrases(input.vocabulary);
  const outside = new Set(
    synItems.map((i) => normalizeText(i.item)).filter((t) => !phrases.has(t)),
  );
  add(
    CHECK.vocab,
    outside.size === 0,
    outside.size === 0
      ? `${synItems.length} item, semuanya ada di daftar putih`
      : `${outside.size} nama item di luar daftar putih`,
  );

  // 2. kata yang di data asli muncul 1-9 kali tidak boleh ada
  const counts = realTokenCounts(real);
  const synTokens = new Set(synItems.flatMap((i) => tokensOf(i.item)));
  const rare = [...synTokens].filter((t) => {
    const n = counts.get(t) ?? 0;
    return n >= 1 && n < MIN_GROUP;
  });
  add(
    CHECK.rare,
    rare.length === 0,
    rare.length === 0 ? "tidak ada" : `${rare.length} kata terlalu khas muncul di sintesis`,
  );

  // 3. daftar larang (opsional); frasanya sendiri tidak pernah dicetak
  if (input.forbidden.length === 0) {
    add(CHECK.forbidden, true, "dilewati: tidak ada daftar larang");
  } else {
    const hits = new Set<string>();
    for (const i of synItems) {
      for (const f of input.forbidden) if (containsPhrase(i.item, f)) hits.add(f);
    }
    add(
      CHECK.forbidden,
      hits.size === 0,
      hits.size === 0
        ? `${input.forbidden.length} frasa diperiksa, tidak ada yang muncul`
        : `${hits.size} frasa terlarang muncul`,
    );
  }

  // 4. hari besar yang sama atau nyaris sama (kategori + nominal)
  const synBags = synthetic
    .filter((d) => d.expenses.length >= MIN_SIMILAR_DAY_ITEMS)
    .map((d) => toBag(d.expenses.map((e) => ({ category: e.categoryName, amount: e.amount }))));
  const realBags = real
    .filter((d) => d.items.length >= MIN_SIMILAR_DAY_ITEMS)
    .map((d) => toBag(d.items));
  let maxSim = 0;
  for (const a of synBags) {
    for (const b of realBags) maxSim = Math.max(maxSim, jaccard(a, b));
  }
  add(
    CHECK.days,
    maxSim < SIM_LIMIT,
    `kemiripan tertinggi ${(maxSim * 100).toFixed(0)}% (batas ${SIM_LIMIT * 100}%), ${synBags.length} hari sintesis dengan ${MIN_SIMILAR_DAY_ITEMS}+ item diperiksa`,
  );

  // 5. nominal besar yang khas milik data asli
  const khas = khasAmounts(real);
  const khasHits = synItems.filter((i) => khas.has(i.amount)).length;
  add(
    CHECK.amounts,
    khasHits === 0,
    `${khas.size} nominal khas di data asli, ${khasHits} muncul di sintesis`,
  );

  // 6. pola harian tidak boleh mengikuti data asli (per tanggal kalender maupun per urutan hari)
  const synRows = synthetic.map((d) => ({ date: d.date, total: sum(d.expenses) }));
  const realRows = real.map((d) => ({ date: d.date, total: sum(d.items) })).sort(byDate);
  const synRes = residuals([...synRows].sort(byDate));
  const realRes = residuals(realRows);
  const realByDate = new Map(realRes.map((r) => [r.date, r.v]));
  const shared = synRes.filter((r) => realByDate.has(r.date));
  const rCal =
    shared.length >= 30
      ? pearson(shared.map((r) => r.v), shared.map((r) => realByDate.get(r.date)!))
      : 0;
  const n = Math.min(synRes.length, realRes.length);
  const rIdx =
    n >= 30 ? pearson(synRes.slice(0, n).map((r) => r.v), realRes.slice(0, n).map((r) => r.v)) : 0;
  add(
    CHECK.pattern,
    Math.abs(rCal) <= CORR_LIMIT && Math.abs(rIdx) <= CORR_LIMIT,
    `korelasi pola harian: tanggal sama ${rCal.toFixed(2)}, urutan sama ${rIdx.toFixed(2)} (batas ±${CORR_LIMIT})`,
  );

  // 7. hari termahal tidak boleh jatuh di tanggal yang sama dengan data asli
  const sTop = topOf(synRows);
  const rTop = topOf(realRows);
  add(
    CHECK.topDay,
    sTop.date !== rTop.date,
    sTop.date === rTop.date
      ? "hari termahal sintesis jatuh di tanggal yang sama dengan data asli"
      : "tanggal hari termahal berbeda",
  );

  return checks;
}

// Uji negatif: sengaja merusak dataset, lalu memastikan pemeriksa MENANGKAPNYA.
// Pemeriksa yang tidak pernah bisa gagal tidak berguna.
export function runLeakSelfTest(
  synthetic: SyntheticDay[],
  real: RealDay[],
  input: LeakInput,
): Check[] {
  const out: Check[] = [];
  const record = (name: string, ok: boolean, detail: string) =>
    out.push({ name: `Uji negatif: ${name}`, ok, detail });

  const idx = synthetic.findIndex((d) => d.expenses.length > 0);
  if (idx < 0) {
    return [{ name: "Uji negatif", ok: false, detail: "dataset tidak punya item untuk dimanipulasi" }];
  }

  const run = (
    label: string,
    check: string,
    tamper: ((days: SyntheticDay[]) => void) | null,
    skip: string,
  ) => {
    if (!tamper) return record(label, true, `dilewati: ${skip}`);
    const days = structuredClone(synthetic);
    tamper(days);
    const caught = checkLeaks(days, real, input).some((c) => c.name === check && !c.ok);
    record(label, caught, caught ? "pemeriksa menangkap manipulasi" : "pemeriksa GAGAL menangkap manipulasi");
  };

  const phrases = vocabPhrases(input.vocabulary);
  const counts = realTokenCounts(real);
  const realItems = real.flatMap((d) => d.items);
  const cat = synthetic[idx].expenses[0].categoryName;

  const foreign = realItems.find((i) => !phrases.has(normalizeText(i.item)));
  run(
    "teks item asli disisipkan",
    CHECK.vocab,
    foreign ? (days) => void (days[idx].expenses[0].item = foreign.item) : null,
    "semua item asli kebetulan ada di daftar putih",
  );

  const rareItem = realItems.find((i) =>
    tokensOf(i.item).some((t) => {
      const n = counts.get(t) ?? 0;
      return n >= 1 && n < MIN_GROUP;
    }),
  );
  run(
    "kata langka disisipkan",
    CHECK.rare,
    rareItem ? (days) => void (days[idx].expenses[0].item = rareItem.item) : null,
    "tidak ada kata langka di data asli",
  );

  run(
    "frasa terlarang disisipkan",
    CHECK.forbidden,
    input.forbidden.length > 0
      ? (days) => void (days[idx].expenses[0].item = input.forbidden[0])
      : null,
    "tidak ada daftar larang",
  );

  const bigDay = real.find((d) => d.items.length >= MIN_SIMILAR_DAY_ITEMS);
  run(
    "hari asli disalin",
    CHECK.days,
    bigDay
      ? (days) => {
          days[idx].expenses = bigDay.items.map((i) => ({
            item: "makan",
            amount: i.amount,
            categoryName: i.category,
          }));
        }
      : null,
    `tidak ada hari asli dengan ${MIN_SIMILAR_DAY_ITEMS}+ item`,
  );

  const khas = [...khasAmounts(real)][0];
  run(
    "nominal khas disisipkan",
    CHECK.amounts,
    khas !== undefined ? (days) => void (days[idx].expenses[0].amount = khas) : null,
    "tidak ada nominal khas di data asli",
  );

  const realTotals = new Map(real.map((d) => [d.date, sum(d.items)]));
  const overlap = synthetic.filter((d) => realTotals.has(d.date)).length;
  run(
    "pola harian asli ditempel",
    CHECK.pattern,
    overlap >= 30
      ? (days) => {
          for (const d of days) {
            const t = realTotals.get(d.date);
            if (t === undefined) continue;
            d.expenses = t > 0 ? [{ item: "makan", amount: t, categoryName: cat }] : [];
            d.isEmptyDay = t === 0;
          }
        }
      : null,
    "kurang dari 30 tanggal yang tumpang tindih dengan data asli",
  );

  const realTop = topOf(
    real.map((d) => ({ date: d.date, total: sum(d.items) })),
  );
  const sameIdx = synthetic.findIndex((d) => d.date === realTop.date);
  run(
    "hari termahal disamakan",
    CHECK.topDay,
    sameIdx >= 0
      ? (days) => {
          days[sameIdx].expenses = [{ item: "makan", amount: 900_000_000, categoryName: cat }];
          days[sameIdx].isEmptyDay = false;
        }
      : null,
    "tanggal termahal data asli di luar jendela sintesis",
  );

  return out;
}
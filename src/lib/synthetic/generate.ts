import { addDays } from "@/lib/dates";
import { createRng, deriveSeed } from "./rng";
import { isWeekend } from "./stats";
import { GENERATOR_VERSION, type SyntheticDay, type SyntheticProfile } from "./types";
import type { Vocabulary } from "./vocabulary";

const MIN_AMOUNT = 1_000;

// di bawah Rp100.000 dibulatkan ke 500, selebihnya ke 1.000
function roundAmount(x: number) {
  const step = x < 100_000 ? 500 : 1_000;
  return Math.max(MIN_AMOUNT, Math.round(x / step) * step);
}

const rankWeights = (n: number) => Array.from({ length: n }, (_, i) => 1 / (1 + i * 0.35));

export function generateSynthetic(
  profile: SyntheticProfile,
  opts: { seed: number; endDate: string; vocabulary: Vocabulary },
): SyntheticDay[] {
  if (profile.generatorVersion !== GENERATOR_VERSION) {
    throw new Error(
      `Profil dibuat oleh generator versi ${profile.generatorVersion}, sedangkan generator saat ini versi ${GENERATOR_VERSION}.`,
    );
  }
  const vocab = opts.vocabulary;
  for (const c of profile.categories) {
    if (!vocab.regular[c.name]?.length) {
      throw new Error(`Kosakata untuk kategori "${c.name}" belum ada.`);
    }
  }
  for (const c of profile.spikes?.categories ?? []) {
    if (!vocab.big[c.name]?.length) {
      throw new Error(`Kosakata pembelian besar untuk kategori "${c.name}" belum ada.`);
    }
  }

  const rng = createRng(deriveSeed(opts.seed, "generate"));
  const startDate = addDays(opts.endDate, -(profile.days - 1));
  const catWeights = profile.categories.map((c) => c.weight);
  const pickItem = (list: string[]) => list[rng.weighted(rankWeights(list.length))];
  const regularCeiling = profile.spikes ? profile.spikes.minAmount - 1_000 : Infinity;
  
  const days: SyntheticDay[] = [];
  for (let i = 0; i < profile.days; i++) {
    const date = addDays(startDate, i);
    const weekend = isWeekend(date);
    const empty = rng.next() < (weekend ? profile.emptyRate.weekend : profile.emptyRate.weekday);

    const expenses: SyntheticDay["expenses"] = [];
    if (!empty) {
      const dist = weekend ? profile.itemsPerDay.weekend : profile.itemsPerDay.weekday;
      const n = dist.values[rng.weighted(dist.weights)];
      for (let k = 0; k < n; k++) {
        const cat = profile.categories[rng.weighted(catWeights)];
        const raw = Math.exp(cat.mu + cat.sigma * rng.normal());
        const capped = Math.min(raw, Math.exp(cat.mu + 2.5 * cat.sigma));
        expenses.push({
          item: pickItem(vocab.regular[cat.name]),
          amount: Math.min(roundAmount(capped), regularCeiling),
          categoryName: cat.name,
        });
      }
    }
    days.push({ date, isEmptyDay: empty, expenses });
  }

  // lonjakan: pembelian besar di hari acak (hari kosong yang kena jadi berpengeluaran)
  if (profile.spikes) {
    const sp = profile.spikes;
    const spikeWeights = sp.categories.map((c) => c.weight);
    const count = Math.min(sp.count, days.length);
    const chosen = rng
      .shuffle(days.map((_, i) => i))
      .slice(0, count)
      .sort((a, b) => a - b);

    for (const idx of chosen) {
      const cat = sp.categories[rng.weighted(spikeWeights)];
      const amount = roundAmount(
        Math.exp(rng.uniform(Math.log(sp.minAmount), Math.log(sp.maxAmount))),
      );
      days[idx].expenses.push({
        item: pickItem(vocab.big[cat.name]),
        amount,
        categoryName: cat.name,
      });
      days[idx].isEmptyDay = false;
    }
  }

  return days;
}
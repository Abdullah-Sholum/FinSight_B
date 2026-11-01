// Naikkan versi ini kalau urutan penarikan acak atau rumus generator berubah.
export const GENERATOR_VERSION = "4";

export type PrivacyLevel = "LOW" | "BALANCED" | "HIGH";

// Satu hari data asli, TANPA teks item (nama item tidak pernah dibaca).
export type DayRecord = {
  date: string; // YYYY-MM-DD
  isEmptyDay: boolean;
  items: { category: string; amount: number }[];
};

export type Dist = { values: number[]; weights: number[] };

export type SyntheticProfile = {
  schemaVersion: 1;
  generatorVersion: string;
  privacy: PrivacyLevel;
  noise: number;
  days: number;
  emptyRate: { weekday: number; weekend: number };
  itemsPerDay: { weekday: Dist; weekend: Dist };
  categories: { name: string; weight: number; mu: number; sigma: number }[];
  spikes: {
    count: number;
    minAmount: number;
    maxAmount: number;
    categories: { name: string; weight: number }[];
  } | null;
  // untuk ditinjau admin; tidak dipakai generator
  review: { excluded: string[]; droppedCategories: string[]; minGroupSize: number };
};

export type SyntheticDay = {
  date: string;
  isEmptyDay: boolean;
  expenses: { item: string; amount: number; categoryName: string }[];
};
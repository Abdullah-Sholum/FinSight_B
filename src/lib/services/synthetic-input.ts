import { normalizeText } from "@/lib/categorize";
import { REAL_DATASET_NAME } from "@/lib/import/commit";
import { prisma } from "@/lib/prisma";
import type { DayRecord } from "@/lib/synthetic/types";
import fs from "node:fs";
import path from "node:path";
import type { RealDay } from "@/lib/synthetic/leak";

async function realDatasetId() {
  const ds = await prisma.dataset.findUnique({
    where: { name: REAL_DATASET_NAME },
    select: { id: true },
  });
  if (!ds) throw new Error("Dataset 'Data Asli' belum ada.");
  return ds.id;
}

// Kolom item SENGAJA tidak diambil: pembangun profil tidak pernah melihat teks.
export async function loadDayRecords(): Promise<DayRecord[]> {
  const datasetId = await realDatasetId();
  const rows = await prisma.$queryRaw<
    { date: string; isEmptyDay: boolean; category: string | null; amount: number | null }[]
  >`
    SELECT d."date"::text AS "date",
           d."isEmptyDay" AS "isEmptyDay",
           c."name" AS "category",
           e."amount"::int AS "amount"
    FROM daily_entries d
    LEFT JOIN expenses e ON e."entryId" = d."id"
    LEFT JOIN categories c ON c."id" = e."categoryId"
    WHERE d."datasetId" = ${datasetId}
    ORDER BY d."date", e."id"
  `;

  const byDate = new Map<string, DayRecord>();
  for (const r of rows) {
    const rec = byDate.get(r.date) ?? { date: r.date, isEmptyDay: r.isEmptyDay, items: [] };
    if (r.category !== null && r.amount !== null) {
      rec.items.push({ category: r.category, amount: r.amount });
    }
    byDate.set(r.date, rec);
  }
  return [...byDate.values()];
}

// Hanya untuk memeriksa kosakata: seberapa sering tiap kata muncul di data asli.
export async function loadTokenCounts(): Promise<Map<string, number>> {
  const datasetId = await realDatasetId();
  const rows = await prisma.expense.findMany({ where: { datasetId }, select: { item: true } });
  const counts = new Map<string, number>();
  for (const { item } of rows) {
    for (const t of normalizeText(item).split(" ")) {
      if (!/[a-z]/.test(t)) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return counts;
}

// SENGAJA membaca teks item: hanya untuk uji kebocoran, tidak pernah oleh pembangun profil.
export async function loadRealForLeak(): Promise<RealDay[]> {
  const datasetId = await realDatasetId();
  const rows = await prisma.$queryRaw<
    {
      date: string;
      isEmptyDay: boolean;
      item: string | null;
      category: string | null;
      amount: number | null;
    }[]
  >`
    SELECT d."date"::text AS "date",
           d."isEmptyDay" AS "isEmptyDay",
           e."item" AS "item",
           c."name" AS "category",
           e."amount"::int AS "amount"
    FROM daily_entries d
    LEFT JOIN expenses e ON e."entryId" = d."id"
    LEFT JOIN categories c ON c."id" = e."categoryId"
    WHERE d."datasetId" = ${datasetId}
    ORDER BY d."date", e."id"
  `;

  const byDate = new Map<string, RealDay>();
  for (const r of rows) {
    const day = byDate.get(r.date) ?? { date: r.date, isEmptyDay: r.isEmptyDay, items: [] };
    if (r.item !== null && r.category !== null && r.amount !== null) {
      day.items.push({ item: r.item, category: r.category, amount: r.amount });
    }
    byDate.set(r.date, day);
  }
  return [...byDate.values()];
}

// Opsional: forbidden-words.txt di folder privat, satu frasa per baris, # untuk komentar.
export function loadForbiddenPhrases(): string[] {
  const dir = process.env.PRIVATE_DATA_DIR;
  if (!dir) return [];
  try {
    const text = fs.readFileSync(path.join(dir, "forbidden-words.txt"), "utf-8");
    const phrases = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map(normalizeText)
      .filter(Boolean);
    return [...new Set(phrases)];
  } catch {
    return [];
  }
}
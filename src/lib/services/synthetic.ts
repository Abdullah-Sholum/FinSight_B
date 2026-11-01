import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/lib/db-errors";
import { todayInJakarta } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { checkPlausibility } from "@/lib/synthetic/checks";
import { readConfig, type DraftConfig } from "@/lib/synthetic/config";
import { generateSynthetic } from "@/lib/synthetic/generate";
import { checkLeaks, runLeakSelfTest } from "@/lib/synthetic/leak";
import { buildProfile } from "@/lib/synthetic/profile";
import { computeStats, contentFingerprint, toRecords } from "@/lib/synthetic/stats";
import type {
  PrivacyLevel,
  SyntheticDay,
  SyntheticProfile,
} from "@/lib/synthetic/types";
import { VOCABULARY } from "@/lib/synthetic/vocabulary";
import { DomainError } from "./errors";
import {
  loadDayRecords,
  loadForbiddenPhrases,
  loadRealForLeak,
} from "./synthetic-input";

const MAX_SYNTHETIC_DATASETS = 20;
const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
const toJson = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

function plausibilityReport(profile: SyntheticProfile, days: SyntheticDay[]) {
  const checks = checkPlausibility(profile, days);
  return { passed: checks.every((c) => c.ok), checks, at: new Date().toISOString() };
}

async function leakReport(days: SyntheticDay[]) {
  const real = await loadRealForLeak();
  const forbidden = loadForbiddenPhrases();
  const input = { vocabulary: VOCABULARY, forbidden };
  const checks = checkLeaks(days, real, input);
  const selfTest = runLeakSelfTest(days, real, input);
  return {
    passed: checks.every((c) => c.ok) && selfTest.every((c) => c.ok),
    checks,
    selfTest,
    forbiddenListUsed: forbidden.length > 0,
    at: new Date().toISOString(),
  };
}

export async function createDraft(input: {
  seed: number | null;
  privacy: PrivacyLevel;
  endDate: string | null;
}) {
  const today = todayInJakarta();
  const endDate = input.endDate ?? today;
  if (endDate > today) throw new DomainError("Tanggal akhir tidak boleh di masa depan.");
  const seed = input.seed ?? randomInt(0, 2_147_483_647);

  const existing = await prisma.dataset.count({ where: { type: "SYNTHETIC" } });
  if (existing >= MAX_SYNTHETIC_DATASETS) {
    throw new DomainError(`Sudah ada ${existing} dataset sintesis. Hapus yang lama dulu.`);
  }

  let profile: SyntheticProfile;
  let days: SyntheticDay[];
  try {
    const records = await loadDayRecords();
    profile = buildProfile(records, { privacy: input.privacy, seed });
    days = generateSynthetic(profile, { seed, endDate, vocabulary: VOCABULARY });
  } catch (e) {
    // pesan dari pembangun profil dan generator tidak memuat data
    throw new DomainError((e as Error).message);
  }

  const now = new Date().toISOString();
  const s = computeStats(toRecords(days));
  const config: DraftConfig = {
    version: 1,
    generatorVersion: profile.generatorVersion,
    privacy: input.privacy,
    seed,
    endDate,
    profile,
    contentFingerprint: contentFingerprint(days),
    stats: { days: s.days, emptyDays: s.emptyDays, items: s.items, total: s.total },
    integrity: { ok: true, at: now },
    plausibility: plausibilityReport(profile, days),
    leak: await leakReport(days),
  };

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  const idByName = new Map(categories.map((c) => [c.name, c.id]));
  const missing = [
    ...new Set(days.flatMap((d) => d.expenses.map((e) => e.categoryName))),
  ].filter((n) => !idByName.has(n));
  if (missing.length > 0) {
    throw new DomainError(`Kategori tidak ada di database: ${missing.join(", ")}`);
  }

  const stamp = now.replace(/[-:T]/g, "").slice(0, 14);
  const name = `Sintesis ${seed} ${stamp}`;

  try {
    const dataset = await prisma.$transaction(
      async (tx) => {
        const ds = await tx.dataset.create({
          data: { name, type: "SYNTHETIC", seed, isPublished: false, config: toJson(config) },
        });
        await tx.dailyEntry.createMany({
          data: days.map((d) => ({
            datasetId: ds.id,
            date: toDate(d.date),
            isEmptyDay: d.isEmptyDay,
          })),
        });
        const entries = await tx.dailyEntry.findMany({
          where: { datasetId: ds.id },
          select: { id: true, date: true },
        });
        const entryIdByDate = new Map(
          entries.map((e) => [e.date.toISOString().slice(0, 10), e.id]),
        );
        const expenses = days.flatMap((d) =>
          d.expenses.map((e) => ({
            datasetId: ds.id,
            entryId: entryIdByDate.get(d.date)!,
            date: toDate(d.date),
            item: e.item,
            amount: e.amount,
            categoryId: idByName.get(e.categoryName)!,
            categorySource: "IMPORT" as const,
          })),
        );
        for (let i = 0; i < expenses.length; i += 1000) {
          await tx.expense.createMany({ data: expenses.slice(i, i + 1000) });
        }
        return ds;
      },
      { timeout: 60_000 },
    );
    return {
      id: dataset.id,
      name,
      passed: config.plausibility.passed && config.leak.passed,
    };
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("Nama dataset bentrok, coba lagi.");
    throw e;
  }
}

async function getSyntheticConfig(id: number) {
  const dataset = await prisma.dataset.findUnique({
    where: { id },
    select: { id: true, type: true, isPublished: true, config: true },
  });
  if (!dataset || dataset.type !== "SYNTHETIC") {
    throw new DomainError("Dataset sintesis tidak ditemukan.");
  }
  const config = readConfig(dataset.config);
  if (!config) {
    throw new DomainError("Konfigurasi dataset tidak terbaca. Hapus dan buat ulang.");
  }
  return { dataset, config };
}

async function loadSyntheticDays(datasetId: number) {
  const [entries, expenses] = await Promise.all([
    prisma.dailyEntry.findMany({
      where: { datasetId },
      orderBy: { date: "asc" },
      select: { id: true, date: true, isEmptyDay: true },
    }),
    prisma.expense.findMany({
      where: { datasetId },
      orderBy: { id: "asc" },
      select: {
        entryId: true,
        item: true,
        amount: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const byEntry = new Map<number, SyntheticDay["expenses"]>();
  let orphans = 0;
  for (const e of expenses) {
    if (e.entryId === null) {
      orphans++;
      continue;
    }
    const list = byEntry.get(e.entryId) ?? [];
    list.push({ item: e.item, amount: e.amount, categoryName: e.category.name });
    byEntry.set(e.entryId, list);
  }
  const days: SyntheticDay[] = entries.map((en) => ({
    date: en.date.toISOString().slice(0, 10),
    isEmptyDay: en.isEmptyDay,
    expenses: byEntry.get(en.id) ?? [],
  }));
  return { days, orphans };
}

// Menghitung ulang SEMUA pemeriksaan terhadap isi database saat ini dan menyimpan laporannya.
export async function verifyDataset(id: number) {
  const { dataset, config } = await getSyntheticConfig(id);
  const { days, orphans } = await loadSyntheticDays(id);

  const integrityOk = orphans === 0 && contentFingerprint(days) === config.contentFingerprint;
  const plausibility = plausibilityReport(config.profile, days);
  const leak = await leakReport(days);
  const passed = integrityOk && plausibility.passed && leak.passed;

  // dataset terbit yang gagal diperiksa ulang otomatis ditarik dari publik
  const withdrawn = !passed && dataset.isPublished;
  const next: DraftConfig = {
    ...config,
    integrity: { ok: integrityOk, at: new Date().toISOString() },
    plausibility,
    leak,
  };
  await prisma.dataset.update({
    where: { id },
    data: {
      config: toJson(next),
      ...(withdrawn ? { isPublished: false, publishedAt: null } : {}),
    },
  });

  return { passed, integrityOk, plausibilityPassed: plausibility.passed, leakPassed: leak.passed, withdrawn };
}

export async function publishDataset(id: number) {
  const { dataset } = await getSyntheticConfig(id);
  if (dataset.isPublished) throw new DomainError("Dataset ini sudah terbit.");

  const v = await verifyDataset(id);
  if (!v.passed) {
    throw new DomainError(
      "Dataset belum lulus pemeriksaan (integritas, kewajaran, atau kebocoran). Lihat laporan di halaman detail.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.dataset.updateMany({
      where: { isPublished: true },
      data: { isPublished: false, publishedAt: null },
    });
    await tx.dataset.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
    });
  });
}

export async function unpublishDataset(id: number) {
  const dataset = await prisma.dataset.findUnique({
    where: { id },
    select: { type: true, isPublished: true },
  });
  if (!dataset || dataset.type !== "SYNTHETIC") {
    throw new DomainError("Dataset sintesis tidak ditemukan.");
  }
  if (!dataset.isPublished) throw new DomainError("Dataset ini tidak sedang terbit.");
  await prisma.dataset.update({
    where: { id },
    data: { isPublished: false, publishedAt: null },
  });
}

export async function deleteDataset(id: number) {
  const dataset = await prisma.dataset.findUnique({
    where: { id },
    select: { type: true, isPublished: true },
  });
  if (!dataset || dataset.type !== "SYNTHETIC") {
    throw new DomainError("Hanya dataset sintesis yang bisa dihapus di sini.");
  }
  if (dataset.isPublished) {
    throw new DomainError("Tarik dataset dari publik dulu sebelum menghapusnya.");
  }
  await prisma.dataset.delete({ where: { id } });
}
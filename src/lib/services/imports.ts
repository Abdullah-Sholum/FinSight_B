import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { todayInJakarta } from "@/lib/dates";
import {
  commitPlan,
  getOrCreateRealDataset,
  REAL_DATASET_NAME,
} from "@/lib/import/commit";
import { parseCsv } from "@/lib/import/parse";
import { buildPlan } from "@/lib/import/plan";
import type { ImportReport, RollbackImpact } from "@/lib/import-types";
import { prisma } from "@/lib/prisma";
import { DomainError } from "./errors";

function cleanFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "import.csv";
  return base.replace(/[^\w.\- ()]/g, "_").slice(0, 100) || "import.csv";
}

async function analyze(text: string, fileName: string) {
  const parsed = parseCsv(text);

  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
  });
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

  const dataset = await prisma.dataset.findUnique({
    where: { name: REAL_DATASET_NAME },
    select: { id: true },
  });
  const existing = dataset
    ? await prisma.dailyEntry.findMany({
        where: { datasetId: dataset.id },
        select: { date: true },
      })
    : [];
  const existingDates = new Set(
    existing.map((e) => e.date.toISOString().slice(0, 10)),
  );

  const plan = buildPlan({
    rows: parsed.rows,
    parseErrors: parsed.errors,
    totalRows: parsed.totalRows,
    categoryIdByName,
    existingDates,
    maxDate: todayInJakarta(),
  });

  // sidik jari dari apa yang AKAN disimpan
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        parsed.totalRows,
        plan.errors.length,
        plan.days.map((d) => [
          d.date,
          d.isEmptyDay,
          d.expenses.map((e) => [e.legacyId, e.amount, e.categoryId]),
        ]),
      ]),
    )
    .digest("hex");

  const s = plan.stats;
  const report: ImportReport = {
    fileName: cleanFileName(fileName),
    digest,
    totalRows: s.totalRows,
    importedDays: s.importedDays,
    expenseDays: s.expenseDays,
    emptyDays: s.emptyDays,
    expenseCount: s.expenseCount,
    totalAmount: s.totalAmount,
    uncategorizedPct: s.uncategorizedPct,
    skippedExistingDates: plan.skippedExistingDates.length,
    rejectedDates: plan.rejectedDates.length,
    gapDates: plan.gapDates.length,
    perCategory: [...s.perCategory]
      .map(([name, c]) => ({ name, count: c.count, amount: c.amount }))
      .sort((a, b) => b.amount - a.amount),
    errors: plan.errors.slice(0, 50).map((e) => ({
      line: e.line,
      legacyId: e.legacyId,
      date: e.date,
      message: e.message,
    })),
    errorCount: plan.errors.length,
  };

  return { report, plan, parsed };
}

export async function analyzeImport(text: string, fileName: string) {
  const { report } = await analyze(text, fileName);
  return report;
}

export async function commitImport(opts: {
  text: string;
  fileName: string;
  digest: string;
  allowErrors: boolean;
}) {
  const { report, plan, parsed } = await analyze(opts.text, opts.fileName);

  if (report.digest !== opts.digest) {
    throw new DomainError(
      "Data atau file berubah sejak laporan dibuat. Periksa file lagi sebelum menyimpan.",
    );
  }
  if (plan.errors.length > 0 && !opts.allowErrors) {
    throw new DomainError(
      "Masih ada error. Perbaiki CSV, atau centang opsi menyimpan hari yang valid saja.",
    );
  }
  if (plan.days.length === 0) {
    throw new DomainError("Tidak ada hari baru untuk diimpor.");
  }

  const dataset = await getOrCreateRealDataset();
  try {
    const batch = await commitPlan({
      datasetId: dataset.id,
      fileName: report.fileName,
      totalRows: parsed.totalRows,
      plan: { ...plan, errors: plan.errors.slice(0, 200) },
    });
    return {
      batchId: batch.id,
      days: plan.days.length,
      items: plan.stats.expenseCount,
    };
  } catch (e) {
    console.error("commitImport gagal:", e);
    throw new DomainError(
      "Penyimpanan gagal dan dibatalkan sepenuhnya: tidak ada data yang berubah. Percobaan dicatat di riwayat dengan status Gagal.",
    );
  }
}

// ---------- pembatalan batch ----------

const scope = (id: number): Prisma.ExpenseWhereInput => ({
  OR: [{ importBatchId: id }, { entry: { importBatchId: id } }],
});

export async function getRollbackImpact(id: number): Promise<RollbackImpact> {
  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) throw new DomainError("Batch tidak ditemukan.");
  if (batch.status !== "COMPLETED") {
    throw new DomainError(`Batch berstatus ${batch.status}, tidak bisa dibatalkan.`);
  }

  const [entries, expenses, fromBatch, manual] = await Promise.all([
    prisma.dailyEntry.count({ where: { importBatchId: id } }),
    prisma.expense.count({ where: scope(id) }),
    prisma.expense.count({ where: { importBatchId: id } }),
    prisma.expense.count({
      where: { AND: [scope(id), { categorySource: "MANUAL" }] },
    }),
  ]);

  return {
    batchId: id,
    fileName: batch.fileName,
    entries,
    expenses,
    laterAdded: Math.max(0, expenses - fromBatch),
    manual,
  };
}

export async function rollbackBatch(id: number) {
  return prisma.$transaction(
    async (tx) => {
      const batch = await tx.importBatch.findUnique({ where: { id } });
      if (!batch) throw new DomainError("Batch tidak ditemukan.");
      if (batch.status !== "COMPLETED") {
        throw new DomainError(`Batch berstatus ${batch.status}, tidak bisa dibatalkan.`);
      }

      // item dulu (sebelum catatan hari), karena cakupannya bergantung pada catatan hari
      const expenses = await tx.expense.deleteMany({ where: scope(id) });
      const entries = await tx.dailyEntry.deleteMany({
        where: { importBatchId: id },
      });
      await tx.importBatch.update({
        where: { id },
        data: { status: "ROLLED_BACK" },
      });

      return {
        expenses: expenses.count,
        entries: entries.count,
        fileName: batch.fileName,
      };
    },
    { timeout: 60_000 },
  );
}
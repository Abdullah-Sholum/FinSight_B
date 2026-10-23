import { prisma } from "@/lib/prisma";
import type { buildPlan } from "./plan";

type Plan = ReturnType<typeof buildPlan>;

export const REAL_DATASET_NAME = "Data Asli";

const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function getOrCreateRealDataset() {
  return prisma.dataset.upsert({
    where: { name: REAL_DATASET_NAME },
    update: {},
    create: { name: REAL_DATASET_NAME, type: "REAL", isPublished: false },
  });
}

export async function commitPlan(opts: {
  datasetId: number;
  fileName: string;
  totalRows: number;
  plan: Plan;
}) {
  const { datasetId, fileName, totalRows, plan } = opts;
  const successRows = plan.stats.expenseCount + plan.stats.emptyDays;
  const failedRows = plan.stats.errorRows;

  try {
    return await prisma.$transaction(
      async (tx) => {
        const batch = await tx.importBatch.create({
          data: {
            datasetId,
            fileName,
            status: "COMPLETED",
            totalRows,
            successRows,
            failedRows,
            // lewat JSON agar properti undefined terbuang
            errors: plan.errors.length
              ? JSON.parse(JSON.stringify(plan.errors))
              : undefined,
          },
        });

        await tx.dailyEntry.createMany({
          data: plan.days.map((d) => ({
            datasetId,
            date: toDate(d.date),
            isEmptyDay: d.isEmptyDay,
            importBatchId: batch.id,
          })),
        });

        const entries = await tx.dailyEntry.findMany({
          where: { importBatchId: batch.id },
          select: { id: true, date: true },
        });
        const entryIdByDate = new Map(
          entries.map((e) => [e.date.toISOString().slice(0, 10), e.id]),
        );

        const expenses = plan.days.flatMap((d) =>
          d.expenses.map((e) => ({
            datasetId,
            entryId: entryIdByDate.get(d.date)!,
            date: toDate(d.date),
            item: e.item,
            amount: e.amount,
            categoryId: e.categoryId,
            categorySource: "IMPORT" as const,
            legacyId: e.legacyId,
            importBatchId: batch.id,
          })),
        );

        for (const part of chunk(expenses, 1000)) {
          await tx.expense.createMany({ data: part });
        }

        return batch;
      },
      { timeout: 60_000 },
    );
  } catch (e) {
    // dicatat DI LUAR transaksi, karena transaksi yang batal ikut membatalkan catatannya
    const code = (e as { code?: string }).code ?? (e as Error).name;
    await prisma.importBatch.create({
      data: {
        datasetId,
        fileName,
        status: "FAILED",
        totalRows,
        successRows: 0,
        failedRows: totalRows,
        errors: [{ message: "Transaksi gagal", code }],
      },
    });
    throw e;
  }
}
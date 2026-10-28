import { buildMatcher } from "@/lib/categorize";
import { todayInJakarta } from "@/lib/dates";
import { getOrCreateRealDataset } from "@/lib/import/commit";
import { prisma } from "@/lib/prisma";
import { DomainError } from "./errors";

const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
const toISODate = (d: Date) => d.toISOString().slice(0, 10);

function assertNotFuture(date: string) {
  if (date > todayInJakarta()) {
    throw new DomainError("Tanggal di masa depan tidak bisa dicatat.");
  }
}

type Resolved = {
  categoryId: number;
  source: "RULE" | "MANUAL";
  ruleId: number | null;
};

async function createResolver() {
  const [categories, rules] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true, isSystem: true } }),
    prisma.categoryRule.findMany({
      where: { isActive: true },
      select: {
        id: true,
        keyword: true,
        priority: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const idByName = new Map(categories.map((c) => [c.name, c.id]));
  const uncategorizedId = idByName.get("Uncategorized");
  if (!uncategorizedId) {
    throw new DomainError('Kategori "Uncategorized" tidak ditemukan. Jalankan seed kategori.');
  }

  const match = buildMatcher(
    rules.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      priority: r.priority,
      categoryName: r.category.name,
    })),
  );

  return {
    uncategorizedId,
    explicit(categoryId: number): Resolved {
      const c = byId.get(categoryId);
      if (!c) throw new DomainError("Kategori tidak ditemukan.");
      if (c.isSystem) {
        throw new DomainError("Pilih kategori selain Uncategorized, atau gunakan Otomatis.");
      }
      return { categoryId, source: "MANUAL", ruleId: null };
    },
    auto(item: string): Resolved {
      const m = match(item);
      return {
        categoryId: (m && idByName.get(m.categoryName)) || uncategorizedId,
        source: "RULE",
        ruleId: m?.ruleId ?? null,
      };
    },
  };
}

export async function addExpenses(
  date: string,
  rows: { item: string; amount: number; categoryId: number | null }[],
) {
  assertNotFuture(date);
  if (rows.length === 0) throw new DomainError("Isi minimal satu baris pengeluaran.");
  if (rows.length > 100) throw new DomainError("Maksimal 100 baris sekali simpan.");

  const dataset = await getOrCreateRealDataset();
  const resolver = await createResolver();
  const resolved = rows.map((r) => ({
    ...r,
    ...(r.categoryId ? resolver.explicit(r.categoryId) : resolver.auto(r.item)),
  }));

  await prisma.$transaction(async (tx) => {
    // upsert: membuat catatan hari bila belum ada, dan mematikan penanda "kosong" bila ada
    const entry = await tx.dailyEntry.upsert({
      where: { datasetId_date: { datasetId: dataset.id, date: toDate(date) } },
      update: { isEmptyDay: false },
      create: { datasetId: dataset.id, date: toDate(date), isEmptyDay: false },
    });

    await tx.expense.createMany({
      data: resolved.map((r) => ({
        datasetId: dataset.id,
        entryId: entry.id,
        date: toDate(date),
        item: r.item,
        amount: r.amount,
        categoryId: r.categoryId,
        categorySource: r.source,
        ruleId: r.ruleId,
      })),
    });
  });

  return {
    count: resolved.length,
    uncategorized: resolved.filter((r) => r.categoryId === resolver.uncategorizedId).length,
  };
}

export async function updateExpense(
  id: number,
  input: { item: string; amount: number; categoryId: number | null },
) {
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { dataset: { select: { type: true } } },
  });
  if (!expense) throw new DomainError("Item tidak ditemukan.");
  if (expense.dataset.type !== "REAL") {
    throw new DomainError("Hanya data asli yang bisa diubah di sini.");
  }

  let category: { categoryId: number; categorySource: "IMPORT" | "RULE" | "MANUAL"; ruleId: number | null };
  if (input.categoryId === null) {
    const r = (await createResolver()).auto(input.item);
    category = { categoryId: r.categoryId, categorySource: r.source, ruleId: r.ruleId };
  } else if (input.categoryId === expense.categoryId) {
    // tidak diubah: asal kategori dipertahankan
    category = {
      categoryId: expense.categoryId,
      categorySource: expense.categorySource,
      ruleId: expense.ruleId,
    };
  } else {
    const r = (await createResolver()).explicit(input.categoryId);
    category = { categoryId: r.categoryId, categorySource: r.source, ruleId: r.ruleId };
  }

  await prisma.expense.update({
    where: { id },
    data: { item: input.item, amount: input.amount, ...category },
  });
  return { date: toISODate(expense.date) };
}

export async function deleteExpense(id: number, whenLast?: "empty" | "remove" | null) {
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findUnique({
      where: { id },
      include: { dataset: { select: { type: true } } },
    });
    if (!expense) throw new DomainError("Item tidak ditemukan.");
    if (expense.dataset.type !== "REAL") {
      throw new DomainError("Hanya data asli yang bisa diubah di sini.");
    }

    await tx.expense.delete({ where: { id } });

    if (expense.entryId !== null) {
      const remaining = await tx.expense.count({ where: { entryId: expense.entryId } });
      if (remaining === 0) {
        if (!whenLast) {
          // melempar di dalam transaksi membatalkan penghapusan tadi
          throw new DomainError(
            "Ini item terakhir pada hari itu. Pilih: tandai hari kosong, atau hapus catatan hari.",
          );
        }
        if (whenLast === "empty") {
          await tx.dailyEntry.update({
            where: { id: expense.entryId },
            data: { isEmptyDay: true },
          });
        } else {
          await tx.dailyEntry.delete({ where: { id: expense.entryId } });
        }
      }
    }
    return { date: toISODate(expense.date) };
  });
}

export async function markEmptyDay(date: string) {
  assertNotFuture(date);
  const dataset = await getOrCreateRealDataset();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.dailyEntry.findUnique({
      where: { datasetId_date: { datasetId: dataset.id, date: toDate(date) } },
    });
    if (existing) {
      const n = await tx.expense.count({ where: { entryId: existing.id } });
      if (n > 0) {
        throw new DomainError(
          "Tanggal ini sudah punya pengeluaran. Hapus semua itemnya dulu kalau memang kosong.",
        );
      }
      if (!existing.isEmptyDay) {
        await tx.dailyEntry.update({ where: { id: existing.id }, data: { isEmptyDay: true } });
      }
    } else {
      await tx.dailyEntry.create({
        data: { datasetId: dataset.id, date: toDate(date), isEmptyDay: true },
      });
    }
  });
}

export async function clearEmptyDay(date: string) {
  const dataset = await getOrCreateRealDataset();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.dailyEntry.findUnique({
      where: { datasetId_date: { datasetId: dataset.id, date: toDate(date) } },
    });
    if (!existing) return;
    if (!existing.isEmptyDay) throw new DomainError("Catatan ini bukan hari kosong.");
    const n = await tx.expense.count({ where: { entryId: existing.id } });
    if (n > 0) throw new DomainError("Tanggal ini punya pengeluaran, tidak bisa dihapus.");
    await tx.dailyEntry.delete({ where: { id: existing.id } });
  });
}
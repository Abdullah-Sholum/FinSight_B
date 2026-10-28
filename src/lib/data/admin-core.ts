import { prisma } from "@/lib/prisma";
import { REAL_DATASET_NAME } from "@/lib/import/commit";
import * as insights from "./insights";
import type { DateRange } from "./insights";
import { isMonthKey, shiftMonth } from "@/lib/dates";
import { isRealDate } from "@/lib/validation/import-row";

export async function getRealDataset() {
  return prisma.dataset.findUnique({
    where: { name: REAL_DATASET_NAME },
    select: { id: true, name: true },
  });
}

export async function getAdminOverview(range: DateRange = {}) {
  const ds = await getRealDataset();
  if (!ds) return null;

  const [summary, months, categories, weekdayWeekend, topDays, topItems, quality] =
    await Promise.all([
      insights.getSummary(ds.id, range),
      insights.getMonthlyTotals(ds.id, range),
      insights.getCategoryComposition(ds.id, range),
      insights.getWeekdayVsWeekend(ds.id, range),
      insights.getTopDays(ds.id, range, 5),
      insights.getTopItems(ds.id, range, 10),
      insights.getDataQuality(ds.id, range),
    ]);

  return {
    dataset: ds,
    summary,
    months,
    categories,
    weekdayWeekend,
    topDays,
    topItems,
    quality,
  };
}

export async function getCategoriesWithStats() {
  const [categories, usage] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { rules: true, expenses: true } } },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { dataset: { type: "REAL" } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);
  const byId = new Map(usage.map((u) => [u.categoryId, u]));

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    isSystem: c.isSystem,
    ruleCount: c._count.rules,
    totalExpenseCount: c._count.expenses, // semua dataset, dipakai untuk aturan hapus
    realItems: byId.get(c.id)?._count._all ?? 0,
    realTotal: byId.get(c.id)?._sum.amount ?? 0,
  }));
}

const dayStart = (s: string) => new Date(`${s}T00:00:00.000Z`);

export async function getDayDetail(date: string) {
  if (!isRealDate(date)) throw new Error("Tanggal tidak valid");
  const ds = await getRealDataset();
  const entry = ds
    ? await prisma.dailyEntry.findUnique({
        where: { datasetId_date: { datasetId: ds.id, date: dayStart(date) } },
        select: { id: true, isEmptyDay: true },
      })
    : null;

  const rows = entry
    ? await prisma.expense.findMany({
        where: { entryId: entry.id },
        orderBy: { id: "asc" },
        select: {
          id: true,
          item: true,
          amount: true,
          categoryId: true,
          categorySource: true,
          category: { select: { name: true, color: true } },
        },
      })
    : [];

  const expenses = rows.map((e) => ({
    id: e.id,
    item: e.item,
    amount: e.amount,
    categoryId: e.categoryId,
    categoryName: e.category.name,
    categoryColor: e.category.color,
    source: e.categorySource,
  }));
  return { date, entry, expenses, total: expenses.reduce((a, e) => a + e.amount, 0) };
}

export async function getEntriesOfMonth(month: string) {
  if (!isMonthKey(month)) throw new Error("Bulan tidak valid");
  const ds = await getRealDataset();
  if (!ds) return { month, rows: [], monthTotal: 0 };

  const start = `${month}-01`;
  const end = `${shiftMonth(month, 1)}-01`;

  const rows = await prisma.$queryRaw<
    { date: string; isEmptyDay: boolean; items: number; total: number }[]
  >`
    SELECT d."date"::text AS "date",
           d."isEmptyDay" AS "isEmptyDay",
           COALESCE(x.items, 0)::int AS "items",
           COALESCE(x.total, 0)::float8 AS "total"
    FROM daily_entries d
    LEFT JOIN (
      SELECT e."entryId", COUNT(*) AS items, SUM(e.amount) AS total
      FROM expenses e
      WHERE e."datasetId" = ${ds.id}
      GROUP BY e."entryId"
    ) x ON x."entryId" = d.id
    WHERE d."datasetId" = ${ds.id}
      AND d."date" >= ${start}::date
      AND d."date" < ${end}::date
    ORDER BY d."date" DESC
  `;
  return { month, rows, monthTotal: rows.reduce((a, r) => a + r.total, 0) };
}

export async function getEntryBounds() {
  const ds = await getRealDataset();
  if (!ds) return { first: null as string | null, last: null as string | null };
  const agg = await prisma.dailyEntry.aggregate({
    where: { datasetId: ds.id },
    _min: { date: true },
    _max: { date: true },
  });
  return {
    first: agg._min.date ? agg._min.date.toISOString().slice(0, 10) : null,
    last: agg._max.date ? agg._max.date.toISOString().slice(0, 10) : null,
  };
}

// tanggal dari catatan pertama sampai "hari ini" yang belum punya catatan
export async function getUnrecordedDates(today: string) {
  if (!isRealDate(today)) throw new Error("Tanggal tidak valid");
  const ds = await getRealDataset();
  if (!ds) return { count: 0, dates: [] as string[] };

  const rows = await prisma.$queryRaw<{ date: string }[]>`
    WITH bounds AS (
      SELECT MIN(d."date")::timestamp AS first_d
      FROM daily_entries d
      WHERE d."datasetId" = ${ds.id}
    )
    SELECT to_char(g, 'YYYY-MM-DD') AS "date"
    FROM bounds, generate_series(bounds.first_d, ${today}::timestamp, interval '1 day') AS g
    WHERE NOT EXISTS (
      SELECT 1 FROM daily_entries x
      WHERE x."datasetId" = ${ds.id} AND x."date" = g::date
    )
    ORDER BY g DESC
  `;
  return { count: rows.length, dates: rows.slice(0, 60).map((r) => r.date) };
}

export async function getCategoryOptions() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, color: true, isSystem: true },
  });
}

export async function getRuleInputs() {
  const rules = await prisma.categoryRule.findMany({
    where: { isActive: true },
    select: { keyword: true, priority: true, category: { select: { name: true } } },
  });
  return rules.map((r) => ({
    keyword: r.keyword,
    priority: r.priority,
    categoryName: r.category.name,
  }));
}
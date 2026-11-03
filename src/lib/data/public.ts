import { prisma } from "@/lib/prisma";
import * as insights from "./insights";

// Dataset dipilih DI SINI. Pemanggil tidak bisa menyebutkan id dataset.
async function resolvePublicDataset() {
  return prisma.dataset.findFirst({
    where: { type: "SYNTHETIC", isPublished: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
}

// Daftar putih eksplisit: hanya field di bawah ini yang boleh keluar ke publik.
export async function getPublicOverview() {
  const ds = await resolvePublicDataset();
  if (!ds) return null;

  const [summary, months, categories, weekdayWeekend, topDays] = await Promise.all([
    insights.getSummary(ds.id),
    insights.getMonthlyTotals(ds.id),
    insights.getCategoryComposition(ds.id),
    insights.getWeekdayVsWeekend(ds.id),
    insights.getTopDays(ds.id, {}, 5),
  ]);

  return {
    generatedAt: ds.createdAt.toISOString(),
    summary: {
      total: summary.total,
      expenseCount: summary.expenseCount,
      recordedDays: summary.recordedDays,
      emptyDays: summary.emptyDays,
      avgPerRecordedDay: summary.avgPerRecordedDay,
      firstDate: summary.firstDate,
      lastDate: summary.lastDate,
    },
    months: months.map((m) => ({
      month: m.month,
      total: m.total,
      recordedDays: m.recordedDays,
      avgPerRecordedDay: m.avgPerRecordedDay,
    })),
    categories: categories.map((c) => ({
      name: c.name,
      color: c.color,
      total: c.total,
      amountShare: c.amountShare,
      itemShare: c.itemShare,
    })),
    weekdayWeekend: {
      weekday: {
        days: weekdayWeekend.weekday.days,
        avgPerDay: weekdayWeekend.weekday.avgPerDay,
      },
      weekend: {
        days: weekdayWeekend.weekend.days,
        avgPerDay: weekdayWeekend.weekend.avgPerDay,
      },
    },
    topDays: topDays.map((d) => ({
      date: d.date,
      weekday: d.weekday,
      total: d.total,
      items: d.items,
    })),
  };
}
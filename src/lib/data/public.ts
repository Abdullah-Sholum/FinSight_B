import { prisma } from "@/lib/prisma";
import * as insights from "./insights";
import type { DateRange } from "./insights";

// Dataset dipilih DI SINI. Pemanggil tidak bisa menyebutkan id dataset.
async function resolvePublicDataset() {
  return prisma.dataset.findFirst({
    where: { type: "SYNTHETIC", isPublished: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true },
  });
}

export async function getPublicOverview(range: DateRange = {}) {
  const ds = await resolvePublicDataset();
  if (!ds) return null;

  const [summary, months, categories, weekdayWeekend, topDays] =
    await Promise.all([
      insights.getSummary(ds.id, range),
      insights.getMonthlyTotals(ds.id, range),
      insights.getCategoryComposition(ds.id, range),
      insights.getWeekdayVsWeekend(ds.id, range),
      insights.getTopDays(ds.id, range, 5),
    ]);

  return {
    dataset: { name: ds.name, generatedAt: ds.createdAt.toISOString() },
    summary,
    months,
    categories,
    weekdayWeekend,
    topDays,
  };
}
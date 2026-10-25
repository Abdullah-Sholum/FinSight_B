import { prisma } from "@/lib/prisma";
import { REAL_DATASET_NAME } from "@/lib/import/commit";
import * as insights from "./insights";
import type { DateRange } from "./insights";

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
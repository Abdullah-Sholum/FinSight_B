import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isRealDate } from "@/lib/validation/import-row";

export type DateRange = { from?: string; to?: string };

function assertRange(range: DateRange) {
  for (const v of [range.from, range.to]) {
    if (v !== undefined && !isRealDate(v)) {
      throw new Error(`Tanggal tidak valid: ${v}`);
    }
  }
  if (range.from && range.to && range.from > range.to) {
    throw new Error("Rentang tanggal terbalik");
  }
}

// alias hanya boleh 'e' (expenses) atau 'd' (daily_entries); nilai tanggal tetap berparameter
function rangeSql(alias: "e" | "d", range: DateRange) {
  const col = Prisma.raw(`${alias}."date"`);
  const from = range.from
    ? Prisma.sql`AND ${col} >= ${range.from}::date`
    : Prisma.empty;
  const to = range.to
    ? Prisma.sql`AND ${col} <= ${range.to}::date`
    : Prisma.empty;
  return Prisma.sql`${from} ${to}`;
}

type SummaryRow = {
  total: number;
  expenseCount: number;
  recordedDays: number;
  emptyDays: number;
  firstDate: string | null;
  lastDate: string | null;
};

export async function getSummary(datasetId: number, range: DateRange = {}) {
  assertRange(range);
  const e = rangeSql("e", range);
  const d = rangeSql("d", range);

  const [row] = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      (SELECT COALESCE(SUM(e.amount), 0)::float8
         FROM expenses e WHERE e."datasetId" = ${datasetId} ${e}) AS "total",
      (SELECT COUNT(*)::int
         FROM expenses e WHERE e."datasetId" = ${datasetId} ${e}) AS "expenseCount",
      (SELECT COUNT(*)::int
         FROM daily_entries d WHERE d."datasetId" = ${datasetId} ${d}) AS "recordedDays",
      (SELECT COUNT(*)::int
         FROM daily_entries d
         WHERE d."datasetId" = ${datasetId} AND d."isEmptyDay" ${d}) AS "emptyDays",
      (SELECT MIN(d."date")::text
         FROM daily_entries d WHERE d."datasetId" = ${datasetId} ${d}) AS "firstDate",
      (SELECT MAX(d."date")::text
         FROM daily_entries d WHERE d."datasetId" = ${datasetId} ${d}) AS "lastDate"
  `;

  return {
    ...row,
    avgPerRecordedDay: row.recordedDays
      ? Math.round(row.total / row.recordedDays)
      : 0,
  };
}

type MonthRow = {
  month: string;
  total: number;
  itemCount: number;
  recordedDays: number;
};

export async function getMonthlyTotals(
  datasetId: number,
  range: DateRange = {},
) {
  assertRange(range);
  const e = rangeSql("e", range);
  const d = rangeSql("d", range);

  const rows = await prisma.$queryRaw<MonthRow[]>`
    WITH bounds AS (
      SELECT
        date_trunc('month', MIN(d."date")::timestamp) AS first_m,
        date_trunc('month', MAX(d."date")::timestamp) AS last_m
      FROM daily_entries d
      WHERE d."datasetId" = ${datasetId} ${d}
    ),
    months AS (
      SELECT generate_series(first_m, last_m, interval '1 month')::date AS m
      FROM bounds
    )
    SELECT
      to_char(m.m, 'YYYY-MM') AS "month",
      COALESCE((
        SELECT SUM(e.amount) FROM expenses e
        WHERE e."datasetId" = ${datasetId} ${e}
          AND e."date" >= m.m AND e."date" < (m.m + interval '1 month')::date
      ), 0)::float8 AS "total",
      (
        SELECT COUNT(*)::int FROM expenses e
        WHERE e."datasetId" = ${datasetId} ${e}
          AND e."date" >= m.m AND e."date" < (m.m + interval '1 month')::date
      ) AS "itemCount",
      (
        SELECT COUNT(*)::int FROM daily_entries d
        WHERE d."datasetId" = ${datasetId} ${d}
          AND d."date" >= m.m AND d."date" < (m.m + interval '1 month')::date
      ) AS "recordedDays"
    FROM months m
    ORDER BY m.m
  `;

  return rows.map((r) => ({
    ...r,
    avgPerRecordedDay: r.recordedDays ? Math.round(r.total / r.recordedDays) : 0,
  }));
}

type CategoryRow = {
  name: string;
  color: string | null;
  items: number;
  total: number;
};

export async function getCategoryComposition(
  datasetId: number,
  range: DateRange = {},
) {
  assertRange(range);
  const e = rangeSql("e", range);

  const rows = await prisma.$queryRaw<CategoryRow[]>`
    SELECT c.name AS "name", c.color AS "color",
           COUNT(*)::int AS "items",
           SUM(e.amount)::float8 AS "total"
    FROM expenses e
    JOIN categories c ON c.id = e."categoryId"
    WHERE e."datasetId" = ${datasetId} ${e}
    GROUP BY c.id, c.name, c.color
    ORDER BY "total" DESC
  `;

  const grandTotal = rows.reduce((a, r) => a + r.total, 0);
  const grandItems = rows.reduce((a, r) => a + r.items, 0);

  return rows.map((r) => ({
    ...r,
    amountShare: grandTotal ? r.total / grandTotal : 0,
    itemShare: grandItems ? r.items / grandItems : 0,
  }));
}

function assertLimit(n: number) {
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new Error("limit harus bilangan bulat 1-100");
  }
}

type TopItemRow = { item: string; count: number; total: number };

export async function getTopItems(
  datasetId: number,
  range: DateRange = {},
  limit = 10,
) {
  assertRange(range);
  assertLimit(limit);
  const e = rangeSql("e", range);

  const [byCount, byTotal] = await Promise.all([
    prisma.$queryRaw<TopItemRow[]>`
      SELECT lower(regexp_replace(btrim(e.item), '[[:space:]]+', ' ', 'g')) AS "item",
             COUNT(*)::int AS "count",
             SUM(e.amount)::float8 AS "total"
      FROM expenses e
      WHERE e."datasetId" = ${datasetId} ${e}
      GROUP BY 1
      ORDER BY "count" DESC, "total" DESC, "item" ASC
      LIMIT ${limit}::int
    `,
    prisma.$queryRaw<TopItemRow[]>`
      SELECT lower(regexp_replace(btrim(e.item), '[[:space:]]+', ' ', 'g')) AS "item",
             COUNT(*)::int AS "count",
             SUM(e.amount)::float8 AS "total"
      FROM expenses e
      WHERE e."datasetId" = ${datasetId} ${e}
      GROUP BY 1
      ORDER BY "total" DESC, "count" DESC, "item" ASC
      LIMIT ${limit}::int
    `,
  ]);

  return { byCount, byTotal };
}

type DowRow = { kind: "weekday" | "weekend"; days: number; total: number };

export async function getWeekdayVsWeekend(
  datasetId: number,
  range: DateRange = {},
) {
  assertRange(range);
  const d = rangeSql("d", range);

  const rows = await prisma.$queryRaw<DowRow[]>`
    WITH day_totals AS (
      SELECT d."date" AS day,
             COALESCE((
               SELECT SUM(e.amount) FROM expenses e
               WHERE e."datasetId" = d."datasetId" AND e."date" = d."date"
             ), 0) AS total
      FROM daily_entries d
      WHERE d."datasetId" = ${datasetId} ${d}
    )
    SELECT CASE WHEN EXTRACT(ISODOW FROM day) IN (6, 7)
                THEN 'weekend' ELSE 'weekday' END AS "kind",
           COUNT(*)::int AS "days",
           COALESCE(SUM(total), 0)::float8 AS "total"
    FROM day_totals
    GROUP BY 1
  `;

  const pick = (kind: "weekday" | "weekend") => {
    const r = rows.find((x) => x.kind === kind);
    const days = r?.days ?? 0;
    const total = r?.total ?? 0;
    return { days, total, avgPerDay: days ? Math.round(total / days) : 0 };
  };
  return { weekday: pick("weekday"), weekend: pick("weekend") };
}

type TopDayRow = { date: string; total: number; items: number };

export async function getTopDays(
  datasetId: number,
  range: DateRange = {},
  limit = 5,
) {
  assertRange(range);
  assertLimit(limit);
  const e = rangeSql("e", range);

  const rows = await prisma.$queryRaw<TopDayRow[]>`
    SELECT e."date"::text AS "date",
           SUM(e.amount)::float8 AS "total",
           COUNT(*)::int AS "items"
    FROM expenses e
    WHERE e."datasetId" = ${datasetId} ${e}
    GROUP BY e."date"
    ORDER BY "total" DESC, e."date" ASC
    LIMIT ${limit}::int
  `;

  return rows.map((r) => ({
    ...r,
    weekday: new Date(`${r.date}T00:00:00Z`).toLocaleDateString("id-ID", {
      weekday: "long",
      timeZone: "UTC",
    }),
  }));
}

type QualityRow = {
  items: number;
  total: number;
  uncItems: number;
  uncTotal: number;
};

export async function getDataQuality(
  datasetId: number,
  range: DateRange = {},
) {
  assertRange(range);
  const e = rangeSql("e", range);
  const d = rangeSql("d", range);

  const [[q], gaps, topUncategorized] = await Promise.all([
    prisma.$queryRaw<QualityRow[]>`
      SELECT COUNT(*)::int AS "items",
             COALESCE(SUM(e.amount), 0)::float8 AS "total",
             (COUNT(*) FILTER (WHERE c.name = 'Uncategorized'))::int AS "uncItems",
             COALESCE(SUM(e.amount) FILTER (WHERE c.name = 'Uncategorized'), 0)::float8 AS "uncTotal"
      FROM expenses e
      JOIN categories c ON c.id = e."categoryId"
      WHERE e."datasetId" = ${datasetId} ${e}
    `,
    prisma.$queryRaw<{ date: string }[]>`
      WITH bounds AS (
        SELECT MIN(d."date")::timestamp AS first_d,
               MAX(d."date")::timestamp AS last_d
        FROM daily_entries d
        WHERE d."datasetId" = ${datasetId} ${d}
      )
      SELECT to_char(g, 'YYYY-MM-DD') AS "date"
      FROM bounds, generate_series(bounds.first_d, bounds.last_d, interval '1 day') AS g
      WHERE NOT EXISTS (
        SELECT 1 FROM daily_entries x
        WHERE x."datasetId" = ${datasetId} AND x."date" = g::date
      )
      ORDER BY g
    `,
    prisma.$queryRaw<TopItemRow[]>`
      SELECT lower(regexp_replace(btrim(e.item), '[[:space:]]+', ' ', 'g')) AS "item",
             COUNT(*)::int AS "count",
             SUM(e.amount)::float8 AS "total"
      FROM expenses e
      JOIN categories c ON c.id = e."categoryId"
      WHERE e."datasetId" = ${datasetId} AND c.name = 'Uncategorized' ${e}
      GROUP BY 1
      ORDER BY "count" DESC, "total" DESC, "item" ASC
      LIMIT 20
    `,
  ]);

  return {
    uncategorized: {
      items: q.uncItems,
      amount: q.uncTotal,
      itemShare: q.items ? q.uncItems / q.items : 0,
      amountShare: q.total ? q.uncTotal / q.total : 0,
    },
    gapCount: gaps.length,
    gapDates: gaps.slice(0, 100).map((g) => g.date),
    topUncategorized,
  };
}
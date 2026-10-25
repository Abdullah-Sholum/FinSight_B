import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getAdminOverview, getRealDataset } from "@/lib/data/admin";

const GOLDEN = {
  total: 32258500 as number | null,
  expenseCount: 1221 as number | null,
  recordedDays: 457 as number | null,
  emptyDays: 78 as number | null,
  avgPerRecordedDay: 70588 as number | null,
  weekdayAvg: 72381 as number | null,
  weekendAvg: 66077 as number | null,
  topDayDate: "2026-06-16" as string | null,
  topDayTotal: 4674000 as number | null,
  month: { key: "2025-07", total: 2149500 as number | null },
  category: { name: "Elektronik & Hobi", total: 9845500 as number | null },
  uncategorizedAmountPct: 1.54 as number | null,
};

let bad = 0;
function check(label: string, actual: unknown, expected: unknown) {
  if (expected === null) return console.log(`LEWATI  ${label}`);
  const ok = actual === expected;
  if (!ok) bad++;
  console.log(`${ok ? "OK    " : "BEDA  "} ${label}: aplikasi=${actual} jupyter=${expected}`);
}

async function main() {
  const a = await getAdminOverview();
  const ds = await getRealDataset();
  if (!a || !ds) throw new Error("Dataset 'Data Asli' belum ada.");

  check("total", a.summary.total, GOLDEN.total);
  check("jumlah item", a.summary.expenseCount, GOLDEN.expenseCount);
  check("hari tercatat", a.summary.recordedDays, GOLDEN.recordedDays);
  check("hari kosong", a.summary.emptyDays, GOLDEN.emptyDays);
  check("rata-rata harian", a.summary.avgPerRecordedDay, GOLDEN.avgPerRecordedDay);
  check("rata-rata hari kerja", a.weekdayWeekend.weekday.avgPerDay, GOLDEN.weekdayAvg);
  check("rata-rata akhir pekan", a.weekdayWeekend.weekend.avgPerDay, GOLDEN.weekendAvg);
  check("hari termahal (tanggal)", a.topDays[0]?.date, GOLDEN.topDayDate);
  check("hari termahal (nominal)", a.topDays[0]?.total, GOLDEN.topDayTotal);
  check(
    `total bulan ${GOLDEN.month.key}`,
    a.months.find((m) => m.month === GOLDEN.month.key)?.total,
    GOLDEN.month.total,
  );
  check(
    `total kategori ${GOLDEN.category.name}`,
    a.categories.find((c) => c.name === GOLDEN.category.name)?.total,
    GOLDEN.category.total,
  );
  check(
    "Uncategorized per nominal (%)",
    Number((a.quality.uncategorized.amountShare * 100).toFixed(2)),
    GOLDEN.uncategorizedAmountPct,
  );

  console.log(bad === 0 ? "\nSemua angka yang diisi COCOK." : `\n${bad} angka BERBEDA.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
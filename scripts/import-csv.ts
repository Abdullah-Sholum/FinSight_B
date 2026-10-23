import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/import/parse";
import { buildPlan } from "@/lib/import/plan";

const DATASET_NAME = "Data Asli";
const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

async function main() {
  const fileName = process.argv[2];
  if (!fileName) throw new Error("Pemakaian: npx tsx scripts/import-csv.ts <namafile.csv>");

  const dir = process.env.PRIVATE_DATA_DIR;
  if (!dir) throw new Error("PRIVATE_DATA_DIR belum diatur di .env");

  const text = fs.readFileSync(path.join(dir, fileName), "utf-8");
  const parsed = parseCsv(text);

  const categories = await prisma.category.findMany();
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

  const dataset = await prisma.dataset.findUnique({ where: { name: DATASET_NAME } });
  const existing = dataset
    ? await prisma.dailyEntry.findMany({ where: { datasetId: dataset.id }, select: { date: true } })
    : [];
  const existingDates = new Set(existing.map((e) => e.date.toISOString().slice(0, 10)));

  const plan = buildPlan({
    rows: parsed.rows,
    parseErrors: parsed.errors,
    totalRows: parsed.totalRows,
    categoryIdByName,
    existingDates,
  });

  const s = plan.stats;
  console.log("=== LAPORAN DRY RUN (tidak ada yang disimpan) ===");
  console.log(`Baris di CSV              : ${s.totalRows}`);
  console.log(`Baris error               : ${s.errorRows}`);
  console.log(`Hari yang akan diimpor    : ${s.importedDays}`);
  console.log(`  - hari berpengeluaran   : ${s.expenseDays}`);
  console.log(`  - hari kosong (None)    : ${s.emptyDays}`);
  console.log(`Item pengeluaran          : ${s.expenseCount}`);
  console.log(`Total nominal             : ${rupiah(s.totalAmount)}`);
  console.log(`Uncategorized             : ${s.uncategorizedPct.toFixed(2)}%`);
  console.log(`Tanggal dilewati (sudah ada): ${plan.skippedExistingDates.length}`);
  console.log(`Tanggal ditolak           : ${plan.rejectedDates.length}`);
  console.log(`Tanggal tanpa catatan (celah): ${plan.gapDates.length}`);
  if (plan.gapDates.length) console.log("  contoh:", plan.gapDates.slice(0, 10).join(", "));

  console.log("\nPer kategori:");
  for (const [name, c] of [...s.perCategory].sort((a, b) => b[1].amount - a[1].amount)) {
    console.log(`  ${name.padEnd(20)} ${String(c.count).padStart(5)} item  ${rupiah(c.amount)}`);
  }

  if (plan.errors.length) {
    console.log("\nError (maks 30):");
    for (const e of plan.errors.slice(0, 30)) {
      console.log(`  baris ${e.line}${e.legacyId ? ` (id ${e.legacyId})` : ""}: ${e.message}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
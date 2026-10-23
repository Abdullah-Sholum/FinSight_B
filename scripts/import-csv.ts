import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/import/parse";
import { buildPlan } from "@/lib/import/plan";
import {
  commitPlan,
  getOrCreateRealDataset,
  REAL_DATASET_NAME,
} from "@/lib/import/commit";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

async function main() {
  const args = process.argv.slice(2);
  const fileName = args.find((a) => !a.startsWith("--"));
  const commit = args.includes("--commit");
  const allowErrors = args.includes("--allow-errors");
  if (!fileName) {
    throw new Error("Pemakaian: npx tsx scripts/import-csv.ts <file.csv> [--commit] [--allow-errors]");
  }

  const dir = process.env.PRIVATE_DATA_DIR;
  if (!dir) throw new Error("PRIVATE_DATA_DIR belum diatur di .env");

  const text = fs.readFileSync(path.join(dir, fileName), "utf-8");
  const parsed = parseCsv(text);

  const categories = await prisma.category.findMany();
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

  const dataset = await prisma.dataset.findUnique({ where: { name: REAL_DATASET_NAME } });
  const existing = dataset
    ? await prisma.dailyEntry.findMany({
        where: { datasetId: dataset.id },
        select: { date: true },
      })
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
  console.log(commit ? "=== LAPORAN IMPORT ===" : "=== LAPORAN DRY RUN (tidak ada yang disimpan) ===");
  console.log(`Baris di CSV              : ${s.totalRows}`);
  console.log(`Baris error               : ${s.errorRows}`);
  console.log(`Hari yang akan diimpor    : ${s.importedDays}`);
  console.log(`  - hari berpengeluaran   : ${s.expenseDays}`);
  console.log(`  - hari kosong (None)    : ${s.emptyDays}`);
  console.log(`Item pengeluaran          : ${s.expenseCount}`);
  console.log(`Total nominal             : ${rupiah(s.totalAmount)}`);
  console.log(`Uncategorized (per item)  : ${s.uncategorizedPct.toFixed(2)}%`);
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

  if (!commit) {
    console.log("\nIni dry run. Tambahkan --commit untuk menyimpan.");
    return;
  }
  if (plan.errors.length > 0 && !allowErrors) {
    throw new Error("Ada error. Perbaiki CSV, atau pakai --allow-errors untuk mengimpor hari yang valid saja.");
  }
  if (plan.days.length === 0) {
    console.log("\nTidak ada hari baru untuk diimpor. Tidak ada yang disimpan.");
    return;
  }

  const ds = await getOrCreateRealDataset();
  const batch = await commitPlan({
    datasetId: ds.id,
    fileName,
    totalRows: parsed.totalRows,
    plan,
  });
  console.log(`\nSelesai. Batch #${batch.id}: ${plan.days.length} hari dan ${s.expenseCount} item tersimpan.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const id = Number(process.argv[2]);
  const confirmed = process.argv.includes("--yes");
  if (!Number.isInteger(id)) {
    throw new Error("Pemakaian: npx tsx scripts/rollback-batch.ts <batchId> [--yes]");
  }

  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) throw new Error(`Batch #${id} tidak ditemukan`);
  if (batch.status !== "COMPLETED") {
    throw new Error(`Batch #${id} berstatus ${batch.status}, tidak bisa dibatalkan`);
  }

  const expenseWhere = {
    OR: [{ importBatchId: id }, { entry: { importBatchId: id } }],
  };
  const expenseCount = await prisma.expense.count({ where: expenseWhere });
  const entryCount = await prisma.dailyEntry.count({ where: { importBatchId: id } });
  const manualCount = await prisma.expense.count({
    where: { ...expenseWhere, categorySource: "MANUAL" },
  });

  console.log(`Batch #${id} (${batch.fileName})`);
  console.log(`Akan dihapus: ${entryCount} catatan harian dan ${expenseCount} item.`);
  if (manualCount > 0) {
    console.log(`PERINGATAN: ${manualCount} item sudah dikoreksi manual dan ikut terhapus.`);
  }
  console.log("Perubahan lain pada hari-hari ini (nominal, item tambahan) juga ikut hilang.");

  if (!confirmed) {
    console.log("\nBelum ada yang dihapus. Tambahkan --yes untuk melanjutkan.");
    return;
  }

  await prisma.$transaction([
    prisma.expense.deleteMany({ where: expenseWhere }),
    prisma.dailyEntry.deleteMany({ where: { importBatchId: id } }),
    prisma.importBatch.update({ where: { id }, data: { status: "ROLLED_BACK" } }),
  ]);
  console.log(`Batch #${id} dibatalkan.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
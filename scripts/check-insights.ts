import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getAdminOverview } from "@/lib/data/admin-core";
import { getPublicOverview } from "@/lib/data/public";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

async function main() {
  console.log("=== PAGAR PUBLIK ===");
  const pub = await getPublicOverview();
  console.log(
    pub === null
      ? "OK: belum ada dataset sintesis terbit, publik mendapat null."
      : `Dataset publik: ${pub.dataset.name}`,
  );

  console.log("\n=== ADMIN (data asli) ===");
  const admin = await getAdminOverview();
  if (!admin) throw new Error("Dataset 'Data Asli' belum ada. Jalankan import dulu.");

  const s = admin.summary;
  console.log(`Rentang           : ${s.firstDate} s/d ${s.lastDate}`);
  console.log(`Total             : ${rupiah(s.total)}`);
  console.log(`Item              : ${s.expenseCount}`);
  console.log(`Hari tercatat     : ${s.recordedDays} (kosong: ${s.emptyDays})`);
  console.log(`Rata-rata harian  : ${rupiah(s.avgPerRecordedDay)}`);

  console.log("\nPer bulan:");
  for (const m of admin.months) {
    console.log(
      `  ${m.month}  ${rupiah(m.total).padStart(14)}  ${String(m.itemCount).padStart(4)} item  ${String(m.recordedDays).padStart(2)} hari  rata-rata ${rupiah(m.avgPerRecordedDay)}`,
    );
  }

  console.log("\nPer kategori:");
  for (const c of admin.categories) {
    console.log(
      `  ${c.name.padEnd(20)} ${rupiah(c.total).padStart(14)}  ${(c.amountShare * 100).toFixed(1).padStart(5)}% nominal  ${(c.itemShare * 100).toFixed(1).padStart(5)}% item`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
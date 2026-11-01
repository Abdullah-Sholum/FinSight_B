import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getAdminOverview } from "@/lib/data/admin-core";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

async function main() {
  const a = await getAdminOverview();
  if (!a) throw new Error("Dataset 'Data Asli' belum ada.");

  console.log("=== HARI KERJA vs AKHIR PEKAN ===");
  console.log(`Hari kerja : ${a.weekdayWeekend.weekday.days} hari, rata-rata ${rupiah(a.weekdayWeekend.weekday.avgPerDay)}`);
  console.log(`Akhir pekan: ${a.weekdayWeekend.weekend.days} hari, rata-rata ${rupiah(a.weekdayWeekend.weekend.avgPerDay)}`);

  console.log("\n=== HARI TERMAHAL ===");
  for (const d of a.topDays) {
    console.log(`  ${d.date} (${d.weekday})  ${rupiah(d.total)}  ${d.items} item`);
  }

  console.log("\n=== TOP ITEM (frekuensi) ===");
  for (const i of a.topItems.byCount) {
    console.log(`  ${String(i.count).padStart(4)}x  ${i.item.padEnd(24)} ${rupiah(i.total)}`);
  }
  console.log("\n=== TOP ITEM (nominal) ===");
  for (const i of a.topItems.byTotal) {
    console.log(`  ${rupiah(i.total).padStart(14)}  ${i.item.padEnd(24)} ${i.count}x`);
  }

  const q = a.quality;
  console.log("\n=== KUALITAS DATA ===");
  console.log(`Uncategorized per item   : ${q.uncategorized.items} (${pct(q.uncategorized.itemShare)})`);
  console.log(`Uncategorized per nominal: ${rupiah(q.uncategorized.amount)} (${pct(q.uncategorized.amountShare)})`);
  console.log(`Celah tanggal            : ${q.gapCount}`);
  if (q.gapDates.length) console.log("  ", q.gapDates.slice(0, 10).join(", "));

  console.log("\nItem Uncategorized terbanyak:");
  for (const i of q.topUncategorized) {
    console.log(`  ${String(i.count).padStart(3)}x  ${i.item.padEnd(24)} ${rupiah(i.total)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
import "dotenv/config";
import { getAdminOverview } from "@/lib/data/admin-core";
import { getPublicOverview } from "@/lib/data/public";
import { rupiah } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const PUBLIC_KEYS = [
  "generatedAt",
  "summary",
  "months",
  "categories",
  "weekdayWeekend",
  "topDays",
];
const FORBIDDEN = ["Data Asli", "legacyId", "categorySource", "passwordHash", "seed"];

async function main() {
  const real = await getAdminOverview();
  if (!real) throw new Error("Dataset 'Data Asli' belum ada.");

  const datasets = await prisma.dataset.findMany({
    select: { name: true, type: true, isPublished: true },
    orderBy: { id: "asc" },
  });
  const published = datasets.filter((d) => d.isPublished);
  const failures: string[] = [];

  console.log(`Dataset di database: ${datasets.length}, terbit: ${published.length}`);
  if (datasets.some((d) => d.type === "REAL" && d.isPublished)) {
    failures.push("dataset REAL berstatus terbit");
  }
  if (published.length > 1) failures.push("lebih dari satu dataset terbit");

  const pub = await getPublicOverview();
  console.log(`Total data asli  : ${rupiah(real.summary.total)}`);

  if (pub === null) {
    console.log("Publik           : null (tidak ada dataset sintesis terbit)");
    if (published.length !== 0) failures.push("ada dataset terbit tapi publik mendapat null");
  } else {
    const json = JSON.stringify(pub);
    const keys = Object.keys(pub).sort().join(",");
    console.log(`Total publik     : ${rupiah(pub.summary.total)}`);
    console.log(`Kunci respons    : ${keys}`);

    if (keys !== [...PUBLIC_KEYS].sort().join(",")) failures.push("bentuk respons publik berubah");
    if (/"id"\s*:/.test(json)) failures.push("ada properti id di respons publik");
    for (const w of FORBIDDEN) {
      if (json.includes(w)) failures.push(`kata "${w}" muncul di respons publik`);
    }
    if (published[0] && json.includes(published[0].name)) {
      failures.push("nama dataset muncul di respons publik");
    }
    if (published[0]?.type !== "SYNTHETIC") failures.push("dataset publik bukan SYNTHETIC");
    if (published.length !== 1) failures.push("publik punya data tetapi jumlah dataset terbit bukan satu");
    if (pub.summary.total === real.summary.total) failures.push("total publik sama dengan data asli");
  }

  console.log(failures.length === 0 ? "\nRINGKASAN: LULUS" : `\nRINGKASAN: GAGAL: ${failures.join("; ")}`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
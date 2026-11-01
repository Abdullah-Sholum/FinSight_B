import "dotenv/config";
import { getAdminOverview } from "@/lib/data/admin-core";
import { getPublicOverview } from "@/lib/data/public";
import { rupiah } from "@/lib/format";
import { prisma } from "@/lib/prisma";

async function main() {
  const real = await getAdminOverview();
  if (!real) throw new Error("Dataset 'Data Asli' belum ada.");

  const datasets = await prisma.dataset.findMany({
    select: { name: true, type: true, isPublished: true },
    orderBy: { id: "asc" },
  });
  const publishedCount = datasets.filter((d) => d.isPublished).length;
  const failures: string[] = [];

  console.log(`Dataset di database: ${datasets.length}, terbit: ${publishedCount}`);
  if (datasets.some((d) => d.type === "REAL" && d.isPublished)) {
    failures.push("dataset REAL berstatus terbit");
  }
  if (publishedCount > 1) failures.push("lebih dari satu dataset terbit");

  const pub = await getPublicOverview();
  console.log(`Total data asli  : ${rupiah(real.summary.total)}`);

  if (pub === null) {
    console.log("Publik           : null (tidak ada dataset sintesis terbit)");
    if (publishedCount !== 0) failures.push("ada dataset terbit tapi publik mendapat null");
  } else {
    const json = JSON.stringify(pub);
    console.log(`Publik           : ${pub.dataset.name}`);
    console.log(`Total publik     : ${rupiah(pub.summary.total)}`);
    console.log(`Kunci dataset    : ${Object.keys(pub.dataset).join(", ")}`);

    if (pub.summary.total === real.summary.total) failures.push("total publik sama dengan data asli");
    if ("id" in pub.dataset) failures.push("id dataset terekspos ke publik");
    if (json.includes("Data Asli")) failures.push("nama dataset asli muncul di respons publik");
    if (!pub.dataset.name.startsWith("Sintesis")) failures.push("dataset publik bukan dataset sintesis");
    if (publishedCount !== 1) failures.push("publik punya data tetapi jumlah dataset terbit bukan satu");
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
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/import/parse";
import { buildPlan } from "@/lib/import/plan";
import { buildMatcher, normalizeText } from "@/lib/categorize";

type Kind = "same" | "differ" | "ruleMissing" | "ruleBetter" | "bothUnc";
const UNC = "Uncategorized";

async function main() {
  const fileName = process.argv[2];
  if (!fileName) throw new Error("Pemakaian: npx tsx scripts/compare-rules.ts <file.csv>");
  const dir = process.env.PRIVATE_DATA_DIR;
  if (!dir) throw new Error("PRIVATE_DATA_DIR belum diatur di .env");

  const parsed = parseCsv(fs.readFileSync(path.join(dir, fileName), "utf-8"));
  const categories = await prisma.category.findMany();
  const plan = buildPlan({
    rows: parsed.rows,
    parseErrors: parsed.errors,
    totalRows: parsed.totalRows,
    categoryIdByName: new Map(categories.map((c) => [c.name, c.id])),
    existingDates: new Set(),
  });

  const rules = await prisma.categoryRule.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { keyword: "asc" },
  });
  if (rules.length === 0) {
    throw new Error("Tabel aturan kosong. Jalankan seed aturan dulu (Fase 2, Langkah 5).");
  }
  const match = buildMatcher(
    rules.map((r) => ({
      keyword: r.keyword,
      priority: r.priority,
      categoryName: r.category.name,
    })),
  );

  const counts: Record<Kind, number> = {
    same: 0, differ: 0, ruleMissing: 0, ruleBetter: 0, bothUnc: 0,
  };
  const groups = new Map<string, number>();

  for (const day of plan.days) {
    for (const e of day.expenses) {
      const m = match(e.item);
      const csvCat = e.categoryName;
      let kind: Kind;
      if (!m) kind = csvCat === UNC ? "bothUnc" : "ruleMissing";
      else if (csvCat === UNC) kind = "ruleBetter";
      else kind = m.categoryName === csvCat ? "same" : "differ";
      counts[kind]++;
      if (kind === "same" || kind === "bothUnc") continue;

      const key = [kind, normalizeText(e.item), csvCat, m?.categoryName ?? "-", m?.keyword ?? "-"].join("|");
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pct = (n: number) => ((n / total) * 100).toFixed(1);
  console.log(`Item dibandingkan: ${total}`);
  console.log(`  sama                         : ${counts.same} (${pct(counts.same)}%)`);
  console.log(`  beda kategori                : ${counts.differ}`);
  console.log(`  aturan tidak cocok           : ${counts.ruleMissing}`);
  console.log(`  CSV Uncategorized, aturan cocok: ${counts.ruleBetter}`);
  console.log(`  sama-sama Uncategorized      : ${counts.bothUnc}`);

  const titles: Record<string, string> = {
    differ: "BEDA KATEGORI (CSV vs aturan)",
    ruleMissing: "ATURAN TIDAK COCOK (CSV punya kategori)",
    ruleBetter: "CSV UNCATEGORIZED, ATURAN COCOK",
  };
  for (const kind of ["differ", "ruleMissing", "ruleBetter"] as const) {
    const list = [...groups]
      .filter(([k]) => k.startsWith(`${kind}|`))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25);
    if (!list.length) continue;
    console.log(`\n${titles[kind]} (maks 25):`);
    for (const [key, n] of list) {
      const [, item, csvCat, ruleCat, kw] = key.split("|");
      console.log(`  ${String(n).padStart(3)}x "${item}"  CSV: ${csvCat}  | aturan: ${ruleCat} (kata kunci "${kw}")`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
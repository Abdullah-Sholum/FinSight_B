import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const dir = process.env.PRIVATE_DATA_DIR;
if (!dir) throw new Error("PRIVATE_DATA_DIR belum diatur di .env");

const raw = JSON.parse(
  fs.readFileSync(path.join(dir, "category_map.json"), "utf-8"),
) as Record<string, string[]>;

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

async function main() {
  const categories = await prisma.category.findMany();
  const idByName = new Map(categories.map((c) => [c.name, c.id]));

  const rules = new Map<string, string>();
  const conflicted = new Set<string>();
  const conflicts: string[] = [];
  const unknown: string[] = [];
  let duplicates = 0;

  for (const [categoryName, keywords] of Object.entries(raw)) {
    if (!idByName.has(categoryName)) {
      unknown.push(categoryName);
      continue;
    }
    for (const k of keywords) {
      const keyword = normalize(k);
      if (!keyword || conflicted.has(keyword)) continue;

      const existing = rules.get(keyword);
      if (!existing) {
        rules.set(keyword, categoryName);
      } else if (existing === categoryName) {
        duplicates++;
      } else {
        conflicts.push(`"${keyword}": ${existing} vs ${categoryName}`);
        rules.delete(keyword);
        conflicted.add(keyword);
      }
    }
  }

  const result = await prisma.categoryRule.createMany({
    data: [...rules].map(([keyword, categoryName]) => ({
      keyword,
      categoryId: idByName.get(categoryName)!,
    })),
    skipDuplicates: true,
  });

  console.log(`Aturan baru dimasukkan: ${result.count}`);
  console.log(`Duplikat dalam kategori yang sama (diabaikan): ${duplicates}`);
  if (unknown.length) console.warn("Kategori tidak dikenal:", unknown);
  if (conflicts.length) console.warn("Konflik antarkategori (dilewati):", conflicts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
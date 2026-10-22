import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const categories = [
  { name: "Makanan & Minuman", color: "#f97316" },
  { name: "Jajan", color: "#eab308" },
  { name: "Transportasi", color: "#3b82f6" },
  { name: "Kebutuhan Rumah", color: "#22c55e" },
  { name: "Kebutuhan Diri", color: "#a855f7" },
  { name: "Olahraga", color: "#ef4444" },
  { name: "Elektronik & Hobi", color: "#06b6d4" },
  { name: "Lain-lain", color: "#64748b" },
];

async function main() {
  for (const [index, c] of categories.entries()) {
    await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name, color: c.color, sortOrder: index },
    });
  }

  await prisma.category.upsert({
    where: { name: "Uncategorized" },
    update: {},
    create: {
      name: "Uncategorized",
      color: "#9ca3af",
      sortOrder: 99,
      isSystem: true,
    },
  });

  console.log("Seed kategori selesai.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
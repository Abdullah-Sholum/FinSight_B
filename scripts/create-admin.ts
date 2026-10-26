import "dotenv/config";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAdminSchema } from "@/lib/validation/auth";

async function main() {
  const parsed = createAdminSchema.safeParse({
    email: process.argv[2],
    password: process.env.ADMIN_PASSWORD,
  });
  if (!parsed.success) {
    throw new Error(
      `Input tidak valid:\n${z.prettifyError(parsed.error)}\n` +
        "Pemakaian: $env:ADMIN_PASSWORD='...'; npx tsx scripts/create-admin.ts email@contoh.com",
    );
  }
  const { email, password } = parsed.data;

  // admin hanya satu orang
  const existing = await prisma.user.findMany({ select: { email: true } });
  if (existing.length > 0 && !existing.some((u) => u.email === email)) {
    throw new Error("Sudah ada admin dengan email lain. Skrip ini hanya untuk satu admin.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, role: "ADMIN" },
  });
  console.log(`Admin siap: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
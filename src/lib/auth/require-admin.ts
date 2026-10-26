import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export class UnauthorizedError extends Error {
  constructor() {
    super("Tidak berwenang");
    this.name = "UnauthorizedError";
  }
}

export async function requireAdmin() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new UnauthorizedError();

  // JWT tidak bisa dicabut, jadi pastikan user masih ada dan masih admin
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true },
  });
  if (!user || user.role !== "ADMIN") throw new UnauthorizedError();
  return user;
}
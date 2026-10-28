import { isUniqueViolation } from "@/lib/db-errors";
import { prisma } from "@/lib/prisma";
import { DomainError } from "./errors";

type CategoryInput = { name: string; color: string };

async function getCategory(id: number) {
  const c = await prisma.category.findUnique({ where: { id } });
  if (!c) throw new DomainError("Kategori tidak ditemukan.");
  return c;
}

async function assertNameFree(name: string, exceptId?: number) {
  const clash = await prisma.category.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { name: true },
  });
  if (clash) {
    throw new DomainError(`Nama sudah dipakai oleh kategori "${clash.name}".`);
  }
}

export async function createCategory(input: CategoryInput) {
  await assertNameFree(input.name);
  const last = await prisma.category.aggregate({
    _max: { sortOrder: true },
    where: { isSystem: false },
  });
  try {
    return await prisma.category.create({
      data: {
        name: input.name,
        color: input.color,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("Nama kategori sudah dipakai.");
    throw e;
  }
}

export async function updateCategory(id: number, input: CategoryInput) {
  const c = await getCategory(id);
  if (c.isSystem) throw new DomainError("Kategori sistem tidak bisa diubah.");
  await assertNameFree(input.name, id);
  try {
    return await prisma.category.update({
      where: { id },
      data: { name: input.name, color: input.color },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("Nama kategori sudah dipakai.");
    throw e;
  }
}

export async function deleteCategory(id: number) {
  const c = await getCategory(id);
  if (c.isSystem) throw new DomainError("Kategori sistem tidak bisa dihapus.");

  const [expenses, rules] = await Promise.all([
    prisma.expense.count({ where: { categoryId: id } }),
    prisma.categoryRule.count({ where: { categoryId: id } }),
  ]);
  if (expenses > 0 || rules > 0) {
    throw new DomainError(
      `Kategori masih dipakai ${expenses} item dan ${rules} aturan. Gunakan "Gabungkan" untuk memindahkannya dulu.`,
    );
  }
  await prisma.category.delete({ where: { id } });
}

export async function mergeCategory(fromId: number, toId: number) {
  const [from, to] = await Promise.all([getCategory(fromId), getCategory(toId)]);
  if (from.isSystem) throw new DomainError("Kategori sistem tidak bisa digabungkan.");
  if (to.isSystem) throw new DomainError("Tidak bisa menggabungkan ke kategori sistem.");

  return prisma.$transaction(async (tx) => {
    const expenses = await tx.expense.updateMany({
      where: { categoryId: fromId },
      data: { categoryId: toId },
    });
    const rules = await tx.categoryRule.updateMany({
      where: { categoryId: fromId },
      data: { categoryId: toId },
    });
    await tx.category.delete({ where: { id: fromId } });
    return { expenses: expenses.count, rules: rules.count, from: from.name, to: to.name };
  });
}
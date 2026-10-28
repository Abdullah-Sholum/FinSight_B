import { isUniqueViolation } from "@/lib/db-errors";
import { prisma } from "@/lib/prisma";
import { DomainError } from "./errors";

type RuleData = {
  keyword: string;
  categoryId: number;
  priority: number;
  note: string | null;
  isActive: boolean;
};

async function assertCategoryUsable(categoryId: number) {
  const c = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!c) throw new DomainError("Kategori tidak ditemukan.");
  if (c.isSystem) throw new DomainError("Aturan tidak boleh menunjuk ke Uncategorized.");
}

async function assertKeywordFree(keyword: string, exceptId?: number) {
  const clash = await prisma.categoryRule.findFirst({
    where: { keyword, ...(exceptId ? { id: { not: exceptId } } : {}) },
    include: { category: { select: { name: true } } },
  });
  if (clash) {
    throw new DomainError(
      `Kata kunci "${keyword}" sudah ada di kategori "${clash.category.name}". Ubah aturan itu, atau pilih kata kunci lain.`,
    );
  }
}

export async function createRule(input: RuleData) {
  await assertCategoryUsable(input.categoryId);
  await assertKeywordFree(input.keyword);
  try {
    return await prisma.categoryRule.create({ data: input });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("Kata kunci sudah dipakai.");
    throw e;
  }
}

export async function updateRule(id: number, input: RuleData) {
  const existing = await prisma.categoryRule.findUnique({ where: { id } });
  if (!existing) throw new DomainError("Aturan tidak ditemukan.");
  await assertCategoryUsable(input.categoryId);
  await assertKeywordFree(input.keyword, id);
  try {
    return await prisma.categoryRule.update({ where: { id }, data: input });
  } catch (e) {
    if (isUniqueViolation(e)) throw new DomainError("Kata kunci sudah dipakai.");
    throw e;
  }
}

export async function setRuleActive(id: number, isActive: boolean) {
  const existing = await prisma.categoryRule.findUnique({ where: { id } });
  if (!existing) throw new DomainError("Aturan tidak ditemukan.");
  await prisma.categoryRule.update({ where: { id }, data: { isActive } });
  return { keyword: existing.keyword };
}

export async function deleteRule(id: number) {
  const rule = await prisma.categoryRule.findUnique({ where: { id } });
  if (!rule) throw new DomainError("Aturan tidak ditemukan.");
  const used = await prisma.expense.count({ where: { ruleId: id } });
  await prisma.categoryRule.delete({ where: { id } });
  return { keyword: rule.keyword, used };
}
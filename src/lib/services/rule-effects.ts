import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import {
  buildMatcher,
  normalizeText,
  type RuleInput,
  type RuleMatch,
} from "@/lib/categorize";
import { prisma } from "@/lib/prisma";
import type { ChangeGroup, EffectSummary, ReapplyPreview } from "@/lib/rule-types";
import { DomainError } from "./errors";

type Db = Prisma.TransactionClient;
const MAX_GROUPS = 100;

type Ctx = {
  nameById: Map<number, string>;
  idByName: Map<string, number>;
  uncategorizedId: number;
  rules: RuleInput[];
  expenses: {
    id: number;
    item: string;
    amount: number;
    categoryId: number;
    categorySource: string;
    ruleId: number | null;
  }[];
};

async function loadContext(db: Db): Promise<Ctx> {
  const [categories, rules, expenses] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true } }),
    db.categoryRule.findMany({
      where: { isActive: true },
      select: {
        id: true,
        keyword: true,
        priority: true,
        category: { select: { name: true } },
      },
    }),
    db.expense.findMany({
      where: { dataset: { type: "REAL" } },
      orderBy: { id: "asc" }, // urutan tetap agar sidik jari konsisten
      select: {
        id: true,
        item: true,
        amount: true,
        categoryId: true,
        categorySource: true,
        ruleId: true,
      },
    }),
  ]);

  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const idByName = new Map(categories.map((c) => [c.name, c.id]));
  const uncategorizedId = idByName.get("Uncategorized");
  if (!uncategorizedId) {
    throw new DomainError('Kategori "Uncategorized" tidak ditemukan. Jalankan seed kategori.');
  }

  return {
    nameById,
    idByName,
    uncategorizedId,
    rules: rules.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      priority: r.priority,
      categoryName: r.category.name,
    })),
    expenses,
  };
}

// cakupan "terapkan ulang": hasil aturan, atau yang masih Uncategorized
const inScope = (ctx: Ctx, e: Ctx["expenses"][number]) =>
  e.categorySource === "RULE" || e.categoryId === ctx.uncategorizedId;

function resolve(ctx: Ctx, m: RuleMatch | null) {
  return {
    categoryId: (m && ctx.idByName.get(m.categoryName)) || ctx.uncategorizedId,
    ruleId: m?.ruleId ?? null,
  };
}

function groupChanges(
  ctx: Ctx,
  rows: { item: string; amount: number; from: number; to: number }[],
) {
  const map = new Map<string, ChangeGroup>();
  for (const r of rows) {
    const item = normalizeText(r.item);
    const key = `${item}|${r.from}|${r.to}`;
    const g = map.get(key) ?? {
      item,
      from: ctx.nameById.get(r.from) ?? "?",
      to: ctx.nameById.get(r.to) ?? "?",
      count: 0,
      amount: 0,
    };
    g.count++;
    g.amount += r.amount;
    map.set(key, g);
  }
  const all = [...map.values()].sort(
    (a, b) => b.count - a.count || b.amount - a.amount || a.item.localeCompare(b.item),
  );
  return {
    groups: all.slice(0, MAX_GROUPS),
    hiddenGroups: Math.max(0, all.length - MAX_GROUPS),
  };
}

function computeReapply(ctx: Ctx) {
  const match = buildMatcher(ctx.rules);
  const changes: {
    id: number;
    item: string;
    amount: number;
    from: number;
    to: number;
    ruleId: number | null;
  }[] = [];
  let scopeItems = 0;
  let metadataOnly = 0;

  for (const e of ctx.expenses) {
    if (!inScope(ctx, e)) continue;
    scopeItems++;
    const r = resolve(ctx, match(e.item));
    if (r.categoryId === e.categoryId && r.ruleId === e.ruleId) continue;
    if (r.categoryId === e.categoryId) metadataOnly++;
    changes.push({
      id: e.id,
      item: e.item,
      amount: e.amount,
      from: e.categoryId,
      to: r.categoryId,
      ruleId: r.ruleId,
    });
  }

  const categoryChanges = changes.filter((c) => c.from !== c.to);
  const digest = createHash("sha256")
    .update(changes.map((c) => `${c.id}:${c.to}:${c.ruleId ?? "-"}`).join("\n"))
    .digest("hex");
  return { changes, categoryChanges, scopeItems, metadataOnly, digest };
}

export async function getReapplyPreview(): Promise<ReapplyPreview> {
  const ctx = await loadContext(prisma);
  const r = computeReapply(ctx);
  const { groups, hiddenGroups } = groupChanges(ctx, r.categoryChanges);
  return {
    groups,
    hiddenGroups,
    totalChanged: r.categoryChanges.length,
    totalAmount: r.categoryChanges.reduce((a, c) => a + c.amount, 0),
    scopeItems: r.scopeItems,
    metadataOnly: r.metadataOnly,
    digest: r.digest,
  };
}

export async function applyReapply(expectedDigest: string) {
  return prisma.$transaction(
    async (tx) => {
      // dihitung ulang DI DALAM transaksi, lalu dibandingkan dengan pratinjau
      const ctx = await loadContext(tx);
      const r = computeReapply(ctx);
      if (r.digest !== expectedDigest) {
        throw new DomainError(
          "Data atau aturan berubah sejak pratinjau dibuat. Muat ulang halaman dan periksa pratinjau lagi.",
        );
      }
      if (r.changes.length === 0) return { updated: 0, categoryChanged: 0 };

      const groups = new Map<
        string,
        { categoryId: number; ruleId: number | null; ids: number[] }
      >();
      for (const c of r.changes) {
        const key = `${c.to}|${c.ruleId ?? "-"}`;
        const g = groups.get(key) ?? { categoryId: c.to, ruleId: c.ruleId, ids: [] };
        g.ids.push(c.id);
        groups.set(key, g);
      }
      for (const g of groups.values()) {
        await tx.expense.updateMany({
          where: { id: { in: g.ids } },
          data: { categoryId: g.categoryId, ruleId: g.ruleId, categorySource: "RULE" },
        });
      }
      return { updated: r.changes.length, categoryChanged: r.categoryChanges.length };
    },
    { timeout: 60_000 },
  );
}

export async function previewRuleChange(input: {
  id?: number;
  keyword: string;
  categoryId: number;
  priority: number;
  isActive: boolean;
}): Promise<EffectSummary> {
  const ctx = await loadContext(prisma);
  const categoryName = ctx.nameById.get(input.categoryId);
  if (!categoryName) throw new DomainError("Kategori tidak ditemukan.");
  if (categoryName === "Uncategorized") {
    throw new DomainError("Aturan tidak boleh menunjuk ke Uncategorized.");
  }

  const clash = await prisma.categoryRule.findFirst({
    where: { keyword: input.keyword, ...(input.id ? { id: { not: input.id } } : {}) },
    include: { category: { select: { name: true } } },
  });
  if (clash) {
    throw new DomainError(
      `Kata kunci "${input.keyword}" sudah ada di kategori "${clash.category.name}".`,
    );
  }

  const before = ctx.rules;
  const others = before.filter((r) => r.id !== input.id);
  const after: RuleInput[] = input.isActive
    ? [
        ...others,
        { id: input.id ?? -1, keyword: input.keyword, priority: input.priority, categoryName },
      ]
    : others;

  const matchBefore = buildMatcher(before);
  const matchAfter = buildMatcher(after);
  const rows: { item: string; amount: number; from: number; to: number }[] = [];
  let protectedMatches = 0;

  for (const e of ctx.expenses) {
    const b = resolve(ctx, matchBefore(e.item));
    const a = resolve(ctx, matchAfter(e.item));
    if (b.categoryId === a.categoryId && b.ruleId === a.ruleId) continue;
    if (a.categoryId === e.categoryId) continue; // tidak ada perubahan kategori yang terlihat
    if (!inScope(ctx, e)) {
      protectedMatches++;
      continue;
    }
    rows.push({ item: e.item, amount: e.amount, from: e.categoryId, to: a.categoryId });
  }

  const { groups, hiddenGroups } = groupChanges(ctx, rows);
  return {
    groups,
    hiddenGroups,
    totalChanged: rows.length,
    totalAmount: rows.reduce((a, r) => a + r.amount, 0),
    protectedMatches,
  };
}

// jumlah item data asli yang "dimenangkan" tiap aturan aktif
export async function getRuleHits(): Promise<Map<number, number>> {
  const ctx = await loadContext(prisma);
  const match = buildMatcher(ctx.rules);

  const counts = new Map<string, number>();
  for (const e of ctx.expenses) {
    const k = normalizeText(e.item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const hits = new Map<number, number>();
  for (const [item, n] of counts) {
    const m = match(item);
    if (m?.ruleId != null) hits.set(m.ruleId, (hits.get(m.ruleId) ?? 0) + n);
  }
  return hits;
}
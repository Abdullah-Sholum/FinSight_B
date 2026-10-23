import type { ParsedLine, RowError } from "./parse";

type ExpenseLine = Extract<ParsedLine, { kind: "expense" }>;
const isExpense = (r: ParsedLine): r is ExpenseLine => r.kind === "expense";

export type PlannedExpense = {
  legacyId: number;
  item: string;
  amount: number;
  categoryId: number;
  categoryName: string;
};

export type PlannedDay = {
  date: string;
  isEmptyDay: boolean;
  expenses: PlannedExpense[];
};

type PlanInput = {
  rows: ParsedLine[];
  parseErrors: RowError[];
  totalRows: number;
  categoryIdByName: Map<string, number>;
  existingDates: Set<string>;
};

function findGaps(sortedDates: string[]) {
  if (sortedDates.length < 2) return [];
  const have = new Set(sortedDates);
  const start = Date.parse(`${sortedDates[0]}T00:00:00Z`);
  const end = Date.parse(`${sortedDates[sortedDates.length - 1]}T00:00:00Z`);
  const gaps: string[] = [];
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (!have.has(d)) gaps.push(d);
  }
  return gaps;
}

export function buildPlan(input: PlanInput) {
  const errors: RowError[] = [...input.parseErrors];
  const badDates = new Set<string>();

  for (const e of input.parseErrors) if (e.date) badDates.add(e.date);

  // id ganda
  const firstById = new Map<number, ParsedLine>();
  for (const r of input.rows) {
    const first = firstById.get(r.legacyId);
    if (first) {
      errors.push({
        line: r.line,
        legacyId: String(r.legacyId),
        date: r.date,
        message: `id ${r.legacyId} ganda (pertama muncul di baris ${first.line})`,
      });
      badDates.add(r.date);
      badDates.add(first.date);
    } else {
      firstById.set(r.legacyId, r);
    }
  }

  // kelompokkan per tanggal
  const byDate = new Map<string, ParsedLine[]>();
  for (const r of input.rows) {
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }

  const days: PlannedDay[] = [];
  const skippedExistingDates: string[] = [];
  const rejectedDates: string[] = [];

  for (const [date, rows] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
    const expenseRows = rows.filter(isExpense);
    const emptyRows = rows.filter((r) => r.kind === "empty");

    if (emptyRows.length > 0 && expenseRows.length > 0) {
      errors.push({ line: emptyRows[0].line, date, message: "Hari kosong bercampur dengan baris pengeluaran di tanggal yang sama" });
      badDates.add(date);
    }
    if (emptyRows.length > 1) {
      errors.push({ line: emptyRows[1].line, date, message: "Lebih dari satu baris hari kosong di tanggal yang sama" });
      badDates.add(date);
    }

    const planned: PlannedExpense[] = [];
    for (const r of expenseRows) {
      const categoryId = input.categoryIdByName.get(r.category);
      if (categoryId === undefined) {
        errors.push({ line: r.line, legacyId: String(r.legacyId), date, message: `Kategori "${r.category}" tidak ada di database` });
        badDates.add(date);
        continue;
      }
      planned.push({ legacyId: r.legacyId, item: r.item, amount: r.amount, categoryId, categoryName: r.category });
    }

    if (input.existingDates.has(date)) {
      skippedExistingDates.push(date);
    } else if (badDates.has(date)) {
      rejectedDates.push(date);
    } else {
      days.push({ date, isEmptyDay: expenseRows.length === 0, expenses: planned });
    }
  }

  // statistik dari hari yang akan diimpor
  const perCategory = new Map<string, { count: number; amount: number }>();
  let totalAmount = 0;
  let expenseCount = 0;
  for (const day of days) {
    for (const e of day.expenses) {
      expenseCount++;
      totalAmount += e.amount;
      const c = perCategory.get(e.categoryName) ?? { count: 0, amount: 0 };
      c.count++;
      c.amount += e.amount;
      perCategory.set(e.categoryName, c);
    }
  }
  const uncategorized = perCategory.get("Uncategorized")?.count ?? 0;

  return {
    days,
    skippedExistingDates,
    rejectedDates,
    errors,
    gapDates: findGaps(days.map((d) => d.date)),
    stats: {
      totalRows: input.totalRows,
      errorRows: input.parseErrors.length,
      importedDays: days.length,
      expenseDays: days.filter((d) => !d.isEmptyDay).length,
      emptyDays: days.filter((d) => d.isEmptyDay).length,
      expenseCount,
      totalAmount,
      uncategorizedPct: expenseCount ? (uncategorized / expenseCount) * 100 : 0,
      perCategory,
    },
  };
}
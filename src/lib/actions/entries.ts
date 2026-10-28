"use server";

import { revalidatePath } from "next/cache";
import * as entries from "@/lib/services/entries";
import {
  dayActionSchema,
  dateSchema,
  deleteExpenseSchema,
  parseNewRows,
  updateExpenseSchema,
} from "@/lib/validation/entry";
import { guard } from "./guard";
import { fail, type ActionResult } from "./result";

function revalidateEntry(date: string) {
  revalidatePath(`/admin/entri/${date}`);
  revalidatePath("/admin/entri");
  revalidatePath("/admin");
}

export async function addExpensesAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const date = dateSchema.safeParse(formData.get("date"));
    if (!date.success) return fail(date.error);

    const { rows, fieldErrors } = parseNewRows(formData);
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: "Periksa baris yang ditandai.", fieldErrors };
    }

    const r = await entries.addExpenses(date.data, rows);
    revalidateEntry(date.data);
    return {
      ok: true,
      message:
        `${r.count} item disimpan.` +
        (r.uncategorized > 0
          ? ` ${r.uncategorized} masuk Uncategorized: pertimbangkan menambah aturan kategori.`
          : ""),
    };
  });
}

export async function updateExpenseAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = updateExpenseSchema.safeParse({
      id: formData.get("id"),
      item: formData.get("item"),
      amount: formData.get("amount"),
      categoryId: formData.get("categoryId"),
    });
    if (!parsed.success) return fail(parsed.error);

    const { date } = await entries.updateExpense(parsed.data.id, parsed.data);
    revalidateEntry(date);
    return { ok: true, message: "Item diperbarui." };
  });
}

export async function deleteExpenseAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = deleteExpenseSchema.safeParse({
      id: formData.get("id"),
      whenLast: formData.get("whenLast"),
    });
    if (!parsed.success) return fail(parsed.error);

    const { date } = await entries.deleteExpense(parsed.data.id, parsed.data.whenLast);
    revalidateEntry(date);
    return { ok: true, message: "Item dihapus." };
  });
}

export async function markEmptyDayAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = dayActionSchema.safeParse({ date: formData.get("date") });
    if (!parsed.success) return fail(parsed.error);

    await entries.markEmptyDay(parsed.data.date);
    revalidateEntry(parsed.data.date);
    return { ok: true, message: "Ditandai tanpa pengeluaran." };
  });
}

export async function clearEmptyDayAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = dayActionSchema.safeParse({ date: formData.get("date") });
    if (!parsed.success) return fail(parsed.error);

    await entries.clearEmptyDay(parsed.data.date);
    revalidateEntry(parsed.data.date);
    return { ok: true, message: "Tanda kosong dibatalkan." };
  });
}
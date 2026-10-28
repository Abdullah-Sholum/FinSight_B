import { z } from "zod";
import { isRealDate } from "./import-row";

export const dateSchema = z.string().refine(isRealDate, "Tanggal tidak valid");

const itemSchema = z
  .string()
  .trim()
  .min(1, "Item wajib diisi")
  .max(100, "Maksimal 100 karakter")
  .transform((s) => s.replace(/\s+/g, " "));

const amountSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Nominal harus berupa angka bulat positif")
  .transform(Number)
  .pipe(
    z
      .number()
      .int()
      .positive("Nominal harus lebih dari 0")
      .max(1_000_000_000, "Nominal terlalu besar"),
  );

// "" berarti "otomatis dari aturan"
const categoryChoiceSchema = z
  .string()
  .trim()
  .regex(/^\d*$/, "Kategori tidak valid")
  .transform((v) => (v === "" ? null : Number(v)));

export const expenseFieldsSchema = z.object({
  item: itemSchema,
  amount: amountSchema,
  categoryId: categoryChoiceSchema,
});

export const updateExpenseSchema = expenseFieldsSchema.extend({
  id: z.coerce.number().int().positive(),
});

export const deleteExpenseSchema = z.object({
  id: z.coerce.number().int().positive(),
  whenLast: z.enum(["empty", "remove"]).nullish(),
});

export const dayActionSchema = z.object({ date: dateSchema });

// Form tambah punya banyak baris; error dikembalikan per baris ("item.0", "amount.2", ...)
export function parseNewRows(formData: FormData) {
  const items = formData.getAll("item").map(String);
  const amounts = formData.getAll("amount").map(String);
  const cats = formData.getAll("categoryId").map(String);

  const rows: { item: string; amount: number; categoryId: number | null }[] = [];
  const fieldErrors: Record<string, string[]> = {};

  items.forEach((item, i) => {
    const raw = { item, amount: amounts[i] ?? "", categoryId: cats[i] ?? "" };
    // baris yang item dan nominalnya sama-sama kosong diabaikan
    if (!raw.item.trim() && !raw.amount.trim()) return;

    const parsed = expenseFieldsSchema.safeParse(raw);
    if (parsed.success) {
      rows.push(parsed.data);
    } else {
      for (const [field, msgs] of Object.entries(z.flattenError(parsed.error).fieldErrors)) {
        fieldErrors[`${field}.${i}`] = (msgs ?? []) as string[];
      }
    }
  });

  return { rows, fieldErrors };
}
import { z } from "zod";

export function isRealDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const csvRowSchema = z
  .object({
    id: z.coerce.number().int().positive(),
    date: z
      .string()
      .refine(isRealDate, "Tanggal harus berformat YYYY-MM-DD dan ada di kalender"),
    year: z.coerce.number().int(),
    month: z.coerce.number().int(),
    day: z.coerce.number().int(),
    item: z.string().trim().min(1).optional(),
    amount: z.coerce
      .number()
      .int("Nominal harus bilangan bulat")
      .positive("Nominal harus lebih dari 0")
      .optional(),
    category: z.string().trim().min(1).optional(),
  })
  .superRefine((row, ctx) => {
    if (isRealDate(row.date)) {
      const [y, m, d] = row.date.split("-").map(Number);
      if (y !== row.year || m !== row.month || d !== row.day) {
        ctx.addIssue({
          code: "custom",
          path: ["date"],
          message: "Kolom year/month/day tidak cocok dengan kolom date",
        });
      }
    }
    const filled = [row.item, row.amount, row.category].filter(
      (v) => v !== undefined,
    ).length;
    if (filled !== 0 && filled !== 3) {
      ctx.addIssue({
        code: "custom",
        path: ["item"],
        message: "Item, amount, dan category harus terisi semua atau kosong semua",
      });
    }
  })
  .transform((row) => {
    if (
      row.item === undefined ||
      row.amount === undefined ||
      row.category === undefined
    ) {
      return { kind: "empty" as const, legacyId: row.id, date: row.date };
    }
    return {
      kind: "expense" as const,
      legacyId: row.id,
      date: row.date,
      item: row.item,
      amount: row.amount,
      category: row.category,
    };
  });

export type ParsedRow = z.output<typeof csvRowSchema>;
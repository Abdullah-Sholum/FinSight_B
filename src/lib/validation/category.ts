import { z } from "zod";

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi")
    .max(40, "Maksimal 40 karakter")
    .transform((s) => s.replace(/\s+/g, " ")),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Warna harus berformat #RRGGBB"),
});

const id = z.coerce.number().int().positive();

export const updateCategorySchema = categoryFormSchema.extend({ id });
export const deleteCategorySchema = z.object({ id });
export const mergeCategorySchema = z
  .object({ fromId: id, toId: id })
  .refine((v) => v.fromId !== v.toId, {
    message: "Kategori asal dan tujuan harus berbeda",
    path: ["toId"],
  });
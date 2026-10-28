import { z } from "zod";
import { normalizeText } from "@/lib/categorize";

const id = z.coerce.number().int().positive();

export const ruleFormSchema = z.object({
  keyword: z
    .string()
    .trim()
    .min(1, "Kata kunci wajib diisi")
    .max(60, "Maksimal 60 karakter")
    .transform(normalizeText)
    .refine((k) => /[a-z0-9]/.test(k), "Kata kunci harus mengandung huruf atau angka"),
  categoryId: z.coerce.number().int().positive("Pilih kategori"),
  priority: z.coerce.number().int().min(-100).max(100),
  note: z
    .string()
    .trim()
    .max(200, "Maksimal 200 karakter")
    .transform((s) => (s === "" ? null : s)),
  isActive: z.boolean(),
});

export const updateRuleSchema = ruleFormSchema.extend({ id });
export const previewRuleSchema = ruleFormSchema.extend({ id: id.optional() });
export const deleteRuleSchema = z.object({ id });
export const setRuleActiveSchema = z.object({
  id,
  isActive: z.enum(["true", "false"]).transform((v) => v === "true"),
});
export const applyReapplySchema = z.object({
  digest: z.string().regex(/^[a-f0-9]{64}$/, "Pratinjau tidak valid"),
});
import { z } from "zod";
import { isRealDate } from "./import-row";

const seed = z
  .string()
  .trim()
  .regex(/^\d{0,10}$/, "Seed harus berupa angka bulat positif")
  .transform((v) => (v === "" ? null : Number(v)))
  .pipe(z.number().int().min(0).max(2_147_483_646, "Seed maksimal 2147483646").nullable());

const endDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().refine(isRealDate, "Tanggal tidak valid").nullable());

export const createDraftSchema = z.object({
  seed,
  privacy: z.enum(["LOW", "BALANCED", "HIGH"], "Pilih tingkat privasi"),
  endDate,
});

const id = z.coerce.number().int().positive();
export const datasetIdSchema = z.object({ id });
export const deleteDatasetSchema = z.object({
  id,
  confirm: z.literal("HAPUS", 'Ketik "HAPUS" untuk konfirmasi'),
});
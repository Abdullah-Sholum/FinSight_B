import { z } from "zod";
import { MAX_IMPORT_BYTES } from "@/lib/import-types";

// pengecekan bentuk, bukan instanceof: kelas File bisa berbeda antar runtime
const isFileLike = (v: unknown): v is File =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as File).text === "function" &&
  typeof (v as File).size === "number" &&
  typeof (v as File).name === "string";

const file = z
  .custom<File>(isFileLike, "Pilih file CSV")
  .refine((f) => f.size > 0, "File kosong")
  .refine((f) => f.size <= MAX_IMPORT_BYTES, "Ukuran file maksimal 2 MB")
  .refine((f) => /\.csv$/i.test(f.name), "File harus berekstensi .csv");

export const analyzeImportSchema = z.object({ file });

export const commitImportSchema = z.object({
  file,
  digest: z.string().regex(/^[a-f0-9]{64}$/, "Laporan tidak valid"),
  allowErrors: z.boolean(),
});

export const rollbackImpactSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const rollbackBatchSchema = z.object({
  id: z.coerce.number().int().positive(),
  confirm: z.literal("BATALKAN", 'Ketik "BATALKAN" untuk konfirmasi'),
});
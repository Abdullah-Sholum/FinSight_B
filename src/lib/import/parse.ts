import { parse } from "csv-parse/sync";
import {
  csvRowSchema,
  isRealDate,
  type ParsedRow,
} from "@/lib/validation/import-row";

export type RowError = {
  line: number;
  legacyId?: string;
  date?: string;
  message: string;
};

export type ParsedLine = ParsedRow & { line: number };

const REQUIRED_COLUMNS = [
  "id", "date", "year", "month", "day", "item", "amount", "category",
];

type RawRecord = { record: Record<string, string>; info: { lines: number } };

export function parseCsv(text: string) {
  const rows: ParsedLine[] = [];
  const errors: RowError[] = [];

  let records: RawRecord[];
  try {
    records = parse(text, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      info: true,
    }) as RawRecord[];
  } catch (e) {
    errors.push({ line: 0, message: `CSV tidak bisa dibaca: ${(e as Error).message}` });
    return { rows, errors, totalRows: 0 };
  }

  if (records.length === 0) {
    errors.push({ line: 0, message: "File CSV kosong" });
    return { rows, errors, totalRows: 0 };
  }

  const header = Object.keys(records[0].record);
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    errors.push({ line: 1, message: `Kolom wajib tidak ditemukan: ${missing.join(", ")}` });
    return { rows, errors, totalRows: records.length };
  }

  for (const { record, info } of records) {
    // sel kosong -> tidak ada nilai
    const cleaned = Object.fromEntries(
      Object.entries(record).map(([k, v]) => [k, v?.trim() === "" ? undefined : v?.trim()]),
    );

    const result = csvRowSchema.safeParse(cleaned);
    if (result.success) {
      rows.push({ ...result.data, line: info.lines });
    } else {
      errors.push({
        line: info.lines,
        legacyId: record.id,
        date: record.date && isRealDate(record.date) ? record.date : undefined,
        message: result.error.issues
          .map((i) => `${i.path.join(".") || "baris"}: ${i.message}`)
          .join("; "),
      });
    }
  }

  return { rows, errors, totalRows: records.length };
}
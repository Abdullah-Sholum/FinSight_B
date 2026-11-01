export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export type ImportErrorInfo = {
  line: number;
  legacyId?: string;
  date?: string;
  message: string;
};

export type ImportReport = {
  fileName: string;
  digest: string;
  totalRows: number;
  importedDays: number;
  expenseDays: number;
  emptyDays: number;
  expenseCount: number;
  totalAmount: number;
  uncategorizedPct: number; // per item, dalam persen
  skippedExistingDates: number;
  rejectedDates: number;
  gapDates: number;
  perCategory: { name: string; count: number; amount: number }[];
  errors: ImportErrorInfo[]; // maksimal 50 pertama
  errorCount: number; // jumlah seluruhnya
};

export type BatchError = {
  line?: number;
  legacyId?: string;
  date?: string;
  message: string;
  code?: string;
};

export type RollbackImpact = {
  batchId: number;
  fileName: string;
  entries: number;
  expenses: number;
  laterAdded: number; // ditambahkan lewat form setelah import
  manual: number; // berkategori manual
};
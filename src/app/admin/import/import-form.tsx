"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { analyzeImportAction, commitImportAction } from "@/lib/actions/imports";
import { rupiah } from "@/lib/format";
import { MAX_IMPORT_BYTES, type ImportReport } from "@/lib/import-types";

const REQUEST_FAILED =
  "Permintaan gagal. Kemungkinan sesi sudah berakhir: muat ulang halaman dan login lagi.";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ReportView({
  report,
  allowErrors,
  onAllowErrors,
  onSave,
  saving,
}: {
  report: ImportReport;
  allowErrors: boolean;
  onAllowErrors: (v: boolean) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const hasErrors = report.errorCount > 0;
  const nothingToSave = report.importedDays === 0;
  const blocked = nothingToSave || (hasErrors && !allowErrors);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Laporan: {report.fileName} (belum ada yang disimpan)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Baris di CSV" value={String(report.totalRows)} />
          <Metric
            label="Hari yang akan diimpor"
            value={String(report.importedDays)}
            hint={`${report.expenseDays} berpengeluaran · ${report.emptyDays} kosong`}
          />
          <Metric
            label="Item pengeluaran"
            value={String(report.expenseCount)}
            hint={rupiah(report.totalAmount)}
          />
          <Metric
            label="Uncategorized"
            value={`${report.uncategorizedPct.toFixed(2)}%`}
            hint="per item"
          />
          <Metric label="Tanggal dilewati" value={String(report.skippedExistingDates)} hint="sudah ada di database" />
          <Metric label="Tanggal ditolak" value={String(report.rejectedDates)} hint="mengandung error" />
          <Metric label="Celah tanggal" value={String(report.gapDates)} hint="di dalam hari yang diimpor" />
          <Metric label="Masalah ditemukan" value={String(report.errorCount)} />
        </div>

        {report.perCategory.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Item</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.perCategory.map((c) => (
                <TableRow key={c.name}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="text-right">{c.count}</TableCell>
                  <TableCell className="text-right">{rupiah(c.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {hasErrors && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-destructive">Masalah ({report.errorCount})</h3>
            <ul className="space-y-1 text-sm">
              {report.errors.map((e, i) => (
                <li key={i}>
                  baris {e.line}
                  {e.legacyId ? ` (id ${e.legacyId})` : ""}
                  {e.date ? ` · ${e.date}` : ""}: {e.message}
                </li>
              ))}
            </ul>
            {report.errorCount > report.errors.length && (
              <p className="text-xs text-muted-foreground">
                Menampilkan {report.errors.length} dari {report.errorCount}.
              </p>
            )}
          </div>
        )}

        <div className="space-y-3 border-t pt-4">
          {nothingToSave && (
            <p className="text-sm text-muted-foreground">
              Tidak ada hari baru yang bisa disimpan (semua tanggal sudah ada, ditolak, atau file
              kosong).
            </p>
          )}
          {hasErrors && !nothingToSave && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={allowErrors}
                onChange={(e) => onAllowErrors(e.target.checked)}
              />
              <span>
                Tetap simpan hari yang valid saja. Hari yang mengandung masalah dilewati
                sepenuhnya.
              </span>
            </label>
          )}
          <Button onClick={onSave} disabled={blocked || saving}>
            {saving
              ? "Menyimpan..."
              : `Simpan ${report.importedDays} hari (${report.expenseCount} item)`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ImportForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [allowErrors, setAllowErrors] = useState(false);
  const [busy, setBusy] = useState<"analyze" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setReport(null);
    setAllowErrors(false);
    setSuccess(null);
    setError(null);

    // batas diperiksa di sini: error "body terlalu besar" dari server tidak bisa ditangkap
    if (f && f.size > MAX_IMPORT_BYTES) {
      setFile(null);
      e.target.value = "";
      setError("Ukuran file maksimal 2 MB.");
      return;
    }
    setFile(f);
  }

  async function analyze() {
    if (!file) return;
    setBusy("analyze");
    setError(null);
    setSuccess(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await analyzeImportAction(fd);
      if (r.ok && r.data) {
        setReport(r.data);
        setAllowErrors(false);
      } else if (!r.ok) {
        setReport(null);
        setError(r.fieldErrors?.file?.[0] ?? r.error);
      }
    } catch {
      setError(REQUEST_FAILED);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!file || !report) return;
    setBusy("commit");
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("digest", report.digest);
      if (allowErrors) fd.set("allowErrors", "on");
      const r = await commitImportAction(fd);
      if (r.ok) {
        setSuccess(r.message ?? "Import selesai.");
        setReport(null);
        setFile(null);
        setAllowErrors(false);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setError(r.error);
      }
    } catch {
      setError(REQUEST_FAILED);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Unggah CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            File diproses di memori server dan tidak disimpan. Kolom raw_line dan source_file
            diabaikan. Format UTF-8, maksimal 2 MB. Tanggal yang sudah ada dilewati.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="csv-file">File CSV</Label>
              <Input
                id="csv-file"
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onPick}
                className="w-72"
              />
            </div>
            <Button onClick={analyze} disabled={!file || busy !== null}>
              {busy === "analyze" ? "Memeriksa..." : "Periksa file"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="text-sm text-green-600 dark:text-green-500">
              {success}
            </p>
          )}
        </CardContent>
      </Card>

      {report && (
        <ReportView
          report={report}
          allowErrors={allowErrors}
          onAllowErrors={setAllowErrors}
          onSave={save}
          saving={busy === "commit"}
        />
      )}
    </div>
  );
}
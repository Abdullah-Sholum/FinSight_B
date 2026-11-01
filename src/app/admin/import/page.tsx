import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getImportBatches } from "@/lib/data/admin";
import { formatDateTime } from "@/lib/format";
import { BatchRowActions } from "./batch-actions";
import { ImportForm } from "./import-form";

const STATUS = {
  COMPLETED: { label: "Selesai", variant: "secondary" },
  FAILED: { label: "Gagal", variant: "destructive" },
  ROLLED_BACK: { label: "Dibatalkan", variant: "outline" },
} as const;

export default async function ImportPage() {
  const batches = await getImportBatches();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Import CSV</h1>
        <p className="text-sm text-muted-foreground">
          Selalu periksa laporannya dulu sebelum menyimpan. Satu import bisa dibatalkan dari
          riwayat di bawah.
        </p>
      </div>

      <ImportForm />

      <Card>
        <CardHeader>
          <CardTitle>Riwayat import</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada import.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Waktu (WIB)</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Baris</TableHead>
                  <TableHead className="text-right">Data sekarang</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => {
                  const s = STATUS[b.status];
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">#{b.id}</TableCell>
                      <TableCell>{formatDateTime(b.createdAt)}</TableCell>
                      <TableCell className="max-w-48 truncate">{b.fileName}</TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {b.successRows} / {b.totalRows}
                        {b.failedRows > 0 && (
                          <span className="text-destructive"> ({b.failedRows} gagal)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {b.status === "COMPLETED"
                          ? `${b.entriesLeft} hari · ${b.expensesLeft} item`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <BatchRowActions
                          batch={{ id: b.id, fileName: b.fileName, status: b.status, errors: b.errors }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getReapplyPreview } from "@/lib/data/admin";
import { rupiah } from "@/lib/format";
import { ApplyReapplyButton } from "./apply-button";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function ReapplyPage() {
  const p = await getReapplyPreview();
  const upToDate = p.totalChanged === 0 && p.metadataOnly === 0;

  return (
    <div className="space-y-6">
      <Link href="/admin/aturan" className="text-sm text-muted-foreground hover:underline">
        ← Aturan kategori
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Terapkan ulang aturan</h1>
        <p className="text-sm text-muted-foreground">
          Hanya item berasal aturan dan item yang masih Uncategorized yang ikut dihitung. Koreksi
          manual dan item import yang sudah berkategori tidak disentuh.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Item dalam cakupan" value={String(p.scopeItems)} />
        <Stat
          label="Akan berpindah kategori"
          value={String(p.totalChanged)}
          hint={p.totalChanged > 0 ? rupiah(p.totalAmount) : undefined}
        />
        <Stat
          label="Hanya pembaruan catatan aturan"
          value={String(p.metadataOnly)}
          hint="kategori sama, aturan pemenangnya berbeda"
        />
      </div>

      {upToDate ? (
        <p className="text-sm text-muted-foreground">
          Semua item dalam cakupan sudah selaras dengan aturan saat ini.
        </p>
      ) : (
        <>
          {p.groups.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Dari</TableHead>
                  <TableHead>Ke</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.groups.map((g) => (
                  <TableRow key={`${g.item}|${g.from}|${g.to}`}>
                    <TableCell className="font-medium">{g.item}</TableCell>
                    <TableCell>{g.from}</TableCell>
                    <TableCell className={g.to === "Uncategorized" ? "text-destructive" : undefined}>
                      {g.to}
                    </TableCell>
                    <TableCell className="text-right">{g.count}</TableCell>
                    <TableCell className="text-right">{rupiah(g.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {p.hiddenGroups > 0 && (
            <p className="text-xs text-muted-foreground">
              {p.hiddenGroups} kelompok lagi tidak ditampilkan.
            </p>
          )}
          <ApplyReapplyButton
            digest={p.digest}
            totalChanged={p.totalChanged}
            metadataOnly={p.metadataOnly}
          />
        </>
      )}
    </div>
  );
}
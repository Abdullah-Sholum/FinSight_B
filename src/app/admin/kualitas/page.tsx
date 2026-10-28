import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCategoryOptions, getQualityReport, getRuleInputs } from "@/lib/data/admin";
import { todayInJakarta } from "@/lib/dates";
import { formatDate, percent, rupiah } from "@/lib/format";
import { RuleDataProvider, RuleDialog } from "../aturan/rule-dialogs";

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

export default async function QualityPage() {
  const today = todayInJakarta();
  const [report, categories, hints] = await Promise.all([
    getQualityReport(today),
    getCategoryOptions(),
    getRuleInputs(),
  ]);
  if (!report) {
    return <p>Dataset &quot;Data Asli&quot; belum ada. Jalankan import dulu.</p>;
  }

  const { quality: q, unrecordedCount, drift } = report;
  const usable = categories.filter((c) => !c.isSystem).map((c) => ({ id: c.id, name: c.name }));

  return (
    <RuleDataProvider categories={usable} rules={hints}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Kualitas data</h1>
          <p className="text-sm text-muted-foreground">
            Jaga Uncategorized tetap rendah dengan menambah aturan, lalu terapkan ulang.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Uncategorized (per item)"
            value={percent(q.uncategorized.itemShare, 2)}
            hint={`${q.uncategorized.items} item`}
          />
          <Stat
            label="Uncategorized (per nominal)"
            value={percent(q.uncategorized.amountShare, 2)}
            hint={rupiah(q.uncategorized.amount)}
          />
          <Stat
            label="Item belum selaras dengan aturan"
            value={String(drift.totalChanged)}
            hint={
              drift.totalChanged > 0
                ? "ada perubahan yang menunggu diterapkan"
                : "semua selaras"
            }
          />
          <Stat
            label="Celah tanggal dalam rentang data"
            value={String(q.gapCount)}
            hint="tanggal di antara catatan pertama dan terakhir"
          />
          <Stat
            label="Belum dicatat sampai hari ini"
            value={String(unrecordedCount)}
            hint="termasuk hari-hari setelah catatan terakhir"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/admin/aturan/terapkan" className={buttonVariants({ variant: "outline" })}>
            Pratinjau terapkan ulang
          </Link>
          <Link href="/admin/entri" className={buttonVariants({ variant: "outline" })}>
            Buka entri harian
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Item Uncategorized terbanyak</CardTitle>
          </CardHeader>
          <CardContent>
            {q.topUncategorized.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada item Uncategorized.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.topUncategorized.map((i) => (
                    <TableRow key={i.item}>
                      <TableCell className="font-medium">{i.item}</TableCell>
                      <TableCell className="text-right">{i.count}</TableCell>
                      <TableCell className="text-right">{rupiah(i.total)}</TableCell>
                      <TableCell className="text-right">
                        <RuleDialog
                          label="Buat aturan"
                          variant="outline"
                          size="sm"
                          initialKeyword={i.item}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Celah tanggal ({q.gapCount})</CardTitle>
          </CardHeader>
          <CardContent>
            {q.gapCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada tanggal yang terlewat di dalam rentang data.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {q.gapDates.map((d) => (
                  <Link
                    key={d}
                    href={`/admin/entri/${d}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {formatDate(d)}
                  </Link>
                ))}
              </div>
            )}
            {q.gapCount > q.gapDates.length && (
              <p className="mt-3 text-xs text-muted-foreground">
                Menampilkan {q.gapDates.length} dari {q.gapCount}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </RuleDataProvider>
  );
}
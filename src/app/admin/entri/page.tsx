import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
import {
  getEntriesOfMonth,
  getEntryBounds,
  getUnrecordedDates,
} from "@/lib/data/admin";
import { isMonthKey, shiftMonth, todayInJakarta } from "@/lib/dates";
import { formatDate, formatMonth, formatWeekday, rupiah } from "@/lib/format";
import { DateJump, MarkEmptyButton } from "./entry-forms";

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const { bulan } = await searchParams;
  const today = todayInJakarta();
  const month = bulan && isMonthKey(bulan) ? bulan : today.slice(0, 7);

  const [data, bounds, unrecorded] = await Promise.all([
    getEntriesOfMonth(month),
    getEntryBounds(),
    getUnrecordedDates(today),
  ]);

  const prev = bounds.first && month > bounds.first.slice(0, 7) ? shiftMonth(month, -1) : null;
  const next = month < today.slice(0, 7) ? shiftMonth(month, 1) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Entri harian</h1>
          <p className="text-sm text-muted-foreground">
            Hari ini: {formatWeekday(today)}, {formatDate(today)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateJump max={today} initial={today} />
          <Link href={`/admin/entri/${today}`} className={buttonVariants()}>
            Catat hari ini
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Belum dicatat ({unrecorded.count})</CardTitle>
        </CardHeader>
        <CardContent>
          {unrecorded.count === 0 ? (
            <p className="text-sm text-muted-foreground">
              Semua tanggal sampai hari ini sudah tercatat.
            </p>
          ) : (
            <ul className="divide-y">
              {unrecorded.dates.map((d) => (
                <li
                  key={d}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    {formatWeekday(d)}, {formatDate(d)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/entri/${d}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Catat
                    </Link>
                    <MarkEmptyButton date={d} size="sm" />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {unrecorded.count > unrecorded.dates.length && (
            <p className="mt-3 text-xs text-muted-foreground">
              Menampilkan {unrecorded.dates.length} terbaru dari {unrecorded.count}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{formatMonth(month)}</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            {prev ? (
              <Link href={`/admin/entri?bulan=${prev}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                ← {formatMonth(prev)}
              </Link>
            ) : null}
            {next ? (
              <Link href={`/admin/entri?bulan=${next}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {formatMonth(next)} →
              </Link>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada catatan di bulan ini.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.date}>
                    <TableCell>
                      <Link href={`/admin/entri/${r.date}`} className="font-medium hover:underline">
                        {formatWeekday(r.date)}, {formatDate(r.date)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {r.isEmptyDay ? (
                        <Badge variant="secondary">Tidak ada pengeluaran</Badge>
                      ) : (
                        <span className="text-sm">{r.items} item</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{rupiah(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Total bulan ini: <span className="font-medium text-foreground">{rupiah(data.monthTotal)}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
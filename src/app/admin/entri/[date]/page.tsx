import Link from "next/link";
import { notFound } from "next/navigation";
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
  getCategoryOptions,
  getDayDetail,
  getRuleInputs,
} from "@/lib/data/admin";
import { addDays, todayInJakarta } from "@/lib/dates";
import { formatDate, formatWeekday, rupiah } from "@/lib/format";
import { isRealDate } from "@/lib/validation/import-row";
import {
  AddExpensesForm,
  ClearEmptyButton,
  ExpenseActions,
  MarkEmptyButton,
} from "../entry-forms";

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isRealDate(date)) notFound();

  const today = todayInJakarta();
  const backLink = (
    <Link href="/admin/entri" className="text-sm text-muted-foreground hover:underline">
      ← Entri harian
    </Link>
  );

  if (date > today) {
    return (
      <div className="space-y-3">
        {backLink}
        <p>Tanggal ini masih di masa depan dan belum bisa dicatat.</p>
      </div>
    );
  }

  const [day, categories, rules] = await Promise.all([
    getDayDetail(date),
    getCategoryOptions(),
    getRuleInputs(),
  ]);
  const { entry, expenses, total } = day;
  const prevDate = addDays(date, -1);
  const nextDate = date < today ? addDays(date, 1) : null;

  return (
    <div className="space-y-6">
      {backLink}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">
            {formatWeekday(date)}, {formatDate(date)}
          </h1>
          {!entry ? (
            <Badge variant="outline">Belum dicatat</Badge>
          ) : entry.isEmptyDay ? (
            <Badge variant="secondary">Tidak ada pengeluaran</Badge>
          ) : (
            <p className="text-sm text-muted-foreground">
              {expenses.length} item · total {rupiah(total)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/entri/${prevDate}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            ← {formatDate(prevDate)}
          </Link>
          {nextDate && (
            <Link href={`/admin/entri/${nextDate}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {formatDate(nextDate)} →
            </Link>
          )}
        </div>
      </div>

      {(!entry || entry.isEmptyDay) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {entry ? "Tanggal ini ditandai tanpa pengeluaran" : "Tanggal ini belum dicatat"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entry ? <ClearEmptyButton date={date} /> : <MarkEmptyButton date={date} />}
            <p className="mt-2 text-xs text-muted-foreground">
              Menambah pengeluaran di bawah otomatis mencabut tanda kosong.
            </p>
          </CardContent>
        </Card>
      )}

      {expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pengeluaran</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.item}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block size-3 rounded-full"
                          style={{ backgroundColor: e.categoryColor ?? "#9ca3af" }}
                        />
                        {e.categoryName}
                        {e.source === "MANUAL" && <Badge variant="outline">Manual</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{rupiah(e.amount)}</TableCell>
                    <TableCell>
                      <ExpenseActions
                        expense={e}
                        categories={categories}
                        isLastItem={expenses.length === 1}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tambah pengeluaran</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Biarkan kategori &quot;Otomatis&quot; untuk memakai aturan. Baris dengan item dan
            nominal kosong diabaikan.
          </p>
          <AddExpensesForm date={date} categories={categories} rules={rules} />
        </CardContent>
      </Card>
    </div>
  );
}
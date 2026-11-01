import { MonthlyChart } from "@/components/charts/monthly-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOverview } from "@/lib/data/admin";
import { formatDate, formatMonth, percent, rupiah } from "@/lib/format";
export const instant = false;

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const Row = ({ left, right }: { left: string; right: string }) => (
  <li className="flex justify-between gap-3">
    <span className="truncate">{left}</span>
    <span className="shrink-0 text-muted-foreground">{right}</span>
  </li>
);

export default async function AdminHome() {
  const data = await getAdminOverview();
  if (!data) {
    return <p>Dataset &quot;Data Asli&quot; belum ada. Jalankan import dulu.</p>;
  }
  const { summary: s, months, categories, weekdayWeekend: w, topDays, topItems, quality: q } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total" value={rupiah(s.total)} hint={`${s.expenseCount} item`} />
        <Stat
          label="Hari tercatat"
          value={String(s.recordedDays)}
          hint={`${s.emptyDays} hari tanpa pengeluaran`}
        />
        <Stat
          label="Rata-rata harian"
          value={rupiah(s.avgPerRecordedDay)}
          hint="per hari tercatat, hari kosong dihitung 0"
        />
        <Stat
          label="Uncategorized"
          value={percent(q.uncategorized.itemShare, 2)}
          hint={`per item · ${percent(q.uncategorized.amountShare, 2)} per nominal · ${q.gapCount} celah tanggal`}
        />
      </div>

      <Section title="Total per bulan">
        <MonthlyChart
          data={months.map((m) => ({ month: formatMonth(m.month), total: m.total }))}
        />
      </Section>

      <Section title="Komposisi kategori">
        <div className="space-y-3">
          {categories.map((c) => (
            <div key={c.name} className="space-y-1">
              <div className="flex justify-between gap-3 text-sm">
                <span>{c.name}</span>
                <span className="text-muted-foreground">
                  {rupiah(c.total)} · {percent(c.amountShare)} nominal · {percent(c.itemShare)} item
                </span>
              </div>
              <div className="h-2 rounded bg-muted">
                <div
                  className="h-2 rounded"
                  style={{
                    width: `${c.amountShare * 100}%`,
                    backgroundColor: c.color ?? "#9ca3af",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Hari kerja vs akhir pekan">
          <ul className="space-y-2 text-sm">
            <Row left={`Hari kerja (${w.weekday.days} hari)`} right={`${rupiah(w.weekday.avgPerDay)} / hari`} />
            <Row left={`Akhir pekan (${w.weekend.days} hari)`} right={`${rupiah(w.weekend.avgPerDay)} / hari`} />
          </ul>
        </Section>

        <Section title="Hari termahal">
          <ul className="space-y-2 text-sm">
            {topDays.map((d) => (
              <Row key={d.date} left={`${d.weekday}, ${formatDate(d.date)}`} right={rupiah(d.total)} />
            ))}
          </ul>
        </Section>

        <Section title="Item tersering">
          <ul className="space-y-2 text-sm">
            {topItems.byCount.map((i) => (
              <Row key={i.item} left={i.item} right={`${i.count}x`} />
            ))}
          </ul>
        </Section>

        <Section title="Item terbesar (total nominal)">
          <ul className="space-y-2 text-sm">
            {topItems.byTotal.map((i) => (
              <Row key={i.item} left={i.item} right={rupiah(i.total)} />
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
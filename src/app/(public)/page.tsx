import { MonthlyTrend } from "@/components/public/monthly-trend";
import {
  AboutSection,
  CategoryBars,
  EmptyState,
  Section,
  StatCard,
  SyntheticBanner,
  TopDays,
  WeekdayWeekend,
} from "@/components/public/sections";
import { getPublicOverview } from "@/lib/data/public";
import { formatDate, formatMonth, rupiah } from "@/lib/format";

// Halaman statis: dirender saat build, disegarkan paling lama tiap 1 jam,
// dan langsung saat dataset diterbitkan atau ditarik (revalidatePath di action admin).
export const revalidate = 3600;

export default async function PublicHome() {
  const data = await getPublicOverview();

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">FinanceSight</h1>
        <p className="text-muted-foreground">
          Dashboard pengeluaran pribadi: tren bulanan, komposisi kategori, dan pola harian.
        </p>
      </header>

      {!data ? (
        <EmptyState />
      ) : (
        <>
          <SyntheticBanner generatedAt={data.generatedAt} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total pengeluaran"
              value={rupiah(data.summary.total)}
              hint={`${data.summary.expenseCount} item`}
            />
            <StatCard
              label="Rata-rata harian"
              value={rupiah(data.summary.avgPerRecordedDay)}
              hint="per hari tercatat, hari kosong dihitung 0"
            />
            <StatCard
              label="Hari tercatat"
              value={String(data.summary.recordedDays)}
              hint={`${data.summary.emptyDays} hari tanpa pengeluaran`}
            />
            <StatCard
              label="Hari kerja vs akhir pekan"
              value={rupiah(data.weekdayWeekend.weekday.avgPerDay)}
              hint={`hari kerja · akhir pekan ${rupiah(data.weekdayWeekend.weekend.avgPerDay)}`}
            />
          </div>

          {data.summary.firstDate && data.summary.lastDate && (
            <p className="text-sm text-muted-foreground">
              Periode data: {formatDate(data.summary.firstDate)} sampai{" "}
              {formatDate(data.summary.lastDate)}.
            </p>
          )}

          <Section title="Tren bulanan">
            <MonthlyTrend
              months={data.months.map((m) => ({
                label: formatMonth(m.month),
                total: m.total,
                avg: m.avgPerRecordedDay,
                days: m.recordedDays,
              }))}
            />
          </Section>

          <Section title="Komposisi kategori">
            <CategoryBars categories={data.categories} />
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Hari kerja vs akhir pekan">
              <WeekdayWeekend
                weekday={data.weekdayWeekend.weekday}
                weekend={data.weekdayWeekend.weekend}
              />
            </Section>
            <Section title="Hari termahal">
              <TopDays days={data.topDays} />
            </Section>
          </div>
        </>
      )}

      <AboutSection />
    </main>
  );
}
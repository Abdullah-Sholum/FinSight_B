import Link from "next/link";
import { notFound } from "next/navigation";
import { MonthlyChart } from "@/components/charts/monthly-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSyntheticDetail } from "@/lib/data/admin";
import { formatDate, formatDateTime, formatMonth, formatWeekday, percent, rupiah } from "@/lib/format";
import { DatasetActions } from "./dataset-actions";

type CheckItem = { name: string; ok: boolean; detail: string };

function Checks({ title, checks }: { title: string; checks: CheckItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {checks.map((c) => (
            <li key={c.name} className="flex gap-2">
              <Badge variant={c.ok ? "secondary" : "destructive"} className="shrink-0">
                {c.ok ? "LULUS" : "GAGAL"}
              </Badge>
              <span>
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">: {c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
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
    <span>{left}</span>
    <span className="text-muted-foreground">{right}</span>
  </li>
);

export default async function SyntheticDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) notFound();

  const data = await getSyntheticDetail(id);
  if (!data) notFound();
  const { dataset, config, preview } = data;
  const p = preview;

  const canPublish =
    !!config && config.integrity.ok && config.plausibility.passed && config.leak.passed;

  return (
    <div className="space-y-6">
      <Link href="/admin/sintesis" className="text-sm text-muted-foreground hover:underline">
        ← Data sintesis
      </Link>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{dataset.name}</h1>
          {dataset.isPublished ? <Badge>Terbit</Badge> : <Badge variant="outline">Draf</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          Seed {dataset.seed} · dibuat {formatDateTime(dataset.createdAt)}
          {dataset.publishedAt ? ` · terbit ${formatDateTime(dataset.publishedAt)}` : ""}
          {config
            ? ` · privasi ${config.privacy} · berakhir ${formatDate(config.endDate)} · generator v${config.generatorVersion}`
            : ""}
        </p>
        {config && (
          <p className="text-xs text-muted-foreground">
            Sidik jari isi: {config.fingerprint.slice(0, 16)} · dikecualikan:{" "}
            {config.review.excluded.join(", ")}
            {config.review.droppedCategories.length > 0
              ? ` · dibuang: ${config.review.droppedCategories.join(", ")}`
              : ""}
          </p>
        )}
      </div>

      <DatasetActions
        id={dataset.id}
        name={dataset.name}
        isPublished={dataset.isPublished}
        canPublish={canPublish}
      />

      {!config ? (
        <p className="text-sm text-destructive">
          Konfigurasi dataset tidak terbaca, jadi tidak bisa diperiksa atau diterbitkan. Hapus dan
          buat ulang.
        </p>
      ) : (
        <>
          <Checks
            title={`Integritas (diperiksa ${formatDateTime(config.integrity.at)})`}
            checks={[
              {
                name: "Isi database sama dengan yang digenerate",
                ok: config.integrity.ok,
                detail: config.integrity.ok
                  ? "sidik jari cocok"
                  : "isi berubah sejak dibuat, atau ada item tanpa catatan hari",
              },
            ]}
          />
          <Checks
            title={`Kewajaran (diperiksa ${formatDateTime(config.plausibility.at)})`}
            checks={config.plausibility.checks}
          />
          <Checks
            title={`Kebocoran (diperiksa ${formatDateTime(config.leak.at)})`}
            checks={[...config.leak.checks, ...config.leak.selfTest]}
          />
          <p className="text-xs text-muted-foreground">
            Pemeriksaan ini menangkap kebocoran literal dan struktural. Ia bukan bukti privasi
            formal: data tentang satu orang selalu punya ciri agregat yang menggambarkannya. Daftar
            larang {config.leak.forbiddenListUsed ? "dipakai" : "tidak dipakai"} pada pemeriksaan
            terakhir.
          </p>
        </>
      )}

      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        Pratinjau berikut hanya terlihat admin. Publik baru melihatnya setelah dataset terbit.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Section title="Total">
          <div className="text-2xl font-semibold">{rupiah(p.summary.total)}</div>
          <p className="text-xs text-muted-foreground">{p.summary.expenseCount} item</p>
        </Section>
        <Section title="Hari tercatat">
          <div className="text-2xl font-semibold">{p.summary.recordedDays}</div>
          <p className="text-xs text-muted-foreground">{p.summary.emptyDays} hari kosong</p>
        </Section>
        <Section title="Rata-rata harian">
          <div className="text-2xl font-semibold">{rupiah(p.summary.avgPerRecordedDay)}</div>
        </Section>
        <Section title="Hari kerja vs akhir pekan">
          <ul className="space-y-1 text-sm">
            <Row left="Hari kerja" right={rupiah(p.weekdayWeekend.weekday.avgPerDay)} />
            <Row left="Akhir pekan" right={rupiah(p.weekdayWeekend.weekend.avgPerDay)} />
          </ul>
        </Section>
      </div>

      <Section title="Total per bulan">
        <MonthlyChart data={p.months.map((m) => ({ month: formatMonth(m.month), total: m.total }))} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Komposisi kategori">
          <div className="space-y-3">
            {p.categories.map((c) => (
              <div key={c.name} className="space-y-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">
                    {rupiah(c.total)} · {percent(c.amountShare)}
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
        <Section title="Hari termahal">
          <ul className="space-y-2 text-sm">
            {p.topDays.map((d) => (
              <Row
                key={d.date}
                left={`${formatWeekday(d.date)}, ${formatDate(d.date)}`}
                right={rupiah(d.total)}
              />
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDate, formatDateTime, percent, rupiah } from "@/lib/format";
import { SITE } from "@/lib/site";

const TECH = [
  "Next.js",
  "TypeScript",
  "PostgreSQL",
  "Prisma",
  "Auth.js",
  "Tailwind CSS",
  "shadcn/ui",
  "Recharts",
  "Zod",
];

export function SyntheticBanner({ generatedAt }: { generatedAt: string }) {
  return (
    <div
      role="note"
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <strong>Ini data sintesis.</strong> Angka di halaman ini dibuat oleh program dari profil
      statistik yang sudah dikaburkan, bukan pengeluaran nyata seseorang. Dibuat pada{" "}
      {formatDateTime(generatedAt)} WIB.
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold leading-none">{title}</h2>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function CategoryBars({
  categories,
}: {
  categories: {
    name: string;
    color: string | null;
    total: number;
    amountShare: number;
    itemShare: number;
  }[];
}) {
  return (
    <ul className="space-y-3">
      {categories.map((c) => (
        <li key={c.name} className="space-y-1">
          <div className="flex flex-wrap justify-between gap-x-3 text-sm">
            <span className="font-medium">{c.name}</span>
            <span className="text-muted-foreground">
              {rupiah(c.total)} · {percent(c.amountShare)} nominal · {percent(c.itemShare)} item
            </span>
          </div>
          <div className="h-2 rounded bg-muted" role="presentation">
            <div
              className="h-2 rounded"
              style={{
                width: `${(c.amountShare * 100).toFixed(2)}%`,
                backgroundColor: c.color ?? "#9ca3af",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function WeekdayWeekend({
  weekday,
  weekend,
}: {
  weekday: { days: number; avgPerDay: number };
  weekend: { days: number; avgPerDay: number };
}) {
  const diff = weekday.avgPerDay > 0 ? weekend.avgPerDay / weekday.avgPerDay - 1 : null;
  return (
    <div className="space-y-3 text-sm">
      <ul className="space-y-2">
        <li className="flex justify-between gap-3">
          <span>Hari kerja ({weekday.days} hari)</span>
          <span className="font-medium">{rupiah(weekday.avgPerDay)} / hari</span>
        </li>
        <li className="flex justify-between gap-3">
          <span>Akhir pekan ({weekend.days} hari)</span>
          <span className="font-medium">{rupiah(weekend.avgPerDay)} / hari</span>
        </li>
      </ul>
      {diff !== null && (
        <p className="text-xs text-muted-foreground">
          Rata-rata akhir pekan {Math.abs(diff * 100).toFixed(0)}%{" "}
          {diff >= 0 ? "lebih tinggi" : "lebih rendah"} daripada hari kerja.
        </p>
      )}
    </div>
  );
}

export function TopDays({
  days,
}: {
  days: { date: string; weekday: string; total: number; items: number }[];
}) {
  return (
    <ol className="space-y-2 text-sm">
      {days.map((d) => (
        <li key={d.date} className="flex justify-between gap-3">
          <span>
            {d.weekday}, {formatDate(d.date)}
            <span className="text-muted-foreground"> · {d.items} item</span>
          </span>
          <span className="font-medium">{rupiah(d.total)}</span>
        </li>
      ))}
    </ol>
  );
}

export function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <h2 className="text-lg font-semibold">Belum ada data sintesis yang diterbitkan</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Dashboard akan tampil di sini setelah dataset sintesis diterbitkan.
      </p>
    </div>
  );
}

export function AboutSection() {
  return (
    <section aria-labelledby="tentang" className="space-y-3 rounded-lg border p-5">
      <h2 id="tentang" className="text-lg font-semibold">
        Tentang proyek ini
      </h2>
      <p className="text-sm text-muted-foreground">
        FinanceSight adalah proyek belajar untuk mencatat dan menganalisis pengeluaran pribadi.
        Aplikasi lengkapnya punya panel admin (catatan harian, aturan kategori, import CSV) yang
        tidak dibuka untuk umum.
      </p>
      <p className="text-sm text-muted-foreground">
        Data di halaman ini sintetis: dibuat dari profil statistik (proporsi kategori, sebaran
        nominal, pola hari) yang dikaburkan, bukan salinan data pribadi. Tidak ada baris, nama
        item, atau pola harian asli yang disalin, dan setiap dataset diperiksa otomatis terhadap
        kebocoran sebelum diterbitkan.
      </p>
      <p className="text-sm text-muted-foreground">
        Halaman ini dirender statis dan disegarkan berkala, jadi kunjungan tidak membebani
        database.
      </p>
      <div className="flex flex-wrap gap-2">
        {TECH.map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))}
      </div>
      <a
        href={SITE.repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm font-medium underline underline-offset-4"
      >
        Lihat kode sumber di GitHub
      </a>
    </section>
  );
}
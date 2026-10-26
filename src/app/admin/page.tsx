import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOverview } from "@/lib/data/admin";

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

export default async function AdminHome() {
  const data = await getAdminOverview();
  if (!data) {
    return <p>Dataset &quot;Data Asli&quot; belum ada. Jalankan import dulu.</p>;
  }
  const s = data.summary;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ["Total", rupiah(s.total)],
        ["Item", String(s.expenseCount)],
        ["Hari tercatat", String(s.recordedDays)],
        ["Rata-rata harian", rupiah(s.avgPerRecordedDay)],
      ].map(([label, value]) => (
        <Card key={label}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {label}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{value}</CardContent>
        </Card>
      ))}
    </div>
  );
}
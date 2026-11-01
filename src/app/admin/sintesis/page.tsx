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
import { getSyntheticList } from "@/lib/data/admin";
import { todayInJakarta } from "@/lib/dates";
import { formatDateTime, rupiah } from "@/lib/format";
import { CreateDraftForm } from "./create-draft-form";

function Flag({ ok }: { ok: boolean | null }) {
  if (ok === null) return <Badge variant="outline">?</Badge>;
  return ok ? <Badge variant="secondary">Lulus</Badge> : <Badge variant="destructive">Gagal</Badge>;
}

export default async function SyntheticPage() {
  const datasets = await getSyntheticList();
  const published = datasets.find((d) => d.isPublished);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Data sintesis</h1>
        <p className="text-sm text-muted-foreground">
          Dashboard publik hanya membaca dataset sintesis yang berstatus terbit.{" "}
          {published
            ? `Sekarang terbit: ${published.name}.`
            : "Saat ini tidak ada yang terbit, jadi publik belum melihat data apa pun."}
        </p>
      </div>

      <CreateDraftForm today={todayInJakarta()} />

      <Card>
        <CardHeader>
          <CardTitle>Dataset sintesis ({datasets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {datasets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada dataset sintesis.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Isi</TableHead>
                  <TableHead>Integritas</TableHead>
                  <TableHead>Kewajaran</TableHead>
                  <TableHead>Kebocoran</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        seed {d.seed} · {formatDateTime(d.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {d.isPublished ? (
                        <Badge>Terbit</Badge>
                      ) : (
                        <Badge variant="outline">Draf</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {d.stats
                        ? `${d.stats.days} hari · ${d.stats.items} item · ${rupiah(d.stats.total)}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Flag ok={d.integrityOk} />
                    </TableCell>
                    <TableCell>
                      <Flag ok={d.plausibilityPassed} />
                    </TableCell>
                    <TableCell>
                      <Flag ok={d.leakPassed} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/sintesis/${d.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Buka
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
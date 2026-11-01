import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCategoryOptions, getRulesPage, getRuleInputs } from "@/lib/data/admin";
import { RuleDataProvider, RuleDialog, RuleRowActions } from "./rule-dialogs";

const PAGE = "/admin/aturan";
const selectClass = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

function href(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${PAGE}?${s}` : PAGE;
}

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kategori?: string; status?: string; halaman?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const categoryId = Number(sp.kategori) > 0 ? Number(sp.kategori) : undefined;
  const status = sp.status === "aktif" || sp.status === "nonaktif" ? sp.status : undefined;
  const pageNum = Math.max(1, Number(sp.halaman) || 1);

  const [data, categories, hints] = await Promise.all([
    getRulesPage({ q, categoryId, status, page: pageNum }),
    getCategoryOptions(),
    getRuleInputs(),
  ]);
  const usable = categories.filter((c) => !c.isSystem).map((c) => ({ id: c.id, name: c.name }));
  const filters = { q, kategori: categoryId, status };

  return (
    <RuleDataProvider categories={usable} rules={hints}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Aturan kategori</h1>
            <p className="text-sm text-muted-foreground">
              {data.total} aturan. Perubahan aturan tidak mengubah data lama sampai kamu
              menerapkan ulang.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/aturan/terapkan" className={buttonVariants({ variant: "outline" })}>
              Terapkan ulang aturan
            </Link>
            <RuleDialog label="Tambah aturan" />
          </div>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="q">Cari kata kunci</Label>
            <Input id="q" name="q" defaultValue={q ?? ""} className="w-56" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kategori">Kategori</Label>
            <select
              id="kategori"
              name="kategori"
              defaultValue={categoryId ? String(categoryId) : ""}
              className={selectClass}
            >
              <option value="">Semua</option>
              {usable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="status">Status</Label>
            <select id="status" name="status" defaultValue={status ?? ""} className={selectClass}>
              <option value="">Semua</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>
          <Button type="submit" variant="outline">
            Terapkan filter
          </Button>
          <Link href={PAGE} className={buttonVariants({ variant: "ghost" })}>
            Reset
          </Link>
        </form>

        {data.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada aturan yang cocok dengan filter.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kata kunci</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Prioritas</TableHead>
                <TableHead className="text-right">Cocok</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <span className="font-medium">{r.keyword}</span>
                    {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block size-3 rounded-full"
                        style={{ backgroundColor: r.categoryColor ?? "#9ca3af" }}
                      />
                      {r.categoryName}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{r.priority}</TableCell>
                  <TableCell className="text-right">
                    {r.hits === null ? (
                      "-"
                    ) : r.hits === 0 ? (
                      <Badge variant="outline">0</Badge>
                    ) : (
                      r.hits
                    )}
                  </TableCell>
                  <TableCell>
                    {r.isActive ? (
                      <Badge variant="secondary">Aktif</Badge>
                    ) : (
                      <Badge variant="outline">Nonaktif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <RuleRowActions rule={r} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {data.pages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Halaman {data.page} dari {data.pages}
            </span>
            <div className="flex gap-2">
              {data.page > 1 && (
                <Link
                  href={href({ ...filters, halaman: data.page - 1 })}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  ← Sebelumnya
                </Link>
              )}
              {data.page < data.pages && (
                <Link
                  href={href({ ...filters, halaman: data.page + 1 })}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Berikutnya →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </RuleDataProvider>
  );
}
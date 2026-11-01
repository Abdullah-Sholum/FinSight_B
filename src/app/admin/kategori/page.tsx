import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCategoriesWithStats } from "@/lib/data/admin";
import { rupiah } from "@/lib/format";
import { CategoryRowActions, CreateCategoryButton } from "./category-dialogs";
export const instant = false;


export default async function CategoriesPage() {
  const categories = await getCategoriesWithStats();
  const targets = categories
    .filter((c) => !c.isSystem)
    .map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Kategori</h1>
          <p className="text-sm text-muted-foreground">
            Nama dan warna kategori juga tampil di dashboard publik, jadi hindari nama yang
            terlalu pribadi.
          </p>
        </div>
        <CreateCategoryButton />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kategori</TableHead>
            <TableHead className="text-right">Item</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Aturan</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-full"
                    style={{ backgroundColor: c.color ?? "#9ca3af" }}
                  />
                  <span className="font-medium">{c.name}</span>
                  {c.isSystem && <Badge variant="secondary">Sistem</Badge>}
                </div>
              </TableCell>
              <TableCell className="text-right">{c.realItems}</TableCell>
              <TableCell className="text-right">{rupiah(c.realTotal)}</TableCell>
              <TableCell className="text-right">{c.ruleCount}</TableCell>
              <TableCell>
                <CategoryRowActions category={c} targets={targets} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
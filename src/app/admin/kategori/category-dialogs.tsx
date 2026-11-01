"use client";
import { FieldError, FormMessage, SubmitButton, useActionDialog } from "../_components/action-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCategoryAction,
  deleteCategoryAction,
  mergeCategoryAction,
  updateCategoryAction,
} from "@/lib/actions/categories";
import type { ActionResult } from "@/lib/actions/result";

export type CategoryRow = {
  id: number;
  name: string;
  color: string | null;
  isSystem: boolean;
  ruleCount: number;
  totalExpenseCount: number;
  realItems: number;
  realTotal: number;
};

function CategoryFields({
  result,
  name = "",
  color = "#64748b",
}: {
  result: ActionResult | null;
  name?: string;
  color?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nama</Label>
        <Input id="name" name="name" defaultValue={name} maxLength={40} required />
        <FieldError result={result} name="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="color">Warna</Label>
        <Input id="color" name="color" type="color" defaultValue={color} className="h-9 w-20 p-1" />
        <FieldError result={result} name="color" />
      </div>
    </div>
  );
}

export function CreateCategoryButton() {
  const d = useActionDialog(createCategoryAction);
  return (
    <>
      <Button onClick={() => d.setOpen(true)}>Tambah kategori</Button>
      <Dialog open={d.open} onOpenChange={d.onOpenChange}>
        <DialogContent>
          <form action={d.submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Tambah kategori</DialogTitle>
              <DialogDescription>
                Nama harus unik, tanpa membedakan huruf besar-kecil.
              </DialogDescription>
            </DialogHeader>
            <CategoryFields result={d.result} />
            <FormMessage result={d.result} />
            <DialogFooter>
              <SubmitButton>Simpan</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditDialog({ category }: { category: CategoryRow }) {
  const d = useActionDialog(updateCategoryAction);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => d.setOpen(true)}>
        Ubah
      </Button>
      <Dialog open={d.open} onOpenChange={d.onOpenChange}>
        <DialogContent>
          <form action={d.submit} className="space-y-4">
            <input type="hidden" name="id" value={category.id} />
            <DialogHeader>
              <DialogTitle>Ubah kategori</DialogTitle>
              <DialogDescription>
                Perubahan nama dan warna juga tampil di dashboard publik.
              </DialogDescription>
            </DialogHeader>
            <CategoryFields
              result={d.result}
              name={category.name}
              color={category.color ?? "#64748b"}
            />
            <FormMessage result={d.result} />
            <DialogFooter>
              <SubmitButton>Simpan</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MergeDialog({
  category,
  targets,
}: {
  category: CategoryRow;
  targets: { id: number; name: string }[];
}) {
  const d = useActionDialog(mergeCategoryAction);
  const options = targets.filter((t) => t.id !== category.id);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => d.setOpen(true)}>
        Gabungkan
      </Button>
      <Dialog open={d.open} onOpenChange={d.onOpenChange}>
        <DialogContent>
          <form action={d.submit} className="space-y-4">
            <input type="hidden" name="fromId" value={category.id} />
            <DialogHeader>
              <DialogTitle>Gabungkan &quot;{category.name}&quot;</DialogTitle>
              <DialogDescription>
                Memindahkan {category.totalExpenseCount} item dan {category.ruleCount} aturan ke
                kategori tujuan, lalu menghapus &quot;{category.name}&quot;. Tindakan ini tidak
                bisa dibatalkan.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="toId">Kategori tujuan</Label>
              <select
                id="toId"
                name="toId"
                required
                defaultValue=""
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="" disabled>
                  Pilih kategori...
                </option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <FieldError result={d.result} name="toId" />
            </div>
            <FormMessage result={d.result} />
            <DialogFooter>
              <SubmitButton variant="destructive">Gabungkan</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteDialog({ category }: { category: CategoryRow }) {
  const d = useActionDialog(deleteCategoryAction);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => d.setOpen(true)}>
        Hapus
      </Button>
      <Dialog open={d.open} onOpenChange={d.onOpenChange}>
        <DialogContent>
          <form action={d.submit} className="space-y-4">
            <input type="hidden" name="id" value={category.id} />
            <DialogHeader>
              <DialogTitle>Hapus &quot;{category.name}&quot;?</DialogTitle>
              <DialogDescription>
                Kategori ini dipakai {category.totalExpenseCount} item dan {category.ruleCount}{" "}
                aturan. Kategori yang masih dipakai tidak bisa dihapus, gunakan Gabungkan dulu.
              </DialogDescription>
            </DialogHeader>
            <FormMessage result={d.result} />
            <DialogFooter>
              <SubmitButton variant="destructive">Hapus</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CategoryRowActions({
  category,
  targets,
}: {
  category: CategoryRow;
  targets: { id: number; name: string }[];
}) {
  if (category.isSystem) {
    return <span className="text-xs text-muted-foreground">Dikunci</span>;
  }
  return (
    <div className="flex justify-end gap-1">
      <EditDialog category={category} />
      <MergeDialog category={category} targets={targets} />
      <DeleteDialog category={category} />
    </div>
  );
}
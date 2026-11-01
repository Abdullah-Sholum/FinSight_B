"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
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
  addExpensesAction,
  clearEmptyDayAction,
  deleteExpenseAction,
  markEmptyDayAction,
  updateExpenseAction,
} from "@/lib/actions/entries";
import { buildMatcher, type RuleInput } from "@/lib/categorize";
import { rupiah } from "@/lib/format";
import {
  FieldError,
  FormMessage,
  SubmitButton,
  useActionDialog,
  useActionForm,
} from "../_components/action-ui";

export type CategoryOption = {
  id: number;
  name: string;
  color: string | null;
  isSystem: boolean;
};

export type ExpenseItem = {
  id: number;
  item: string;
  amount: number;
  categoryId: number;
  categoryName: string;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

/* ---------- loncat ke tanggal ---------- */

export function DateJump({ max, initial }: { max: string; initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) router.push(`/admin/entri/${value}`);
      }}
    >
      <Input
        type="date"
        value={value}
        max={max}
        onChange={(e) => setValue(e.target.value)}
        className="w-44"
        aria-label="Pilih tanggal"
      />
      <Button type="submit" variant="outline">
        Buka tanggal
      </Button>
    </form>
  );
}

/* ---------- tanda hari kosong ---------- */

export function MarkEmptyButton({
  date,
  size,
  variant = "outline",
}: {
  date: string;
  size?: "default" | "sm";
  variant?: "default" | "outline";
}) {
  const { result, submit } = useActionForm(markEmptyDayAction);
  return (
    <form action={submit} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="date" value={date} />
      <SubmitButton variant={variant} size={size}>
        Tidak ada pengeluaran
      </SubmitButton>
      <FormMessage result={result} />
    </form>
  );
}

export function ClearEmptyButton({ date }: { date: string }) {
  const { result, submit } = useActionForm(clearEmptyDayAction);
  return (
    <form action={submit} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="date" value={date} />
      <SubmitButton variant="outline">Batalkan tanda kosong</SubmitButton>
      <FormMessage result={result} />
    </form>
  );
}

/* ---------- tambah banyak item ---------- */

type Row = { key: number; item: string; amount: string; categoryId: string };

export function AddExpensesForm({
  date,
  categories,
  rules,
}: {
  date: string;
  categories: CategoryOption[];
  rules: RuleInput[];
}) {
  const nextKey = useRef(1);
  const makeRow = (): Row => ({
    key: nextKey.current++,
    item: "",
    amount: "",
    categoryId: "",
  });

  const [rows, setRows] = useState<Row[]>([
    { key: 0, item: "", amount: "", categoryId: "" },
  ]);
  const match = useMemo(() => buildMatcher(rules), [rules]);
  const { result, submit } = useActionForm(addExpensesAction, () =>
    setRows([makeRow()]),
  );

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const choices = categories.filter((c) => !c.isSystem);

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="date" value={date} />

      {rows.map((row, i) => {
        const suggestion =
          row.item.trim() && !row.categoryId ? match(row.item) : null;
        return (
          <div
            key={row.key}
            className="grid items-start gap-2 sm:grid-cols-[1fr_9rem_13rem_auto]"
          >
            <div className="space-y-1">
              <Input
                name="item"
                value={row.item}
                onChange={(e) => update(row.key, { item: e.target.value })}
                placeholder="Item, mis. bensin"
                maxLength={100}
                autoComplete="off"
                aria-label={`Item ${i + 1}`}
              />
              <FieldError result={result} name={`item.${i}`} />
              {row.item.trim() && !row.categoryId && (
                <p className="text-xs text-muted-foreground">
                  {suggestion
                    ? `Saran: ${suggestion.categoryName}`
                    : "Tidak ada aturan cocok: masuk Uncategorized"}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Input
                name="amount"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={row.amount}
                onChange={(e) => update(row.key, { amount: e.target.value })}
                placeholder="Nominal"
                aria-label={`Nominal ${i + 1}`}
              />
              <FieldError result={result} name={`amount.${i}`} />
            </div>

            <div className="space-y-1">
              <select
                name="categoryId"
                value={row.categoryId}
                onChange={(e) => update(row.key, { categoryId: e.target.value })}
                className={selectClass}
                aria-label={`Kategori ${i + 1}`}
              >
                <option value="">Otomatis dari aturan</option>
                {choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError result={result} name={`categoryId.${i}`} />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={rows.length === 1}
              onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
            >
              Hapus
            </Button>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((rs) => [...rs, makeRow()])}
        >
          Tambah baris
        </Button>
        <SubmitButton>Simpan</SubmitButton>
      </div>
      <FormMessage result={result} />
    </form>
  );
}

/* ---------- ubah dan hapus satu item ---------- */

function EditExpenseDialog({
  expense,
  categories,
}: {
  expense: ExpenseItem;
  categories: CategoryOption[];
}) {
  const d = useActionDialog(updateExpenseAction);
  const options = categories.filter((c) => !c.isSystem || c.id === expense.categoryId);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => d.setOpen(true)}>
        Ubah
      </Button>
      <Dialog open={d.open} onOpenChange={d.onOpenChange}>
        <DialogContent>
          <form action={d.submit} className="space-y-4">
            <input type="hidden" name="id" value={expense.id} />
            <DialogHeader>
              <DialogTitle>Ubah item</DialogTitle>
              <DialogDescription>
                Kategori hanya berubah kalau kamu mengubahnya. Pilih &quot;Otomatis&quot; untuk
                menyerahkannya ke aturan lagi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="edit-item">Item</Label>
              <Input id="edit-item" name="item" defaultValue={expense.item} maxLength={100} required />
              <FieldError result={d.result} name="item" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Nominal</Label>
              <Input
                id="edit-amount"
                name="amount"
                type="number"
                min={1}
                step={1}
                defaultValue={expense.amount}
                required
              />
              <FieldError result={d.result} name="amount" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Kategori</Label>
              <select
                id="edit-category"
                name="categoryId"
                defaultValue={String(expense.categoryId)}
                className={selectClass}
              >
                <option value="">Otomatis dari aturan</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError result={d.result} name="categoryId" />
            </div>

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

function DeleteExpenseDialog({
  expense,
  isLastItem,
}: {
  expense: ExpenseItem;
  isLastItem: boolean;
}) {
  const d = useActionDialog(deleteExpenseAction);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => d.setOpen(true)}>
        Hapus
      </Button>
      <Dialog open={d.open} onOpenChange={d.onOpenChange}>
        <DialogContent>
          <form action={d.submit} className="space-y-4">
            <input type="hidden" name="id" value={expense.id} />
            <DialogHeader>
              <DialogTitle>Hapus item?</DialogTitle>
              <DialogDescription>
                &quot;{expense.item}&quot; ({rupiah(expense.amount)}) akan dihapus. Tindakan ini
                tidak bisa dibatalkan.
              </DialogDescription>
            </DialogHeader>

            {isLastItem && (
              <fieldset className="space-y-2 rounded-md border p-3 text-sm">
                <legend className="px-1 text-muted-foreground">
                  Ini item terakhir hari ini. Setelah dihapus:
                </legend>
                <label className="flex items-start gap-2">
                  <input type="radio" name="whenLast" value="empty" defaultChecked className="mt-1" />
                  <span>Tandai hari ini tanpa pengeluaran</span>
                </label>
                <label className="flex items-start gap-2">
                  <input type="radio" name="whenLast" value="remove" className="mt-1" />
                  <span>Hapus catatan hari ini (jadi belum dicatat)</span>
                </label>
              </fieldset>
            )}

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

export function ExpenseActions({
  expense,
  categories,
  isLastItem,
}: {
  expense: ExpenseItem;
  categories: CategoryOption[];
  isLastItem: boolean;
}) {
  return (
    <div className="flex justify-end gap-1">
      <EditExpenseDialog expense={expense} categories={categories} />
      <DeleteExpenseDialog expense={expense} isLastItem={isLastItem} />
    </div>
  );
}
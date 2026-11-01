"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
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
  createRuleAction,
  deleteRuleAction,
  previewRuleAction,
  setRuleActiveAction,
  updateRuleAction,
} from "@/lib/actions/rules";
import type { ActionResult } from "@/lib/actions/result";
import { rupiah } from "@/lib/format";
import { relatedRules } from "@/lib/rule-analysis";
import type { EffectSummary } from "@/lib/rule-types";
import {
  FieldError,
  FormMessage,
  SubmitButton,
  useActionDialog,
  useActionForm,
} from "../_components/action-ui";

export type RuleRow = {
  id: number;
  keyword: string;
  categoryId: number;
  priority: number;
  isActive: boolean;
  note: string | null;
  hits: number | null;
};
export type RuleCategory = { id: number; name: string };
export type RuleHint = { keyword: string; priority: number; categoryName: string };

const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";

/* ---------- data bersama (dikirim sekali) ---------- */

const RuleDataContext = createContext<{
  categories: RuleCategory[];
  rules: RuleHint[];
} | null>(null);

export function RuleDataProvider({
  categories,
  rules,
  children,
}: {
  categories: RuleCategory[];
  rules: RuleHint[];
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ categories, rules }), [categories, rules]);
  return <RuleDataContext.Provider value={value}>{children}</RuleDataContext.Provider>;
}

function useRuleData() {
  const v = useContext(RuleDataContext);
  if (!v) throw new Error("RuleDataProvider belum dipasang");
  return v;
}

/* ---------- tampilan dampak ---------- */

function EffectView({ data }: { data: EffectSummary }) {
  if (data.totalChanged === 0 && data.protectedMatches === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aturan ini tidak akan mengubah kategori item mana pun saat ini.
      </p>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      {data.totalChanged > 0 && (
        <>
          <p>
            {data.totalChanged} item ({rupiah(data.totalAmount)}) akan berpindah kategori saat
            aturan diterapkan ulang:
          </p>
          <ul className="space-y-1 text-muted-foreground">
            {data.groups.slice(0, 8).map((g) => (
              <li key={`${g.item}|${g.from}|${g.to}`}>
                {g.count}× &quot;{g.item}&quot;: {g.from} → {g.to}
              </li>
            ))}
          </ul>
          {(data.groups.length > 8 || data.hiddenGroups > 0) && (
            <p className="text-xs text-muted-foreground">dan kelompok lainnya.</p>
          )}
        </>
      )}
      {data.protectedMatches > 0 && (
        <p className="text-muted-foreground">
          {data.protectedMatches} item lain cocok tetapi tidak disentuh, karena dikoreksi manual
          atau berasal dari import dan sudah berkategori.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Menyimpan aturan tidak mengubah data. Perubahan baru terjadi saat kamu menerapkan ulang
        aturan.
      </p>
    </div>
  );
}

/* ---------- form tambah/ubah ---------- */

type PreviewState =
  | { ok: true; data: EffectSummary }
  | { ok: false; error: string }
  | null;

function RuleForm({
  title,
  rule,
  initialKeyword,
  result,
  submit,
}: {
  title: string;
  rule?: RuleRow;
  initialKeyword?: string;
  result: ActionResult | null;
  submit: (formData: FormData) => Promise<void>;
}) {
  const { categories, rules } = useRuleData();
  const formRef = useRef<HTMLFormElement>(null);
  const [keyword, setKeyword] = useState(rule?.keyword ?? initialKeyword ?? "");
  const [categoryId, setCategoryId] = useState(rule ? String(rule.categoryId) : "");
  const [preview, setPreview] = useState<PreviewState>(null);
  const [checking, setChecking] = useState(false);

  const categoryName = categories.find((c) => String(c.id) === categoryId)?.name;
  const related = useMemo(
    () => relatedRules(keyword, rules, categoryName, rule?.keyword),
    [keyword, rules, categoryName, rule?.keyword],
  );
  const list = (items: { keyword: string; categoryName: string }[]) =>
    items
      .slice(0, 5)
      .map((r) => `"${r.keyword}" (${r.categoryName})`)
      .join(", ");

  async function checkImpact() {
    if (!formRef.current) return;
    setChecking(true);
    try {
      const r = await previewRuleAction(new FormData(formRef.current));
      if (r.ok && r.data) setPreview({ ok: true, data: r.data });
      else setPreview({ ok: false, error: r.ok ? "Pratinjau kosong." : r.error });
    } catch {
      setPreview({ ok: false, error: "Permintaan gagal. Kemungkinan sesi sudah berakhir." });
    } finally {
      setChecking(false);
    }
  }

  return (
    <form ref={formRef} action={submit} className="space-y-4">
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Kata kunci dicocokkan sebagai kata utuh. Kalau beberapa cocok, yang terpanjang menang.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="rule-keyword">Kata kunci</Label>
        <Input
          id="rule-keyword"
          name="keyword"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPreview(null);
          }}
          maxLength={60}
          autoComplete="off"
          required
        />
        <FieldError result={result} name="keyword" />
        {related.exact.length > 0 && (
          <p className="text-sm text-destructive">
            Sudah ada aturan dengan kata kunci ini di kategori{" "}
            {related.exact.map((r) => r.categoryName).join(", ")}. Menyimpan akan ditolak.
          </p>
        )}
        {related.longer.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Frasa lebih panjang di kategori lain (menang atas kata kunci ini): {list(related.longer)}
          </p>
        )}
        {related.shorter.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Frasa lebih pendek di kategori lain (kalah dari kata kunci ini): {list(related.shorter)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="rule-category">Kategori</Label>
        <select
          id="rule-category"
          name="categoryId"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPreview(null);
          }}
          className={selectClass}
          required
        >
          <option value="" disabled>
            Pilih kategori...
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <FieldError result={result} name="categoryId" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="rule-priority">Prioritas</Label>
          <Input
            id="rule-priority"
            name="priority"
            type="number"
            min={-100}
            max={100}
            step={1}
            defaultValue={rule?.priority ?? 0}
            onChange={() => setPreview(null)}
          />
          <p className="text-xs text-muted-foreground">
            Hanya menentukan pemenang bila dua kata kunci sama panjang.
          </p>
          <FieldError result={result} name="priority" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rule-note">Catatan (opsional)</Label>
          <Input id="rule-note" name="note" defaultValue={rule?.note ?? ""} maxLength={200} />
          <FieldError result={result} name="note" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={rule?.isActive ?? true}
          onChange={() => setPreview(null)}
        />
        Aktif
      </label>

      {preview && (
        <div className="rounded-md border p-3">
          {preview.ok ? (
            <EffectView data={preview.data} />
          ) : (
            <p className="text-sm text-destructive">{preview.error}</p>
          )}
        </div>
      )}

      <FormMessage result={result} />
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={checkImpact} disabled={checking}>
          {checking ? "Memeriksa..." : "Periksa dampak"}
        </Button>
        <SubmitButton>Simpan</SubmitButton>
      </DialogFooter>
    </form>
  );
}

export function RuleDialog({
  rule,
  initialKeyword,
  label,
  variant = "default",
  size = "default",
}: {
  rule?: RuleRow;
  initialKeyword?: string;
  label: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
}) {
  const d = useActionDialog(rule ? updateRuleAction : createRuleAction);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => d.setOpen(true)}>
        {label}
      </Button>
      <Dialog open={d.open} onOpenChange={d.onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <RuleForm
            title={rule ? "Ubah aturan" : "Tambah aturan"}
            rule={rule}
            initialKeyword={initialKeyword}
            result={d.result}
            submit={d.submit}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- aktif/nonaktif dan hapus ---------- */

function ToggleActive({ rule }: { rule: RuleRow }) {
  const { result, submit } = useActionForm(setRuleActiveAction);
  return (
    <form action={submit} className="inline-flex flex-col items-end">
      <input type="hidden" name="id" value={rule.id} />
      <input type="hidden" name="isActive" value={String(!rule.isActive)} />
      <SubmitButton variant="ghost" size="sm">
        {rule.isActive ? "Nonaktifkan" : "Aktifkan"}
      </SubmitButton>
      {result && !result.ok ? <FormMessage result={result} /> : null}
    </form>
  );
}

function DeleteRuleDialog({ rule }: { rule: RuleRow }) {
  const d = useActionDialog(deleteRuleAction);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => d.setOpen(true)}>
        Hapus
      </Button>
      <Dialog open={d.open} onOpenChange={d.onOpenChange}>
        <DialogContent>
          <form action={d.submit} className="space-y-4">
            <input type="hidden" name="id" value={rule.id} />
            <DialogHeader>
              <DialogTitle>Hapus aturan &quot;{rule.keyword}&quot;?</DialogTitle>
              <DialogDescription>
                {rule.hits !== null
                  ? `Aturan ini sekarang menangkap ${rule.hits} item. `
                  : ""}
                Kategori item yang sudah ada tidak berubah sampai kamu menerapkan ulang aturan.
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

export function RuleRowActions({ rule }: { rule: RuleRow }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <RuleDialog rule={rule} label="Ubah" variant="ghost" size="sm" />
      <ToggleActive rule={rule} />
      <DeleteRuleDialog rule={rule} />
    </div>
  );
}
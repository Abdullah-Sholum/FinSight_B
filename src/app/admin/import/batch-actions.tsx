"use client";

import { useState } from "react";
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
import { getRollbackImpactAction, rollbackBatchAction } from "@/lib/actions/imports";
import type { BatchError, RollbackImpact } from "@/lib/import-types";
import {
  FieldError,
  FormMessage,
  SubmitButton,
  useActionDialog,
} from "../_components/action-ui";

export type BatchRow = {
  id: number;
  fileName: string;
  status: "COMPLETED" | "FAILED" | "ROLLED_BACK";
  errors: BatchError[];
};

function DetailDialog({ batch }: { batch: BatchRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Detail
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Batch #{batch.id}</DialogTitle>
            <DialogDescription>{batch.fileName}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            {batch.errors.map((e, i) => (
              <li key={i}>
                {e.line ? `baris ${e.line}` : "umum"}
                {e.legacyId ? ` (id ${e.legacyId})` : ""}
                {e.date ? ` · ${e.date}` : ""}: {e.message}
                {e.code ? ` [${e.code}]` : ""}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RollbackDialog({ batch }: { batch: BatchRow }) {
  const d = useActionDialog(rollbackBatchAction);
  const [impact, setImpact] = useState<RollbackImpact | null>(null);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  async function openDialog() {
    setImpact(null);
    setImpactError(null);
    setTyped("");
    d.setOpen(true);
    try {
      const fd = new FormData();
      fd.set("id", String(batch.id));
      const r = await getRollbackImpactAction(fd);
      if (r.ok && r.data) setImpact(r.data);
      else if (!r.ok) setImpactError(r.error);
    } catch {
      setImpactError("Gagal memuat dampak. Kemungkinan sesi sudah berakhir.");
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={openDialog}>
        Batalkan
      </Button>
      <Dialog open={d.open} onOpenChange={d.onOpenChange}>
        <DialogContent>
          <form action={d.submit} className="space-y-4">
            <input type="hidden" name="id" value={batch.id} />
            <DialogHeader>
              <DialogTitle>Batalkan batch #{batch.id}?</DialogTitle>
              <DialogDescription>{batch.fileName}</DialogDescription>
            </DialogHeader>

            {impactError ? (
              <p className="text-sm text-destructive">{impactError}</p>
            ) : !impact ? (
              <p className="text-sm text-muted-foreground">Menghitung dampak...</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p>
                  Akan menghapus <strong>{impact.entries}</strong> catatan harian dan{" "}
                  <strong>{impact.expenses}</strong> item.
                </p>
                {impact.laterAdded > 0 && (
                  <p className="text-destructive">
                    {impact.laterAdded} item ditambahkan lewat form setelah import pada hari-hari itu
                    dan ikut terhapus.
                  </p>
                )}
                {impact.manual > 0 && (
                  <p className="text-destructive">
                    {impact.manual} item berkategori manual ikut terhapus.
                  </p>
                )}
                <p className="text-muted-foreground">
                  Perubahan nominal atau nama pada item hasil import juga hilang. Tindakan ini tidak
                  bisa dibatalkan, tetapi file yang sama bisa diimpor ulang.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={`confirm-${batch.id}`}>Ketik BATALKAN untuk melanjutkan</Label>
              <Input
                id={`confirm-${batch.id}`}
                name="confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
              <FieldError result={d.result} name="confirm" />
            </div>

            <FormMessage result={d.result} />
            <DialogFooter>
              <SubmitButton
                variant="destructive"
                disabled={!impact || typed !== "BATALKAN"}
              >
                Batalkan batch
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BatchRowActions({ batch }: { batch: BatchRow }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {batch.errors.length > 0 && <DetailDialog batch={batch} />}
      {batch.status === "COMPLETED" && <RollbackDialog batch={batch} />}
    </div>
  );
}
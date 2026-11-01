"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyReapplyAction } from "@/lib/actions/rules";
import { FormMessage, SubmitButton, useActionDialog } from "../../_components/action-ui";

export function ApplyReapplyButton({
  digest,
  totalChanged,
  metadataOnly,
}: {
  digest: string;
  totalChanged: number;
  metadataOnly: number;
}) {
  const d = useActionDialog(applyReapplyAction);
  const label =
    totalChanged > 0
      ? `Terapkan ${totalChanged} perubahan`
      : `Perbarui ${metadataOnly} catatan aturan`;

  return (
    <>
      <Button onClick={() => d.setOpen(true)}>{label}</Button>
      <Dialog open={d.open} onOpenChange={d.onOpenChange}>
        <DialogContent>
          <form action={d.submit} className="space-y-4">
            <input type="hidden" name="digest" value={digest} />
            <DialogHeader>
              <DialogTitle>Terapkan ulang aturan?</DialogTitle>
              <DialogDescription>
                {totalChanged} item akan berpindah kategori. Koreksi manual dan item import yang
                sudah berkategori tidak disentuh. Tindakan ini tidak bisa dibatalkan, tetapi
                bisa dibalik dengan mengubah aturan lalu menerapkan ulang.
              </DialogDescription>
            </DialogHeader>
            <FormMessage result={d.result} />
            <DialogFooter>
              <SubmitButton>Terapkan</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
"use client";

import { useRouter } from "next/navigation";
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
  deleteDatasetAction,
  publishDatasetAction,
  unpublishDatasetAction,
  verifyDatasetAction,
} from "@/lib/actions/synthetic";
import {
  FieldError,
  FormMessage,
  SubmitButton,
  useActionDialog,
  useActionForm,
} from "../../_components/action-ui";

function VerifyButton({ id }: { id: number }) {
  const { result, submit } = useActionForm(verifyDatasetAction);
  return (
    <form action={submit} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="outline">Periksa ulang</SubmitButton>
      <FormMessage result={result} />
    </form>
  );
}

function PublishDialog({ id, canPublish }: { id: number; canPublish: boolean }) {
  const d = useActionDialog(publishDatasetAction);
  return (
    <>
      <Button
        onClick={() => d.setOpen(true)}
        disabled={!canPublish}
        title={canPublish ? undefined : "Lulus semua pemeriksaan dulu (klik Periksa ulang)"}
      >
        Terbitkan
      </Button>
      <Dialog open={d.open} onOpenChange={d.onOpenChange}>
        <DialogContent>
          <form action={d.submit} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <DialogHeader>
              <DialogTitle>Terbitkan dataset ini?</DialogTitle>
              <DialogDescription>
                Dataset akan tampil di dashboard publik dan menggantikan dataset terbit sebelumnya
                (kalau ada). Semua pemeriksaan dihitung ulang sebelum terbit, dan terbit ditolak
                kalau ada yang gagal. Pastikan kamu sudah meninjau pratinjau dan laporannya.
              </DialogDescription>
            </DialogHeader>
            <FormMessage result={d.result} />
            <DialogFooter>
              <SubmitButton>Terbitkan</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UnpublishButton({ id }: { id: number }) {
  const { result, submit } = useActionForm(unpublishDatasetAction);
  return (
    <form action={submit} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="outline">Tarik dari publik</SubmitButton>
      <FormMessage result={result} />
    </form>
  );
}

function DeleteDialog({ id, name, isPublished }: { id: number; name: string; isPublished: boolean }) {
  const router = useRouter();
  const d = useActionDialog(async (fd) => {
    const r = await deleteDatasetAction(fd);
    if (r.ok) router.push("/admin/sintesis");
    return r;
  });
  return (
    <>
      <Button
        variant="destructive"
        onClick={() => d.setOpen(true)}
        disabled={isPublished}
        title={isPublished ? "Tarik dari publik dulu" : undefined}
      >
        Hapus
      </Button>
      <Dialog open={d.open} onOpenChange={d.onOpenChange}>
        <DialogContent>
          <form action={d.submit} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <DialogHeader>
              <DialogTitle>Hapus &quot;{name}&quot;?</DialogTitle>
              <DialogDescription>
                Seluruh hari dan item dataset ini dihapus. Data asli tidak terpengaruh. Dataset
                yang sama bisa dibuat ulang dari seed yang sama.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">Ketik HAPUS untuk melanjutkan</Label>
              <Input id="confirm-delete" name="confirm" autoComplete="off" />
              <FieldError result={d.result} name="confirm" />
            </div>
            <FormMessage result={d.result} />
            <DialogFooter>
              <SubmitButton variant="destructive">Hapus dataset</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DatasetActions(props: {
  id: number;
  name: string;
  isPublished: boolean;
  canPublish: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <VerifyButton id={props.id} />
      {props.isPublished ? (
        <UnpublishButton id={props.id} />
      ) : (
        <PublishDialog id={props.id} canPublish={props.canPublish} />
      )}
      <DeleteDialog id={props.id} name={props.name} isPublished={props.isPublished} />
    </div>
  );
}
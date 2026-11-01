"use server";

import { revalidatePath } from "next/cache";
import * as synthetic from "@/lib/services/synthetic";
import {
  createDraftSchema,
  datasetIdSchema,
  deleteDatasetSchema,
} from "@/lib/validation/synthetic";
import { guard } from "./guard";
import { fail, type ActionResult } from "./result";

function revalidateAll() {
  revalidatePath("/admin", "layout");
  revalidatePath("/"); // dashboard publik
}

export async function createDraftAction(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  return guard<{ id: number }>(async () => {
    const parsed = createDraftSchema.safeParse({
      seed: formData.get("seed") ?? "",
      privacy: formData.get("privacy"),
      endDate: formData.get("endDate") ?? "",
    });
    if (!parsed.success) return fail(parsed.error);

    const r = await synthetic.createDraft(parsed.data);
    revalidateAll();
    return {
      ok: true,
      data: { id: r.id },
      message: r.passed ? "Draf dibuat." : "Draf dibuat, tetapi belum lulus semua pemeriksaan.",
    };
  });
}

export async function verifyDatasetAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = datasetIdSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) return fail(parsed.error);

    const v = await synthetic.verifyDataset(parsed.data.id);
    revalidateAll();
    if (v.passed) return { ok: true, message: "Semua pemeriksaan lulus." };
    return {
      ok: false,
      error: `Pemeriksaan gagal${v.withdrawn ? " dan dataset ditarik dari publik" : ""}. Lihat laporan di bawah.`,
    };
  });
}

export async function publishDatasetAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = datasetIdSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) return fail(parsed.error);

    try {
      await synthetic.publishDataset(parsed.data.id);
    } finally {
      revalidateAll(); // pemeriksaan ulang memperbarui laporan, berhasil atau tidak
    }
    return { ok: true, message: "Dataset diterbitkan." };
  });
}

export async function unpublishDatasetAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = datasetIdSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) return fail(parsed.error);

    await synthetic.unpublishDataset(parsed.data.id);
    revalidateAll();
    return { ok: true, message: "Dataset ditarik dari publik." };
  });
}

export async function deleteDatasetAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = deleteDatasetSchema.safeParse({
      id: formData.get("id"),
      confirm: formData.get("confirm"),
    });
    if (!parsed.success) return fail(parsed.error);

    await synthetic.deleteDataset(parsed.data.id);
    revalidateAll();
    return { ok: true, message: "Dataset dihapus." };
  });
}
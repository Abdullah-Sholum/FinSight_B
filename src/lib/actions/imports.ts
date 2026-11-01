"use server";

import { revalidatePath } from "next/cache";
import type { ImportReport, RollbackImpact } from "@/lib/import-types";
import * as imports from "@/lib/services/imports";
import {
  analyzeImportSchema,
  commitImportSchema,
  rollbackBatchSchema,
  rollbackImpactSchema,
} from "@/lib/validation/import-file";
import { guard } from "./guard";
import { fail, type ActionResult } from "./result";

function revalidateAll() {
  revalidatePath("/admin", "layout");
}

export async function analyzeImportAction(
  formData: FormData,
): Promise<ActionResult<ImportReport>> {
  return guard<ImportReport>(async () => {
    const parsed = analyzeImportSchema.safeParse({ file: formData.get("file") });
    if (!parsed.success) return fail(parsed.error);

    const text = await parsed.data.file.text();
    const data = await imports.analyzeImport(text, parsed.data.file.name);
    return { ok: true, data };
  });
}

export async function commitImportAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = commitImportSchema.safeParse({
      file: formData.get("file"),
      digest: formData.get("digest"),
      allowErrors: formData.get("allowErrors") === "on",
    });
    if (!parsed.success) return fail(parsed.error);

    const text = await parsed.data.file.text();
    const r = await imports.commitImport({
      text,
      fileName: parsed.data.file.name,
      digest: parsed.data.digest,
      allowErrors: parsed.data.allowErrors,
    });
    revalidateAll();
    return {
      ok: true,
      message: `Batch #${r.batchId}: ${r.days} hari dan ${r.items} item tersimpan.`,
    };
  });
}

export async function getRollbackImpactAction(
  formData: FormData,
): Promise<ActionResult<RollbackImpact>> {
  return guard<RollbackImpact>(async () => {
    const parsed = rollbackImpactSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) return fail(parsed.error);

    const data = await imports.getRollbackImpact(parsed.data.id);
    return { ok: true, data };
  });
}

export async function rollbackBatchAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = rollbackBatchSchema.safeParse({
      id: formData.get("id"),
      confirm: formData.get("confirm"),
    });
    if (!parsed.success) return fail(parsed.error);

    const r = await imports.rollbackBatch(parsed.data.id);
    revalidateAll();
    return {
      ok: true,
      message: `Batch #${parsed.data.id} dibatalkan: ${r.entries} catatan harian dan ${r.expenses} item dihapus.`,
    };
  });
}
"use server";

import { revalidatePath } from "next/cache";
import * as categories from "@/lib/services/categories";
import {
  categoryFormSchema,
  deleteCategorySchema,
  mergeCategorySchema,
  updateCategorySchema,
} from "@/lib/validation/category";
import { guard } from "./guard";
import { fail, type ActionResult } from "./result";

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/kategori");
}

export async function createCategoryAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = categoryFormSchema.safeParse({
      name: formData.get("name"),
      color: formData.get("color"),
    });
    if (!parsed.success) return fail(parsed.error);

    await categories.createCategory(parsed.data);
    revalidateAdmin();
    return { ok: true, message: "Kategori dibuat." };
  });
}

export async function updateCategoryAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = updateCategorySchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      color: formData.get("color"),
    });
    if (!parsed.success) return fail(parsed.error);

    await categories.updateCategory(parsed.data.id, parsed.data);
    revalidateAdmin();
    return { ok: true, message: "Kategori diperbarui." };
  });
}

export async function deleteCategoryAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = deleteCategorySchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) return fail(parsed.error);

    await categories.deleteCategory(parsed.data.id);
    revalidateAdmin();
    return { ok: true, message: "Kategori dihapus." };
  });
}

export async function mergeCategoryAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = mergeCategorySchema.safeParse({
      fromId: formData.get("fromId"),
      toId: formData.get("toId"),
    });
    if (!parsed.success) return fail(parsed.error);

    const r = await categories.mergeCategory(parsed.data.fromId, parsed.data.toId);
    revalidateAdmin();
    return {
      ok: true,
      message: `"${r.from}" digabung ke "${r.to}": ${r.expenses} item dan ${r.rules} aturan dipindahkan.`,
    };
  });
}
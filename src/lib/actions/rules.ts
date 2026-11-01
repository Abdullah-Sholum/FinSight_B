"use server";

import { revalidatePath } from "next/cache";
import * as ruleEffects from "@/lib/services/rule-effects";
import * as rules from "@/lib/services/rules";
import type { EffectSummary } from "@/lib/rule-types";
import {
  applyReapplySchema,
  deleteRuleSchema,
  previewRuleSchema,
  ruleFormSchema,
  setRuleActiveSchema,
  updateRuleSchema,
} from "@/lib/validation/rule";
import { guard } from "./guard";
import { fail, type ActionResult } from "./result";

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

function ruleFields(formData: FormData) {
  return {
    keyword: formData.get("keyword"),
    categoryId: formData.get("categoryId"),
    priority: formData.get("priority") ?? "0",
    note: formData.get("note") ?? "",
    isActive: formData.get("isActive") === "on",
  };
}

export async function createRuleAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = ruleFormSchema.safeParse(ruleFields(formData));
    if (!parsed.success) return fail(parsed.error);

    await rules.createRule(parsed.data);
    revalidateAdmin();
    return { ok: true, message: "Aturan dibuat." };
  });
}

export async function updateRuleAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = updateRuleSchema.safeParse({
      ...ruleFields(formData),
      id: formData.get("id"),
    });
    if (!parsed.success) return fail(parsed.error);

    await rules.updateRule(parsed.data.id, parsed.data);
    revalidateAdmin();
    return { ok: true, message: "Aturan diperbarui." };
  });
}

export async function setRuleActiveAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = setRuleActiveSchema.safeParse({
      id: formData.get("id"),
      isActive: formData.get("isActive"),
    });
    if (!parsed.success) return fail(parsed.error);

    await rules.setRuleActive(parsed.data.id, parsed.data.isActive);
    revalidateAdmin();
    return { ok: true, message: parsed.data.isActive ? "Aturan diaktifkan." : "Aturan dinonaktifkan." };
  });
}

export async function deleteRuleAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = deleteRuleSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) return fail(parsed.error);

    const r = await rules.deleteRule(parsed.data.id);
    revalidateAdmin();
    return {
      ok: true,
      message: `Aturan "${r.keyword}" dihapus. ${r.used} item masih memakainya sampai kamu menerapkan ulang aturan.`,
    };
  });
}

export async function previewRuleAction(
  formData: FormData,
): Promise<ActionResult<EffectSummary>> {
  return guard<EffectSummary>(async () => {
    const parsed = previewRuleSchema.safeParse({
      ...ruleFields(formData),
      id: formData.get("id") || undefined,
    });
    if (!parsed.success) return fail(parsed.error);

    const data = await ruleEffects.previewRuleChange(parsed.data);
    return { ok: true, data };
  });
}

export async function applyReapplyAction(formData: FormData): Promise<ActionResult> {
  return guard(async () => {
    const parsed = applyReapplySchema.safeParse({ digest: formData.get("digest") });
    if (!parsed.success) return fail(parsed.error);

    const r = await ruleEffects.applyReapply(parsed.data.digest);
    revalidateAdmin();
    return {
      ok: true,
      message: `${r.categoryChanged} item berpindah kategori (${r.updated} catatan diperbarui).`,
    };
  });
}
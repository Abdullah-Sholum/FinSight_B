import { requireAdmin, UnauthorizedError } from "@/lib/auth/require-admin";
import { DomainError } from "@/lib/services/errors";
import type { ActionResult } from "./result";

export async function guard(
  fn: () => Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return {
        ok: false,
        error: "Sesi berakhir atau tidak berwenang. Muat ulang halaman dan login lagi.",
      };
    }
    throw e;
  }

  try {
    return await fn();
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, error: e.message };
    throw e; // kesalahan tak terduga tetap naik agar tercatat
  }
}
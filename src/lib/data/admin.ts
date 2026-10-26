import { requireAdmin } from "@/lib/auth/require-admin";
import * as core from "./admin-core";
import type { DateRange } from "./insights";

export async function getRealDataset() {
  await requireAdmin();
  return core.getRealDataset();
}

export async function getAdminOverview(range: DateRange = {}) {
  await requireAdmin();
  return core.getAdminOverview(range);
}
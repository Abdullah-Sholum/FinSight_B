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

export async function getCategoriesWithStats() {
  await requireAdmin();
  return core.getCategoriesWithStats();
}

export async function getDayDetail(date: string) {
  await requireAdmin();
  return core.getDayDetail(date);
}

export async function getEntriesOfMonth(month: string) {
  await requireAdmin();
  return core.getEntriesOfMonth(month);
}

export async function getEntryBounds() {
  await requireAdmin();
  return core.getEntryBounds();
}

export async function getUnrecordedDates(today: string) {
  await requireAdmin();
  return core.getUnrecordedDates(today);
}

export async function getCategoryOptions() {
  await requireAdmin();
  return core.getCategoryOptions();
}

export async function getRuleInputs() {
  await requireAdmin();
  return core.getRuleInputs();
}
import type { Check } from "./checks";
import type { PrivacyLevel, SyntheticProfile } from "./types";

// disimpan di kolom Dataset.config; hanya dibaca admin
export type DraftConfig = {
  version: 1;
  generatorVersion: string;
  privacy: PrivacyLevel;
  seed: number;
  endDate: string;
  profile: SyntheticProfile;
  contentFingerprint: string;
  stats: { days: number; emptyDays: number; items: number; total: number };
  integrity: { ok: boolean; at: string };
  plausibility: { passed: boolean; checks: Check[]; at: string };
  leak: {
    passed: boolean;
    checks: Check[];
    selfTest: Check[];
    forbiddenListUsed: boolean;
    at: string;
  };
};

export function readConfig(json: unknown): DraftConfig | null {
  if (typeof json !== "object" || json === null) return null;
  const c = json as Partial<DraftConfig>;
  const ok =
    c.version === 1 &&
    typeof c.seed === "number" &&
    typeof c.endDate === "string" &&
    typeof c.contentFingerprint === "string" &&
    !!c.profile &&
    !!c.stats &&
    typeof c.integrity?.ok === "boolean" &&
    Array.isArray(c.plausibility?.checks) &&
    Array.isArray(c.leak?.checks) &&
    Array.isArray(c.leak?.selfTest);
  return ok ? (c as DraftConfig) : null;
}
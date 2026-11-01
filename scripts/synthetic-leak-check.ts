import "dotenv/config";
import { todayInJakarta } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  loadDayRecords,
  loadForbiddenPhrases,
  loadRealForLeak,
} from "@/lib/services/synthetic-input";
import { generateSynthetic } from "@/lib/synthetic/generate";
import { checkLeaks, runLeakSelfTest } from "@/lib/synthetic/leak";
import { buildProfile, PRIVACY_NOISE } from "@/lib/synthetic/profile";
import type { PrivacyLevel } from "@/lib/synthetic/types";
import { VOCABULARY } from "@/lib/synthetic/vocabulary";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

async function main() {
  const seed = Number(arg("seed", "42"));
  const privacy = arg("privacy", "balanced").toUpperCase() as PrivacyLevel;
  if (!Number.isInteger(seed) || seed < 0) throw new Error("--seed harus bilangan bulat >= 0");
  if (!(privacy in PRIVACY_NOISE)) throw new Error("--privacy harus low, balanced, atau high");

  const [records, real] = await Promise.all([loadDayRecords(), loadRealForLeak()]);
  const forbidden = loadForbiddenPhrases();
  const input = { vocabulary: VOCABULARY, forbidden };

  const profile = buildProfile(records, { privacy, seed });
  const days = generateSynthetic(profile, { seed, endDate: todayInJakarta(), vocabulary: VOCABULARY });

  console.log(`Seed ${seed} · privasi ${privacy} · daftar larang: ${forbidden.length} frasa\n`);
  const checks = checkLeaks(days, real, input);
  const selfTest = runLeakSelfTest(days, real, input);

  console.log("=== UJI KEBOCORAN ===");
  for (const c of checks) console.log(`  ${c.ok ? "LULUS" : "GAGAL"}  ${c.name}: ${c.detail}`);
  console.log("\n=== UJI NEGATIF (pemeriksa harus menangkap manipulasi) ===");
  for (const c of selfTest) console.log(`  ${c.ok ? "LULUS" : "GAGAL"}  ${c.name}: ${c.detail}`);

  const failed = [...checks, ...selfTest].filter((c) => !c.ok);
  console.log(failed.length === 0 ? "\nRINGKASAN: LULUS" : `\nRINGKASAN: GAGAL (${failed.length})`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
import "dotenv/config";
import { todayInJakarta } from "@/lib/dates";
import { rupiah } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { loadDayRecords, loadTokenCounts } from "@/lib/services/synthetic-input";
import { checkPlausibility } from "@/lib/synthetic/checks";
import { generateSynthetic } from "@/lib/synthetic/generate";
import { buildProfile, MIN_GROUP, PRIVACY_NOISE } from "@/lib/synthetic/profile";
import { computeStats, fingerprint, toRecords } from "@/lib/synthetic/stats";
import { GENERATOR_VERSION, type PrivacyLevel } from "@/lib/synthetic/types";
import { VOCABULARY, vocabularyTokens } from "@/lib/synthetic/vocabulary";
import { isRealDate } from "@/lib/validation/import-row";

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const line = (label: string, a: string, b: string) =>
  console.log(`  ${label.padEnd(32)} ${a.padStart(16)} ${b.padStart(16)}`);

async function main() {
  const seed = Number(arg("seed", "42"));
  if (!Number.isInteger(seed) || seed < 0 || seed > 4_294_967_295) {
    throw new Error("--seed harus bilangan bulat 0 sampai 4294967295");
  }
  const privacy = arg("privacy", "balanced").toUpperCase() as PrivacyLevel;
  if (!(privacy in PRIVACY_NOISE)) throw new Error("--privacy harus low, balanced, atau high");
  const today = todayInJakarta();
  const endDate = arg("end", today);
  if (!isRealDate(endDate) || endDate > today) {
    throw new Error("--end harus tanggal YYYY-MM-DD yang valid dan tidak di masa depan");
  }

  const records = await loadDayRecords();
  const real = computeStats(records);
  const profile = buildProfile(records, { privacy, seed });
  const days = generateSynthetic(profile, { seed, endDate, vocabulary: VOCABULARY });
  const syn = computeStats(toRecords(days));
  const failures: string[] = [];

  // ---------- profil ----------
  console.log("=== PROFIL (satu-satunya yang dilihat generator) ===");
  console.log(
    `Generator v${GENERATOR_VERSION} · privasi ${privacy} (noise ${PRIVACY_NOISE[privacy]}) · seed ${seed}`,
  );
  console.log(`Jendela: ${profile.days} hari, berakhir ${endDate}`);
  console.log(
    `Hari kosong: hari kerja ${pct(profile.emptyRate.weekday)}, akhir pekan ${pct(profile.emptyRate.weekend)}`,
  );
  for (const [label, d] of [
    ["hari kerja", profile.itemsPerDay.weekday],
    ["akhir pekan", profile.itemsPerDay.weekend],
  ] as const) {
    console.log(
      `Item per hari (${label}): ${d.values.map((v, i) => `${v}=${pct(d.weights[i], 0)}`).join("  ")}`,
    );
  }
  console.log("Kategori:");
  for (const c of profile.categories) {
    console.log(
      `  ${c.name.padEnd(20)} bobot ${pct(c.weight).padStart(6)}  median ${rupiah(Math.exp(c.mu)).padStart(11)}  sigma ${c.sigma.toFixed(2)}`,
    );
  }
  if (profile.spikes) {
    console.log(
      `Lonjakan: ${profile.spikes.count} kejadian, ${rupiah(profile.spikes.minAmount)} s/d ${rupiah(profile.spikes.maxAmount)} (skala ~50%), kategori: ${profile.spikes.categories
        .map((c) => `${c.name} ${pct(c.weight, 0)}`)
        .join(", ")}`,
    );
  } else {
    console.log("Lonjakan: tidak dimodelkan (item besar di data asli kurang dari ambang)");
  }
  console.log(`Dikecualikan: ${profile.review.excluded.join(", ")}`);
  console.log(`Dibuang (item < ${MIN_GROUP}): ${profile.review.droppedCategories.join(", ") || "-"}`);

  // ---------- perbandingan agregat ----------
  console.log("\n=== PERBANDINGAN AGREGAT ===");
  line("", "ASLI", "SINTESIS");
  line("Hari", String(real.days), String(syn.days));
  line("Hari kosong", String(real.emptyDays), String(syn.emptyDays));
  line("Proporsi hari kosong", pct(real.emptyDays / real.days), pct(syn.emptyDays / syn.days));
  line("Item", String(real.items), String(syn.items));
  line("Total", rupiah(real.total), rupiah(syn.total));
  line("Rata-rata per hari", rupiah(real.avgPerDay), rupiah(syn.avgPerDay));
  line("Rata-rata hari kerja", rupiah(real.weekdayAvg), rupiah(syn.weekdayAvg));
  line("Rata-rata akhir pekan", rupiah(real.weekendAvg), rupiah(syn.weekendAvg));
  line("Item per hari berpengeluaran", real.itemsPerExpenseDay.toFixed(2), syn.itemsPerExpenseDay.toFixed(2));
  console.log("  Porsi item per kategori:");
  const names = [...new Set([...real.byCategory.keys(), ...syn.byCategory.keys()])].sort();
  for (const n of names) {
    const a = (real.byCategory.get(n)?.items ?? 0) / real.items;
    const b = (syn.byCategory.get(n)?.items ?? 0) / Math.max(syn.items, 1);
    line(`  ${n}`, pct(a), b ? pct(b) : "-");
  }
  console.log(
    "  Catatan: sintesis lebih rendah karena Lain-lain dan Uncategorized tidak ikut dan lonjakan diskalakan ~50%.",
  );

  // ---------- uji kewajaran ----------
  console.log("\n=== UJI KEWAJARAN ===");
  const checks = checkPlausibility(profile, days);
  for (const c of checks) {
    console.log(`  ${c.ok ? "LULUS" : "GAGAL"}  ${c.name}: ${c.detail}`);
    if (!c.ok) failures.push(c.name);
  }

  // uji negatif: pemeriksa HARUS menangkap data yang dirusak
  const tampered = structuredClone(days);
  const victim = tampered.find((d) => d.expenses.length > 0);
  if (victim) victim.expenses[0].categoryName = "Uncategorized";
  const caught = checkPlausibility(profile, tampered).some((c) => !c.ok);
  console.log(`  ${caught ? "LULUS" : "GAGAL"}  Uji negatif: pemeriksa menangkap data yang dimanipulasi`);
  if (!caught) failures.push("uji negatif kewajaran");

  // ---------- keterulangan ----------
  console.log("\n=== KETERULANGAN ===");
  const again = generateSynthetic(profile, { seed, endDate, vocabulary: VOCABULARY });
  const other = generateSynthetic(profile, {
    seed: (seed + 1) % 4_294_967_296,
    endDate,
    vocabulary: VOCABULARY,
  });
  const sameData = fingerprint(days) === fingerprint(again);
  const diffData = fingerprint(days) !== fingerprint(other);
  const sameProfile =
    JSON.stringify(profile) === JSON.stringify(buildProfile(records, { privacy, seed }));
  const diffProfile =
    JSON.stringify(profile) !==
    JSON.stringify(buildProfile(records, { privacy, seed: (seed + 1) % 4_294_967_296 }));
  console.log(`  Sidik jari data: ${fingerprint(days).slice(0, 12)}`);
  for (const [label, ok] of [
    ["Seed sama menghasilkan data identik", sameData],
    ["Seed berbeda menghasilkan data berbeda", diffData],
    ["Seed sama menghasilkan profil identik", sameProfile],
    ["Seed berbeda menghasilkan profil berbeda", diffProfile],
  ] as const) {
    console.log(`  ${ok ? "LULUS" : "GAGAL"}  ${label}`);
    if (!ok) failures.push(label);
  }

  // ---------- kosakata vs data asli ----------
  console.log("\n=== KOSAKATA ===");
  const tokenCounts = await loadTokenCounts();
  const tokens = vocabularyTokens(VOCABULARY);
  const risky = tokens.filter((t) => {
    const n = tokenCounts.get(t) ?? 0;
    return n >= 1 && n < MIN_GROUP;
  });
  console.log(`  ${tokens.length} kata di daftar putih.`);
  if (risky.length === 0) {
    console.log("  LULUS  Tidak ada kata yang di data asli muncul terlalu jarang");
  } else {
    console.log(
      `  GAGAL  ${risky.length} kata muncul di data asli kurang dari ${MIN_GROUP} kali (terlalu khas). Hapus dari vocabulary.ts:`,
    );
    for (const t of risky) console.log(`    - ${t} (${tokenCounts.get(t)}x di data asli)`);
    failures.push("kosakata berisiko");
  }

  console.log(
    failures.length === 0
      ? "\nRINGKASAN: LULUS"
      : `\nRINGKASAN: GAGAL (${failures.length}): ${failures.join("; ")}`,
  );
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
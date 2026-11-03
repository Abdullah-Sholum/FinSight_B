import "dotenv/config";
import { normalizeText } from "@/lib/categorize";
import { prisma } from "@/lib/prisma";
import { loadForbiddenPhrases, loadRealForLeak } from "@/lib/services/synthetic-input";
import { VOCABULARY } from "@/lib/synthetic/vocabulary";

const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");
const ignoreAt = args.indexOf("--ignore");
const IGNORE = new Set(
  (ignoreAt >= 0 ? (args[ignoreAt + 1] ?? "") : "")
    .split(",")
    .map((s) => normalizeText(s))
    .filter(Boolean),
);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Hasil hanya menyebut jumlah dan konteks yang disamarkan, bukan istilahnya.
function findHits(text: string, terms: string[]) {
  const hay = text.toLowerCase();
  const hits: { n: number; len: number; count: number; context: string }[] = [];
  terms.forEach((term, n) => {
    const re = new RegExp(`(?<![a-z0-9])${escapeRe(term)}(?![a-z0-9])`, "g");
    const matches = [...hay.matchAll(re)];
    if (matches.length === 0) return;
    const i = matches[0].index ?? 0;
    const before = hay.slice(Math.max(0, i - 30), i);
    const after = hay.slice(i + term.length, i + term.length + 30);
    hits.push({
      n,
      len: term.length,
      count: matches.length,
      context: `${before}[…]${after}`.replace(/\s+/g, " "),
    });
  });
  return hits;
}

const failures: string[] = [];
function ok(name: string, pass: boolean, detail: string) {
  console.log(`  ${pass ? "LULUS" : "GAGAL"}  ${name}: ${detail}`);
  if (!pass) failures.push(name);
}

async function buildTerms() {
  const real = await loadRealForLeak();

  const whitelist = new Set<string>();
  for (const group of [VOCABULARY.regular, VOCABULARY.big]) {
    for (const list of Object.values(group)) {
      for (const p of list) whitelist.add(normalizeText(p));
    }
  }
  // kata umum yang memang ada di daftar putih dilewati; sisanya khas data asli
  const items = new Set<string>();
  for (const d of real) {
    for (const i of d.items) {
      const t = normalizeText(i.item);
      if (t.length >= 4 && !whitelist.has(t) && !IGNORE.has(t)) items.add(t);
    }
  }

  const names = (
    await prisma.dataset.findMany({ where: { type: "SYNTHETIC" }, select: { name: true } })
  ).map((d) => normalizeText(d.name));

  return {
    "Teks item asli": [...items],
    "Penanda internal": [
      "data asli",
      "raw_line",
      "source_file",
      "legacyid",
      "categorysource",
      "passwordhash",
      "category_map",
      "forbidden-words",
      "financesight_user",
      "auth_secret",
      "database_url",
    ],
    "Nama dataset": names,
    "Daftar larang": loadForbiddenPhrases(),
  } as Record<string, string[]>;
}

async function main() {
  let html: string;
  let res: Response;
  try {
    res = await fetch(`${BASE}/`, { redirect: "manual" });
    html = await res.text();
  } catch {
    throw new Error(`Server tidak terjangkau di ${BASE}. Jalankan "npm run start" di terminal lain.`);
  }

  console.log(`Memeriksa ${BASE}/ (${html.length} karakter)\n`);
  console.log("=== STRUKTUR ===");
  ok("Status halaman", res.status === 200, `status ${res.status}`);
  ok("Bahasa dokumen", /<html[^>]*lang="id"/i.test(html), "lang=\"id\"");
  ok("Label data sintesis", /data sintesis/i.test(html), "label terlihat di halaman");
  ok("Tanpa cookie", res.headers.get("set-cookie") === null, "halaman publik tidak mengatur cookie");
  console.log(
    `  info  cache-control: ${res.headers.get("cache-control") ?? "-"} | x-nextjs-cache: ${res.headers.get("x-nextjs-cache") ?? "-"}`,
  );

  console.log("\n=== RUTE LAIN ===");
  const admin = await fetch(`${BASE}/admin`, { redirect: "manual" });
  const where = admin.headers.get("location") ?? "";
  ok(
    "/admin tanpa login dialihkan ke login",
    [301, 302, 303, 307, 308].includes(admin.status) && where.includes("/login"),
    `status ${admin.status}, tujuan ${where || "-"}`,
  );
  const login = await fetch(`${BASE}/login`, { redirect: "manual" });
  ok("/login terbuka", login.status === 200, `status ${login.status}`);
  const api = await fetch(`${BASE}/api/data`, { redirect: "manual" });
  ok("Tidak ada endpoint data publik", api.status === 404, `/api/data status ${api.status}`);

  console.log("\n=== PEMINDAIAN KELUARAN ===");
  const terms = await buildTerms();
  for (const [group, list] of Object.entries(terms)) {
    if (list.length === 0) {
      ok(group, true, "dilewati: tidak ada istilah untuk diperiksa");
      continue;
    }
    const hits = findHits(html, list);
    ok(
      group,
      hits.length === 0,
      hits.length === 0
        ? `${list.length} istilah diperiksa, tidak ada yang muncul`
        : `${hits.length} istilah muncul (konteks disamarkan): ${hits
            .slice(0, 5)
            .map((h) => `#${h.n} panjang ${h.len} x${h.count} "${h.context}"`)
            .join(" | ")}`,
    );
  }

  console.log("\n=== UJI NEGATIF (pemindai harus menangkap istilah yang disusupkan) ===");
  for (const [group, list] of Object.entries(terms)) {
    if (list.length === 0) {
      ok(`Uji negatif: ${group}`, true, "dilewati: tidak ada istilah");
      continue;
    }
    const caught = findHits(`${html} ${list[0]} `, [list[0]]).length > 0;
    ok(`Uji negatif: ${group}`, caught, caught ? "pemindai menangkap" : "pemindai GAGAL menangkap");
  }

  console.log(failures.length === 0 ? "\nRINGKASAN: LULUS" : `\nRINGKASAN: GAGAL (${failures.length}): ${failures.join("; ")}`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
import { normalizeText } from "@/lib/categorize";

export type Vocabulary = {
  regular: Record<string, string[]>; // item sehari-hari
  big: Record<string, string[]>; // pembelian besar (lonjakan)
};

export const VOCABULARY: Vocabulary = {
  regular: {
    "Makanan & Minuman": [
      "makan", "kopi", "teh", "mie ayam", "minum", "air minum", "susu",
      "roti", "bakso", "soto", "lauk", "buah",
    ],
    Jajan: ["jajan", "camilan", "kue", "keripik", "cokelat", "boba", "hiburan"],
    Transportasi: ["bensin", "parkir", "ojek online", "tol", "angkot", "bus"],
    "Kebutuhan Rumah": [
      "sabun", "bumbu", "detergen", "laundry", "alat tulis", "fotokopi", "galon",
    ],
    "Kebutuhan Diri": [
      "masker", "kaos", "parfum", "deodoran", "perawatan diri",
    ],
    Olahraga: ["gym", "badminton", "lari", "perlengkapan olahraga"],
    "Elektronik & Hobi": [
      "charger", "sensor", "headset", "speaker", "aksesori elektronik", "modul",
    ],
  },
  big: {
    "Elektronik & Hobi": ["perangkat elektronik", "peralatan hobi"],
    "Kebutuhan Diri": ["pakaian", "perlengkapan pribadi"],
    "Kebutuhan Rumah": ["perabot", "perlengkapan rumah"],
    Olahraga: ["perlengkapan olahraga", "keanggotaan"],
    Transportasi: ["servis kendaraan", "tiket perjalanan"],
    "Makanan & Minuman": ["makan bersama"],
    Jajan: ["hiburan"],
  },
};

export function vocabularyTokens(v: Vocabulary): string[] {
  const set = new Set<string>();
  for (const group of [v.regular, v.big]) {
    for (const list of Object.values(group)) {
      for (const phrase of list) {
        for (const t of normalizeText(phrase).split(" ")) {
          if (/[a-z]/.test(t)) set.add(t);
        }
      }
    }
  }
  return [...set].sort();
}
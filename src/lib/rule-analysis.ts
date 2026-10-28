import { containsPhrase, normalizeText } from "./categorize";

export type RuleLite = { keyword: string; categoryName: string };

// aturan yang berkaitan dengan kata kunci yang sedang diketik
export function relatedRules(
  keyword: string,
  rules: RuleLite[],
  categoryName?: string,
  exclude?: string,
) {
  const out = {
    exact: [] as RuleLite[],
    longer: [] as RuleLite[], // frasa lebih panjang yang memuat kata kunci ini
    shorter: [] as RuleLite[], // frasa lebih pendek yang termuat di kata kunci ini
  };
  const k = normalizeText(keyword);
  if (!k) return out;
  const ex = exclude ? normalizeText(exclude) : null;

  for (const r of rules) {
    const rk = normalizeText(r.keyword);
    if (ex && rk === ex) continue;
    if (rk === k) {
      out.exact.push(r);
    } else if (r.categoryName !== categoryName) {
      if (containsPhrase(rk, k)) out.longer.push(r);
      else if (containsPhrase(k, rk)) out.shorter.push(r);
    }
  }
  return out;
}
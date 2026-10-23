export type RuleInput = {
  keyword: string;
  priority: number;
  categoryName: string;
};

export const normalizeText = (s: string) =>
  s.toLowerCase().trim().replace(/\s+/g, " ");

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildMatcher(rules: RuleInput[]) {
  const compiled = rules.map((r) => ({
    ...r,
    regex: new RegExp(
      `(?:^|[^a-z0-9])${escapeRegExp(normalizeText(r.keyword))}(?:$|[^a-z0-9])`,
    ),
  }));

  return (item: string): { keyword: string; categoryName: string } | null => {
    const text = normalizeText(item);
    let best: (typeof compiled)[number] | null = null;
    for (const r of compiled) {
      if (!r.regex.test(text)) continue;
      if (
        !best ||
        r.keyword.length > best.keyword.length ||
        (r.keyword.length === best.keyword.length && r.priority > best.priority)
      ) {
        best = r;
      }
    }
    return best ? { keyword: best.keyword, categoryName: best.categoryName } : null;
  };
}
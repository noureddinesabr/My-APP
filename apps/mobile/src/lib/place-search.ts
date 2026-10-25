/**
 * Type-ahead search over named places in Arabic, French and English.
 * Self-contained (no imports) so it can be unit-tested with plain Node.
 */

export type Searchable = {
  id: string;
  kind: 'city' | 'district' | 'industrial' | 'port';
  name: { ar: string; fr: string; en: string };
  aliases?: readonly string[];
};

/** Same rules as geo.normalize, repeated here to keep this file import-free. */
function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ْ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function score(item: Searchable, query: string) {
  const names = [item.name.ar, item.name.fr, item.name.en, ...(item.aliases ?? [])].map(normalize);
  let best = 0;
  for (const name of names) {
    if (name === query) best = Math.max(best, 100);
    else if (name.startsWith(query)) best = Math.max(best, 80);
    else if (name.split(' ').some((word) => word.startsWith(query))) best = Math.max(best, 60);
    else if (query.length >= 3 && name.includes(query)) best = Math.max(best, 30);
  }
  if (!best) return 0;
  // Cities first, then the rest, so "casa" shows Casablanca above its districts.
  return best + (item.kind === 'city' ? 10 : 0);
}

/** Best matches for what the user typed so far; empty for an empty query. */
export function searchPlaces<T extends Searchable>(items: readonly T[], text: string, limit = 6): T[] {
  const query = normalize(text);
  if (!query) return [];
  return items
    .map((item, index) => ({ item, index, score: score(item, query) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((hit) => hit.item);
}

/**
 * Type-ahead search over named places in Arabic, French and English.
 * Forgiving like a map app: accents, Arabic "ال", doubled letters and common Moroccan
 * spellings (ou/u, ch/sh, q/k…) don't matter, words can come in any order, the last word
 * can be half-typed, and a typo or two still finds the place. Nearby places rank first.
 * Self-contained (no imports) so it can be unit-tested with plain Node.
 */

export type PlaceKind =
  | 'city'
  | 'town'
  | 'district'
  | 'street'
  | 'landmark'
  | 'industrial'
  | 'port'
  | 'station'
  | 'mall'
  | 'market'
  | 'hospital'
  | 'university'
  | 'airport';

export type Searchable = {
  id: string;
  kind: PlaceKind;
  name: { ar: string; fr: string; en: string };
  aliases?: readonly string[];
  lat?: number;
  lng?: number;
  population?: number;
};

type Point = { lat: number; lng: number };

/** Same rules as geo.normalize, repeated here to keep this file import-free. */
export function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Spelling-insensitive form of one word: "Maârif" = "maarif" = "mearif"; "المعاريف" = "معاريف". */
function phonetic(word: string) {
  if (/[؀-ۿ]/.test(word)) return word.replace(/^ال(?=..)/, '');
  return word
    .replace(/ou/g, 'u')
    .replace(/(ch|sh)/g, 'x')
    .replace(/(dj|j)/g, 'j')
    .replace(/(kh|q|ck|k)/g, 'k')
    .replace(/c(?=[aou])/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/ph/g, 'f')
    .replace(/[yie]/g, 'i')
    .replace(/w/g, 'u')
    .replace(/ea|ae/g, 'a')
    .replace(/(.)\1+/g, '$1')
    .replace(/h(?=[^aeiouy]|$)/g, '');
}

/** Edit distance, stopping early once it exceeds `max`. */
function distance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    previous = row;
  }
  return previous[b.length];
}

type Prepared = { full: string; words: string[]; keys: string[] }[];
const cache = new WeakMap<Searchable, Prepared>();

function prepare(item: Searchable): Prepared {
  let prepared = cache.get(item);
  if (!prepared) {
    const names = new Set([item.name.ar, item.name.fr, item.name.en, ...(item.aliases ?? [])].map(normalize).filter(Boolean));
    prepared = [...names].map((full) => {
      const words = full.split(' ');
      return { full, words, keys: words.map(phonetic) };
    });
    cache.set(item, prepared);
  }
  return prepared;
}

/** How well one typed word matches one name word (0 = not at all). `last`: may be half-typed. */
function wordScore(token: string, tokenKey: string, word: string, key: string, last: boolean) {
  if (word === token) return 10;
  if (last && word.startsWith(token)) return 8;
  if (key === tokenKey) return 7;
  if (last && tokenKey.length >= 2 && key.startsWith(tokenKey)) return 6;
  if (token.length >= 4) {
    const allowed = token.length >= 7 ? 2 : 1;
    // Compare with the same-length start of the word when the word is still being typed.
    const target = last ? word.slice(0, token.length + 1) : word;
    if (distance(token, target, allowed) <= allowed || distance(token, word.slice(0, token.length), allowed) <= allowed - (last ? 0 : 1)) return 4;
  }
  return 0;
}

const KIND_WEIGHT: Record<PlaceKind, number> = {
  city: 14,
  town: 4,
  district: 8,
  industrial: 7,
  port: 7,
  market: 6,
  station: 6,
  airport: 6,
  mall: 5,
  street: 4,
  landmark: 4,
  hospital: 3,
  university: 3,
};

function km(a: Point, b: Point) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function score(item: Searchable, query: string, tokens: string[], tokenKeys: string[], near?: Point) {
  let best = 0;
  for (const name of prepare(item)) {
    let s = 0;
    if (name.full === query) s = 100;
    else if (name.full.startsWith(query)) s = 90;
    else {
      // Every typed word must match a different word of the name, in any order.
      const used = new Set<number>();
      let total = 0;
      let inOrder = true;
      let lastIndex = -1;
      for (let t = 0; t < tokens.length; t++) {
        let bestWord = -1;
        let bestScore = 0;
        name.words.forEach((word, w) => {
          if (used.has(w)) return;
          const ws = wordScore(tokens[t], tokenKeys[t], word, name.keys[w], t === tokens.length - 1);
          if (ws > bestScore) {
            bestScore = ws;
            bestWord = w;
          }
        });
        if (!bestScore) {
          total = 0;
          break;
        }
        used.add(bestWord);
        if (bestWord < lastIndex) inOrder = false;
        lastIndex = bestWord;
        total += bestScore;
      }
      if (total) s = 40 + (total / tokens.length) * 4 + (inOrder ? 4 : 0) + (used.has(0) ? 4 : 0);
      else if (query.length >= 3 && name.full.includes(query)) s = 30;
    }
    best = Math.max(best, s);
  }
  if (!best) return 0;
  let bonus = KIND_WEIGHT[item.kind];
  if (item.population) bonus += Math.min(6, Math.log10(item.population + 1));
  if (near && item.lat !== undefined && item.lng !== undefined) {
    const d = km(near, { lat: item.lat, lng: item.lng });
    bonus += d < 30 ? 12 - d * 0.3 : d < 150 ? 3 : 0;
  }
  return best + bonus;
}

/**
 * Best matches for what the user typed so far (empty for an empty query).
 * `near`: the user's position or current city, to rank nearby places first.
 */
export function searchPlaces<T extends Searchable>(items: readonly T[], text: string, limit = 20, near?: Point): T[] {
  const query = normalize(text);
  if (!query) return [];
  const tokens = query.split(' ');
  const tokenKeys = tokens.map(phonetic);
  return items
    .map((item, index) => ({ item, index, score: score(item, query, tokens, tokenKeys, near) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((hit) => hit.item);
}

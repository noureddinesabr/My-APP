import { AiError, aiPhotosPerCall, aiSeesPhotos, askAi } from './ai';
import { GOODS, type Goods, type NoteTag } from './choices';
import type { Lang } from './i18n';
import { bestFit, VEHICLES, type VehicleId } from './vehicles';

/** One thing seen in the photo: its name, how many, a typical weight each, and whether the AI is sure. */
export type ScanItem = { id: string; name: string; count: number; kgEach: number; sure: boolean };

/** What the AI saw in the photo(s) of the load. */
export type LoadScan = {
  summary: string;
  goods: Goods[];
  items: ScanItem[];
  vehicle: VehicleId;
  care: NoteTag[];
  helpers: number;
};

const CARE: NoteTag[] = ['fragile', 'heavy', 'cover'];
/** Arabic as people in Morocco say it (the app is for Morocco). */
const MOROCCAN =
  'Use the Arabic used in Morocco, and add the common Moroccan Darija word in brackets when that is what people say, e.g. "أريكة (كنابي)", "خزانة الملابس (ماريو)", "ثلاجة (فريجيدير)", "آلة الغسيل (لافوز)", "مطرح (ماطلة)", "كراتين". Never use words that are not used in Morocco, such as كنبة or دولاب.';
const LANG_NAME: Record<Lang, string> = { en: 'English', fr: 'French', ar: 'Arabic' };
const ids = VEHICLES.map((v) => `"${v.id}" (${v.name}, ${v.carries.toLowerCase()})`).join(', ');
let seq = 0;
export const itemId = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;

function question(lang: Lang, hasPhoto: boolean, current?: LoadScan, frames = 1) {
  const start = current
    ? `A customer in Morocco is listing what they want moved. The list so far:\n${JSON.stringify(current.items.map(({ name, count, kgEach }) => ({ name, count, kgEach })))}\n${hasPhoto ? 'The attached photos show more of the same load, possibly the same things again from other angles. Keep the list so far and add only what is new (never count the same thing twice).' : 'There is no new photo; return the list as it is.'}`
    : `A customer in Morocco wants goods moved by a driver. ${hasPhoto ? (frames > 1 ? `The ${frames} attached photos show the same load from different angles: the same thing can appear in several photos, so count each thing once.` : 'Look at the attached photo of the load.') : 'There is no photo.'}`;
  return `${start}
Take your time and be careful: look at every photo in turn, find every movable thing (also ones partly hidden, at the edges or in the background), judge sizes from things nearby (doors, people, other furniture), then merge everything into one list.
List the things that will be moved (not walls, windows, ceiling lamps, people or ladders that clearly stay). Group identical things with a count; for many boxes give an approximate count.
Reply with only one JSON object and nothing else. Write "summary" and every item "name" in ${LANG_NAME[lang]}, short (1 to 3 words).${lang === 'ar' ? ' ' + MOROCCAN : ''}
{"summary": "2 to 4 words, e.g. Home move or Fridge and sofa",
 "goods": the kinds that apply among ${GOODS.map((g) => `"${g}"`).join(', ')},
 "items": [{"name": "Sofa", "count": 1, "kgEach": typical weight of one in kg, "sure": false if you are not sure it is there or what it is}],
 "vehicle": the best vehicle for everything listed, one of ${ids},
 "care": the ones that apply among "fragile" (glass, screens, plants, ceramics), "heavy" (very heavy pieces), "cover" (furniture or appliances that should be wrapped in blankets so they do not get scratched),
 "helpers": how many helpers besides the driver the heaviest piece needs (0, 1 or 2)}`;
}

function parse(text: string, current?: LoadScan): LoadScan {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiError('unclear', 'No JSON in the answer');
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AiError('unclear', 'The answer was not valid JSON');
  }
  const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const items: ScanItem[] = (Array.isArray(raw.items) ? raw.items : [])
    .map((x) => x as Record<string, unknown>)
    .filter((x) => str(x.name))
    .slice(0, 20)
    .map((x) => ({ id: itemId(), name: str(x.name), count: Math.max(1, Math.min(200, num(x.count) || 1)), kgEach: Math.min(5000, num(x.kgEach)), sure: x.sure !== false }));
  if (!items.length && !current) throw new AiError('unclear', 'Nothing recognised');
  const goods = (Array.isArray(raw.goods) ? raw.goods : []).map(String).filter((g): g is Goods => (GOODS as readonly string[]).includes(g));
  const care = (Array.isArray(raw.care) ? raw.care : []).map(String).filter((g): g is NoteTag => (CARE as string[]).includes(g));
  const total = totalKg(items);
  return {
    summary: str(raw.summary) || current?.summary || '',
    goods: goods.length ? goods : current?.goods ?? [],
    items: items.length ? items : current?.items ?? [],
    vehicle: VEHICLES.some((v) => v.id === raw.vehicle) ? (raw.vehicle as VehicleId) : bestFit(total || 300),
    care,
    helpers: Math.min(2, num(raw.helpers)),
  };
}

/** Reads a photo of the load; with `current`, adds what a further photo shows to the list so far. */
export async function scanLoad(apiKey: string, photos: string[], lang: Lang, current?: LoadScan, onBatch?: (from: number, to: number, total: number) => void): Promise<LoadScan> {
  // Never tell the AI about a photo it can't see.
  if (photos.length && !aiSeesPhotos(apiKey)) throw new AiError('no_images', 'This view cannot send photos to the AI');
  // All photos are read: in one go when they fit, otherwise batch after batch, each adding to the list.
  const per = Math.max(1, aiPhotosPerCall(apiKey));
  let scan = current;
  for (let start = 0; start < Math.max(1, photos.length); start += per) {
    const batch = photos.slice(start, start + per);
    onBatch?.(start + 1, start + batch.length, photos.length);
    const text = await askAi(apiKey, question(lang, batch.length > 0, scan, batch.length), batch, 'complex');
    const next = parse(text, scan);
    scan = scan ? { ...next, care: Array.from(new Set([...scan.care, ...next.care])), helpers: Math.max(scan.helpers, next.helpers) } : next;
  }
  return scan!;
}

export const totalKg = (items: ScanItem[]) => items.reduce((sum, i) => sum + i.count * i.kgEach, 0);

/** A weight range around the estimate (± a quarter), rounded so it reads as a guess. */
export function kgRange(kg: number) {
  const r = (n: number) => (n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);
  return { low: r(kg * 0.75), high: r(kg * 1.25) };
}

/** "300 kg" / "1.5 t", or "300 كغ" / "1.5 طن" in Arabic. */
export const fmtKg = (kg: number, lang: Lang = 'en') => {
  const n = kg >= 1000 ? (kg / 1000).toFixed(kg >= 10000 ? 0 : 1).replace(/\.0$/, '') : String(kg);
  const unit = kg >= 1000 ? (lang === 'ar' ? 'طن' : 't') : lang === 'ar' ? 'كغ' : 'kg';
  return `${n} ${unit}`;
};

/**
 * Smart suggestions while the customer types something to move (needs the AI: the preview's own,
 * or a key on the phone). Returns short names in the app's language with a typical weight.
 */
export async function suggestThings(apiKey: string, text: string, lang: Lang): Promise<{ name: string; kg: number }[]> {
  const q = `A customer in Morocco is typing what they want moved by a small truck or van: "${text.replace(/"/g, "'")}". The text may be in Arabic, Moroccan Darija (Arabic or Latin letters), French or English, possibly misspelled or unfinished.
Suggest up to 5 things they most likely mean, most likely first, each as a short name (1 to 4 words) in ${LANG_NAME[lang]} with a typical weight of one in kg.${lang === 'ar' ? ' ' + MOROCCAN : ''}
Reply with only one JSON object: {"items": [{"name": "...", "kg": 20}]}`;
  const text2 = await askAi(apiKey, q, [], 'quick');
  const start = text2.indexOf('{');
  const end = text2.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  try {
    const raw = JSON.parse(text2.slice(start, end + 1)) as { items?: { name?: unknown; kg?: unknown }[] };
    return (raw.items ?? [])
      .filter((x) => typeof x.name === 'string' && x.name.trim())
      .slice(0, 5)
      .map((x) => ({ name: String(x.name).trim(), kg: Math.max(1, Math.min(5000, Math.round(Number(x.kg) || 20))) }));
  } catch {
    return [];
  }
}

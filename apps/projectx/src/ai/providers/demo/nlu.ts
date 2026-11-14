import type { Lang } from '../../../models/booking';
import { THINGS } from '../../../models/catalog';
import { PLACES, type Gaz } from '../../../models/places';

/**
 * Demo-mode language understanding: rules, not AI. It reads Moroccan Darija (Arabic letters and
 * Arabizi), Modern Standard Arabic, French, English, and messages that mix them.
 */

/** Lowercase, no accents or Arabic diacritics, unified Arabic letters, Western digits. */
export function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ٓ-ٕ]/g, '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ڭ|ݣ/g, 'ك')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[?!؟،,;"“”«»()[\]{}]/g, ' ')
    .replace(/(\D)\.(\D|$)/g, '$1 $2')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const AR = /[؀-ۿ]/g;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isLatin = (w: string) => !/[؀-ۿ]/.test(w);

type Hit = { index: number; end: number; dual?: boolean; prefix?: string };

/** Finds a word in normalised text, allowing Arabic prefixes (و ف ب ل ك د ال) and suffixes. */
export function findWord(t: string, word: string): Hit | null {
  const w = norm(word);
  if (!w) return null;
  if (isLatin(w)) {
    const m = new RegExp(`(^|[^a-z0-9])(${esc(w)})(?=$|[^a-z0-9])`).exec(t);
    return m ? { index: m.index + m[1].length, end: m.index + m[1].length + w.length } : null;
  }
  const base = w.startsWith('ال') && w.length > 4 ? w.slice(2) : w;
  const stem = base.endsWith('ه') ? `(?:${esc(base)}|${esc(base.slice(0, -1))}ت(?=ي|ين|ها|نا|و|ك|كم))` : esc(base);
  const re = new RegExp(`(^|\\s)([وفبلكد]{0,2}(?:ال|ل)?)(${stem})(ين|ات|ي|ها|نا|و|ك|كم)?(?=$|\\s|[^\\u0621-\\u064a])`);
  const m = re.exec(t);
  if (!m) return null;
  const start = m.index + m[1].length;
  return { index: start, end: start + m[2].length + m[3].length + (m[4]?.length ?? 0), dual: m[4] === 'ين', prefix: m[2] };
}
export const hasAny = (t: string, words: string[]) => words.some((w) => !!findWord(t, w));
export const firstHit = (t: string, words: string[]) => {
  let best: Hit | null = null;
  for (const w of words) {
    const h = findWord(t, w);
    if (h && (!best || h.index < best.index)) best = h;
  }
  return best;
};

// ---------------------------------------------------------------- language

const DARIJA = ['بغيت', 'بغينا', 'ديال', 'ديالي', 'ديالنا', 'شي', 'واش', 'فين', 'كيفاش', 'دابا', 'غدا', 'غدوه', 'عافاك', 'واخا', 'مزيان', 'بزاف', 'شحال', 'حتى', 'كاين', 'كاينه', 'ماكاينش', 'خاصني', 'خاص', 'نصيفط', 'نقل', 'هاد', 'هادي', 'هادو', 'جوج', 'زوج', 'صافي', 'والو', 'غير', 'نتا', 'نتي', 'ليا', 'عندي', 'السانسور', 'نوصلو', 'نهزو', 'يعاونو', 'مشي', 'ماشي', 'لا لا', 'اه', 'ايه', 'بلا', 'معايا', 'معاه', 'غادي', 'دغيا', 'كنسكن', 'دارنا', 'الطبقه', 'حوايج', 'تلاجه', 'لهيه'];
const MSA = ['اريد', 'أريد', 'نريد', 'من فضلك', 'هل', 'اين', 'أين', 'كيف', 'الان', 'الآن', 'غدا', 'نعم', 'شكرا', 'ثلاجه', 'نقل', 'هذه', 'هذا', 'التي', 'الذي', 'ارجو', 'يرجى', 'لدي', 'لدينا', 'سوف', 'المصعد', 'الطابق', 'مساعده', 'اود', 'ينبغي', 'ليس', 'لكن', 'ايضا'];
const ARABIZI = ['bghit', 'bghina', 'dyal', 'dial', 'dyali', 'wach', 'fin', 'kifach', 'daba', 'ghda', 'ghedda', 'wakha', 'mzyan', 'bzaf', 'chhal', 'kayn', 'kayna', 'makaynch', 'khasni', 'nsifet', 'n9el', 'nqel', 'had', 'hadi', 'joj', 'zouj', 'safi', 'walou', 'ghir', '3andi', 'm3aya', 'm3ah', 'ghadi', 'ma7tajch', 'chi', 'lyoum', 'lyouma', 'tlaja', 'iyeh', 'mn', 'l', 'w'];
const FR = ['je', 'veux', 'voudrais', 'de', 'des', 'du', 'le', 'la', 'les', 'un', 'une', 'pour', 'avec', 'transporter', 'deplacer', 'demain', 'aujourd', "aujourd'hui", 'oui', 'non', 'merci', 'bonjour', 'et', 'est', 'mon', 'ma', 'mes', 'chez', 'sans', 'besoin', 'vers', 'etage', 'ascenseur', 'frigo', 'canape', 'cartons', 'combien', 'quand', 'ou', 'il', 'y', 'a', 'pas', 'aussi', 'plutot', 'en', 'fait', 'livrer', 'livraison', 'camion', 'environ'];
const EN = ['i', 'need', 'want', 'to', 'from', 'the', 'a', 'my', 'move', 'moving', 'some', 'and', 'is', 'it', 'please', 'tomorrow', 'today', 'yes', 'no', 'thanks', 'with', 'floor', 'elevator', 'help', 'deliver', 'pick', 'up', 'just', 'only', 'how', 'when', 'where', 'there', 'about', 'actually', 'not', 'what', 'truck', 'of', 'at', 'any', 'have', 'will', "i'll", "i'm"];

const count = (t: string, words: string[]) => words.reduce((n, w) => n + (findWord(t, w) ? 1 : 0), 0);

/** Detects the language of one message; `prev` breaks ties (short answers like "ok" keep the language). */
export function detectLang(raw: string, prev: Lang | null): Lang {
  const t = norm(raw);
  const arabicLetters = (raw.match(AR) ?? []).length;
  const latinLetters = (raw.match(/[a-zA-Z]/g) ?? []).length;
  if (arabicLetters + latinLetters < 2) return prev ?? 'en';
  if (arabicLetters > 0 && count(t, DARIJA) >= 2) return 'darija';
  if (arabicLetters > 0 && count(t, MSA) >= 2 && count(t, DARIJA) === 0) return 'ar';
  if (arabicLetters >= latinLetters * 0.6) {
    const d = count(t, DARIJA);
    const m = count(t, MSA);
    if (m > d) return m >= 2 || prev !== 'darija' ? 'ar' : 'darija';
    if (d > m) return 'darija';
    return prev === 'ar' || prev === 'darija' ? prev : 'darija';
  }
  const z = count(t, ARABIZI.filter((w) => w.length > 2));
  const f = count(t, FR);
  const e = count(t, EN);
  if (z >= 2 || (z >= 1 && f + e <= 1)) return 'darija';
  if (f === e) return prev && (prev === 'fr' || prev === 'en') ? prev : f > 0 ? 'fr' : prev ?? 'en';
  return f > e ? 'fr' : 'en';
}

// ---------------------------------------------------------------- numbers

const NUMW: [string[], number][] = [
  [['one', 'un', 'une', 'واحد', 'وحده', 'wahed', 'wa7ed'], 1],
  [['two', 'deux', 'جوج', 'زوج', 'اثنين', 'اثنان', 'joj', 'jouj', 'zouj'], 2],
  [['three', 'trois', 'تلاته', 'ثلاثه', 'ثلاث', 'tlata'], 3],
  [['four', 'quatre', 'ربعه', 'اربعه', 'اربع', 'reb3a'], 4],
  [['five', 'cinq', 'خمسه', 'خمس', 'khamsa'], 5],
  [['six', 'سته', 'ست', 'setta'], 6],
  [['seven', 'sept', 'سبعه', 'sb3a'], 7],
  [['eight', 'huit', 'تمنيه', 'ثمانيه', 'tmnya'], 8],
  [['nine', 'neuf', 'تسعود', 'تسعه'], 9],
  [['ten', 'dix', 'عشره', '3achra'], 10],
  [['twenty', 'vingt', 'عشرين', '3echrin'], 20],
];
const numWord = (w: string) => {
  for (const [ws, n] of NUMW) if (ws.includes(w)) return n;
  return null;
};
/** The number written right before position `i` (digits or a number word), if any. */
function numberBefore(t: string, i: number): number | null {
  const before = t.slice(Math.max(0, i - 24), i).trim().split(' ');
  for (let k = before.length - 1; k >= Math.max(0, before.length - 3); k--) {
    const w = before[k];
    if (/^\d{1,4}$/.test(w)) return Number(w);
    const n = numWord(w);
    if (n) return n;
  }
  return null;
}
const numberAfterX = (t: string, end: number) => {
  const m = /^\s*(?:x|×)\s*(\d{1,3})/.exec(t.slice(end));
  return m ? Number(m[1]) : null;
};
const firstNumber = (t: string) => {
  const m = /(^|[^a-z0-9:])(\d{1,5}(?:[.,]\d+)?)(?![a-z0-9:])/.exec(t);
  if (m) return Number(m[2].replace(',', '.'));
  for (const w of t.split(' ')) {
    const n = numWord(w);
    if (n) return n;
  }
  return null;
};

// ---------------------------------------------------------------- vocabulary

export const YES = ['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'correct', 'right', 'exactly', 'oui', 'ouais', "d'accord", 'daccord', 'exact', 'exactement', 'bien sur', "c'est ca", 'ايه', 'اه', 'نعم', 'واخا', 'صافي', 'مزيان', 'بالضبط', 'صحيح', 'هو هداك', 'هي هاديك', 'اكيد', 'wakha', 'iyeh', 'ah', 'safi', 'yes it is', 'that is all', "that's all", "that's it", 'just that', 'only that', 'c est tout', "c'est tout", 'seulement', 'غير هادي', 'غير هادا', 'هادشي', 'هادشي لي كاين', 'just the', 'only the', 'juste', 'uniquement', 'غير'];
export const NO = ['no', 'nope', 'non', 'لا', 'لالا', 'ماشي', 'كلا', 'la', 'machi', 'mashi', 'pas vraiment'];
const NEG = ['nothing', 'rien', 'not', 'no', "don't", 'dont', 'without', 'pas', 'non', 'sans', 'aucun', 'ماشي', 'لا', 'بلا', 'ما', 'ماكاينش', 'ماكاين', 'مكاينش', 'ليس', 'بدون', 'machi', 'bla', 'makaynch', 'makaynach', 'ma kaynch', 'ni'];
const UNKNOWN = ["don't know", 'dont know', 'no idea', 'not sure', 'estimate', 'you estimate', 'use the estimate', 'je ne sais pas', 'je sais pas', 'aucune idee', 'estimez', 'estimer', 'estimation', 'ما عرفتش', 'ماعرفتش', 'معرفتش', 'ما عارفش', 'لا اعرف', 'لا ادري', 'قدر', 'قدرها', 'دير تقدير', 'التقدير', 'تقدير', 'ma3reftch', 'ma3rftch', 'nta 9der', 'qdar'];
const FROM = ['from', 'de', 'du', 'des', 'depuis', 'من', 'mn', 'men', 'min'];
const TO = ['to', 'towards', 'into', 'a', 'au', 'aux', 'vers', 'jusqu', "jusqu'a", 'pour', 'الى', 'حتى', 'ل', 'l', 'li', 'l\'', 'destination', 'deliver to', 'livrer a'];
const PICKUP_W = ['pickup', 'pick up', 'pick it up', 'collect', 'ramassage', 'recuperer', 'chargement', 'enlevement', 'الاستلام', 'نهزو', 'نجمعو', 'التحميل', 'تحميل', 'نشارجيو', 'منين'];
const DEST_W = ['deliver', 'delivery', 'drop', 'drop off', 'destination', 'livrer', 'livraison', 'التوصيل', 'التسليم', 'نوصلو', 'توصل', 'نوصل', 'فين غادي'];
const CHANGE = ['actually', 'instead', 'change', 'correction', 'sorry', 'i meant', 'en fait', 'plutot', 'finalement', 'pardon', 'corrige', 'changer', 'بدل', 'صراحه', 'سمح ليا', 'عفوا', 'بالعكس', 'نسيت', 'غلطت', 'smh lia', 'b9a'];

// ---------------------------------------------------------------- extraction

export type PlaceHit = { g: Gaz; index: number; end: number; role: 'pickup' | 'destination' | null; negated: boolean };
export type FloorHit = { floor: number; index: number; role: 'pickup' | 'destination' | null };

export type Extraction = {
  items: { key: string; qty: number; qtyGiven: boolean; index: number; end?: number; removed: boolean }[];
  places: PlaceHit[];
  now: boolean;
  date: string | null;
  time: string | null;
  weightKg: number | null;
  dims: string | null;
  fragile: boolean | null;
  cold: boolean | null;
  floors: FloorHit[];
  elevator: boolean | null;
  helpers: number | null;
  loading: boolean | null;
  unloading: boolean | null;
  noHelp: boolean;
  passengers: number | null;
  shared: boolean | null;
  returnTrip: boolean | null;
  yes: boolean;
  no: boolean;
  unknown: boolean;
  change: boolean;
  bothWord: boolean;
  more: boolean;
  only: boolean;
  also: boolean;
  number: number | null;
  nothing: boolean;
  text: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const WEEKDAYS: [string[], number][] = [
  [['sunday', 'dimanche', 'الاحد', 'lhad'], 0],
  [['monday', 'lundi', 'الاثنين', 'الاتنين', 'التنين', 'tnin'], 1],
  [['tuesday', 'mardi', 'الثلاثاء', 'التلات', 'tlat'], 2],
  [['wednesday', 'mercredi', 'الاربعاء', 'لاربع', 'larb3'], 3],
  [['thursday', 'jeudi', 'الخميس', 'lkhmis'], 4],
  [['friday', 'vendredi', 'الجمعه', 'jem3a'], 5],
  [['saturday', 'samedi', 'السبت', 'sebt'], 6],
];

export function extract(raw: string, now = new Date()): Extraction {
  const t = norm(raw);
  const x: Extraction = {
    items: [], places: [], now: false, date: null, time: null, weightKg: null, dims: null, fragile: null, cold: null, floors: [], elevator: null,
    helpers: null, loading: null, unloading: null, noHelp: false, passengers: null, shared: null, returnTrip: null,
    yes: false, no: false, unknown: false, change: false, bothWord: false, more: false, only: false, also: false, number: null, nothing: false, text: raw.trim(),
  };
  const negBefore = (i: number, span = 14) => {
    const win = ` ${t.slice(Math.max(0, i - span), i)} `;
    return NEG.some((n) => findWord(win, n));
  };

  // --- items
  for (const th of THINGS) {
    let hit: Hit | null = null;
    let w0 = '';
    for (const w of th.words) {
      const h = findWord(t, w);
      if (h && (!hit || h.end - h.index > hit.end - hit.index)) {
        hit = h;
        w0 = w;
      }
    }
    if (!hit) continue;
    if (x.items.some((i) => Math.abs(i.index - hit!.index) < 2)) continue;
    const before = numberBefore(t, hit.index);
    const after = numberAfterX(t, hit.end);
    const qty = before ?? after ?? (hit.dual ? 2 : null);
    const removed = /^(?:no|without|sans|pas de|pas le|pas la|بلا|بدون|ماشي|حيد|remove|enleve|retire)$/.test(t.slice(Math.max(0, hit.index - 12), hit.index).trim().split(' ').slice(-2).join(' ')) ||
      ['remove', 'enleve', 'retire', 'sans', 'without', 'بلا', 'حيد', 'بدون'].some((r) => t.slice(Math.max(0, hit!.index - 14), hit!.index).includes(r));
    // "home items" style words should not double count with single items
    x.items.push({ key: th.key, qty: qty ?? 1, qtyGiven: qty != null, index: hit.index, end: hit.end, removed });
    void w0;
  }
  // "washing machine" is one thing, not a washer plus a machine
  x.items = x.items.filter((i) => !x.items.some((o) => o !== i && o.index <= i.index && (o.end ?? 0) >= (i.end ?? 0) && (o.end ?? 0) - o.index > (i.end ?? 0) - i.index));
  // a whole-house move absorbs single furniture words said in the same breath ("حوايج ديال الدار")
  if (x.items.some((i) => i.key === 'home_move')) x.items = x.items.filter((i) => i.key === 'home_move' || i.removed);
  // "goods" is generic: drop it when a concrete thing is named
  if (x.items.length > 1) x.items = x.items.filter((i) => !(['goods', 'meuble', 'appliance'].includes(i.key)) || x.items.length === 1);

  // construction quantities: "20 sacs", "3 tonnes de sable", "1000 briques"
  const bags = /(\d{1,4})\s*(?:sacs?|bags?|شكاير|شكاره|شكارات|اكياس|كيس)/.exec(t);
  if (bags) {
    const c = x.items.find((i) => i.key === 'cement');
    if (c) {
      c.qty = Number(bags[1]);
      c.qtyGiven = true;
    } else x.items.push({ key: 'cement', qty: Number(bags[1]), qtyGiven: true, index: bags.index, removed: false });
  }

  // --- weight and size
  const kg = /(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|kilo|kilos|kilogrammes?|kilograms?|كيلو|كيلوغرام|كلغ|كغ)(?![a-z])/.exec(t);
  const ton = /(\d+(?:[.,]\d+)?)\s*(?:t|tonnes?|tons?|طن|اطنان|طنان|طونيه|tonne)(?![a-z])/.exec(t);
  if (kg) x.weightKg = Math.round(Number(kg[1].replace(',', '.')));
  else if (ton) x.weightKg = Math.round(Number(ton[1].replace(',', '.')) * 1000);
  else if (hasAny(t, ['نص طن', 'demi tonne', 'half a ton', 'half ton'])) x.weightKg = 500;
  else if (/(^|\s)(?:طن|tonne|une tonne|a ton|one ton)(\s|$)/.test(t)) x.weightKg = 1000;
  const dm = /(\d+(?:[.,]\d+)?)\s*(?:x|×|\*)\s*(\d+(?:[.,]\d+)?)(?:\s*(?:x|×|\*)\s*(\d+(?:[.,]\d+)?))?\s*(cm|m|متر|سم)?/.exec(t);
  if (dm) x.dims = `${dm[1]} × ${dm[2]}${dm[3] ? ` × ${dm[3]}` : ''} ${dm[4] ? (dm[4].includes('س') || dm[4] === 'cm' ? 'cm' : 'm') : 'cm'}`;

  // --- care
  const FRAG = ['fragile', 'fragiles', 'delicate', 'careful', 'care', 'with care', 'glass', 'verre', 'precaution', 'avec precaution', 'كتهرس', 'كيتهرس', 'كيتكسر', 'يتكسر', 'هش', 'زجاج', 'الكاس', 'بشويه', 'حساس', 'للكسر', 'قابل للكسر', 'عنايه', 'بعنايه'];
  const fh = firstHit(t, FRAG);
  if (fh) x.fragile = !negBefore(fh.index, 20);
  if (hasAny(t, ['refrigerated', 'cold', 'keep it cold', 'cold chain', 'temperature', 'تبريد', 'تبريده', 'chilled', 'frozen', 'refrigere', 'froid', 'frigorifique', 'temperature controlee', 'مبرد', 'التبريد', 'البرد', 'بارد', 'كاميو فريكو', 'فريكو'])) {
    const h = firstHit(t, ['refrigerated', 'cold', 'temperature', 'chilled', 'refrigere', 'froid', 'frigorifique', 'مبرد', 'التبريد', 'البرد', 'بارد', 'فريكو']);
    x.cold = !negBefore(h?.index ?? 0, 16);
  }

  // --- places
  const hits: PlaceHit[] = [];
  for (const g of PLACES) {
    for (const w of g.words) {
      let from = 0;
      let found = false;
      while (from < t.length) {
        const h = findWord(t.slice(from), w);
        if (!h) break;
        found = true;
        hits.push({ g, index: from + h.index, end: from + h.end, role: null, negated: false });
        const prefix = h.prefix ?? '';
        if (/^(?:[وف]?ل)/.test(prefix) && !/^(?:[وف]?ال)$/.test(prefix)) hits[hits.length - 1].role = 'destination';
        from += h.end;
      }
      if (found) break;
    }
  }
  // longest match wins at the same spot; an area wins over its own city ("Ain Sebaa, Casablanca")
  hits.sort((a, b) => a.index - b.index || b.end - b.index - (a.end - a.index));
  let ph = hits.filter((h, i) => !hits.some((o, j) => j !== i && o.index <= h.index && o.end >= h.end && o.end - o.index > h.end - h.index));
  ph = ph.filter((h) => !(!h.g.area && ph.some((o) => o.g.area && o.g.city === h.g.city && Math.abs(o.index - h.index) < 40)));
  for (const p of ph) {
    const pre = t.slice(Math.max(0, p.index - 30), p.index).trim().split(' ');
    const last = pre[pre.length - 1] ?? '';
    const last2 = pre.slice(-2).join(' ');
    const win = ` ${pre.slice(-6).join(' ')} `;
    if (FROM.includes(last) || hasAny(win, PICKUP_W)) p.role = 'pickup';
    else if (TO.includes(last) || TO.includes(last2) || hasAny(` ${pre.slice(-3).join(' ')} `, DEST_W)) p.role = p.role ?? 'destination';
    p.negated = NEG.includes(last) || NEG.includes(pre[pre.length - 2] ?? '') && (FROM.includes(last) || TO.includes(last));
  }
  x.places = ph;

  // --- schedule
  if (hasAny(t, ['now', 'right now', 'asap', 'urgent', 'immediately', 'today asap', 'maintenant', 'tout de suite', 'immediatement', 'urgence', 'دابا', 'الان', 'حالا', 'دغيا', 'فالحين', 'مستعجل', 'daba', 'drk', 'deghya'])) x.now = true;
  if (hasAny(t, ['after tomorrow', 'day after tomorrow', 'apres demain', 'apres-demain', 'بعد غدا', 'بعد غدوه', 'من بعد غدا'])) x.date = iso(addDays(now, 2));
  else if (hasAny(t, ['tomorrow', 'demain', 'غدا', 'غدوه', 'ghda', 'ghedda', 'ghedwa'])) x.date = iso(addDays(now, 1));
  else if (hasAny(t, ['today', "aujourd'hui", 'aujourdhui', 'aujourd hui', 'ce soir', 'tonight', 'this afternoon', 'cet apres-midi', 'cet apres midi', 'اليوم', 'هاد العشيه', 'lyoum', 'lyouma'])) x.date = iso(now);
  else {
    const toks = t.split(' ');
    for (const [ws, d] of WEEKDAYS) {
      // Arabic weekday names must be whole words ("لا احد" is "nobody", not "Sunday")
      if (ws.some((w) => (isLatin(w) ? !!findWord(t, w) : toks.includes(w) || toks.includes(`ف${w}`) || toks.includes(`نهار${w}`)))) {
        const diff = (d - now.getDay() + 7) % 7 || 7;
        x.date = iso(addDays(now, diff));
        break;
      }
    }
    const dmy = /(?:^|\s)(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?=\s|$)/.exec(t);
    if (dmy) {
      const d = new Date(now.getFullYear(), Number(dmy[2]) - 1, Number(dmy[1]));
      if (d < addDays(now, -1)) d.setFullYear(d.getFullYear() + 1);
      x.date = iso(d);
    }
  }
  const tm =
    /(?:^|\s)(\d{1,2})\s*(?:h(?![a-z])|:)\s*(\d{2})?(?![0-9])/.exec(t) ??
    /(?:^|\s)(?:at|a|vers|مع|الساعه|ساعه|m3a|f)\s*(\d{1,2})()(?:\s|$)/.exec(t) ??
    /(?:^|\s)(\d{1,2})()\s*(?:am|pm|o'?clock|du matin|de l'apres-midi|du soir|د\s*الصباح|ديال الصباح|الصباح|صباحا|د\s*العشيه|ديال العشيه|العشيه|مساء|ديال الليل|الليل)/.exec(t);
  if (tm) {
    let h = Number(tm[1]);
    const after = t.slice(tm.index, tm.index + 40);
    if (/pm|apres-midi|apres midi|soir|العشيه|مساء|الليل|lil/.test(after) && h < 12) h += 12;
    else if (!/am|matin|الصباح|صباح/.test(after) && h >= 1 && h <= 6) h += 12; // "at 3" means 15:00 for a move
    if (h <= 23) x.time = `${pad(h)}:${tm[2] ? tm[2] : '00'}`;
  } else if (hasAny(t, ['morning', 'matin', 'matinee', 'الصباح', 'صباح', 'صباحا', 'فالصباح', 'sbah'])) x.time = '09:00';
  else if (hasAny(t, ['afternoon', 'apres-midi', 'apres midi', 'العشيه', 'بعد الزوال', 'بعد الظهر', 'الظهر', 'l3chiya'])) x.time = '15:00';
  else if (hasAny(t, ['evening', 'soir', 'soiree', 'الليل', 'فالليل', 'mesa'])) x.time = '19:00';
  if (x.time && !x.date && !x.now) x.date = null;

  // --- floors and elevator
  const ordinals: [string[], number][] = [
    [['ground floor', 'ground', 'rez-de-chaussee', 'rez de chaussee', 'rdc', 'الارضي', 'السفلي', 'لتحت', 'الطابق الارضي', 'فالارض', 'ارضي'], 0],
    [['first', '1st', 'premier', '1er', 'الاول', 'اللول', 'لول'], 1],
    [['second', '2nd', 'deuxieme', '2eme', '2e', 'الثاني', 'التاني', 'تاني'], 2],
    [['third', '3rd', 'troisieme', '3eme', '3e', 'الثالث', 'التالت', 'تالت'], 3],
    [['fourth', '4th', 'quatrieme', '4eme', 'الرابع', 'رابع'], 4],
    [['fifth', '5th', 'cinquieme', '5eme', 'الخامس', 'خامس'], 5],
  ];
  const FLOOR_W = ['floor', 'etage', 'etages', 'الطابق', 'طابق', 'الطبقه', 'طبقه', 'eme etage', 'niveau', 'السطاج', 'لاطاج', 'tabaq', 'etaj'];
  const floorRe = /(\d{1,2})\s*(?:st|nd|rd|th|er|eme|e)?\s*(?:floor|etage)|(?:etage|floor|الطابق|طابق|الطبقه|طبقه|لاطاج|الاطاج)\s*(?:n°|no|رقم)?\s*(\d{1,2})|(?:^|\s)(\d{1,2})(?:st|nd|rd|th|er|eme|e)(?=\s|$)/g;
  let fm: RegExpExecArray | null;
  while ((fm = floorRe.exec(t))) x.floors.push({ floor: Number(fm[1] ?? fm[2] ?? fm[3]), index: fm.index, role: null });
  if (!x.floors.length) {
    for (const [ws, n] of ordinals) {
      const h = firstHit(t, ws);
      if (h && (n === 0 || hasAny(t, FLOOR_W))) x.floors.push({ floor: n, index: h.index, role: null });
    }
  }
  x.floors.sort((a, b) => a.index - b.index);
  for (const f of x.floors) {
    const win = ` ${t.slice(Math.max(0, f.index - 40), f.index + 40)} `;
    const p = firstHit(win, [...PICKUP_W, 'here', 'ici', 'chez moi', 'my place', 'my apartment', 'عندي', 'هنا', 'دارنا', 'الدار ديالي', 'كنسكن']);
    const d = firstHit(win, [...DEST_W, 'there', 'la-bas', 'la bas', 'arrivee', 'لهيه', 'تما', 'الهيه', 'فين غادي']);
    if (p && !d) f.role = 'pickup';
    else if (d && !p) f.role = 'destination';
  }
  const elevHit = firstHit(t, ['elevator', 'lift', 'ascenseur', 'ascenceur', 'مصعد', 'المصعد', 'سانسور', 'السانسور', 'لاسانسور', 'asanser', 'ascensor', 'sansour']);
  if (elevHit) {
    const pre = ` ${t.slice(Math.max(0, elevHit.index - 16), elevHit.index)} `;
    x.elevator = !(NEG.some((n) => findWord(pre, n)) || /pas d|sans|no |without|ماكاين|مكاين|ما كاين|بلا|makayn|ماعندناش|ما عندناش|ماكايناش/.test(pre));
  }

  // --- help
  const loadW = ['loading', 'load it', 'chargement', 'charger', 'التحميل', 'نحملو', 'تحميل', 'يحملو', 'الشحن', 'nchargiw'];
  const unloadW = ['unloading', 'unload', 'dechargement', 'decharger', 'التفريغ', 'تفريغ', 'نهبطو', 'يهبطو', 'نفرغو', 'نخويو', 'الهباط'];
  const HELP = ['help', 'helpers', 'helper', 'movers', 'porters', 'aide', 'aider', 'porteurs', 'manutentionnaires', 'manutention', 'demenageurs', 'مساعده', 'مساعدين', 'يعاونو', 'يعاوني', 'عاون', 'خدامه', 'عمال', 'حمالين', 'حماله', 'رجال', 'معاونين', 'nass y3awnou', 'y3awni'];
  const helpN = /(\d{1,2})\s*(?:helpers?|movers?|porters?|people to help|porteurs?|personnes pour|manutentionnaires?|demenageurs?|مساعدين|خدامه|عمال|حمالين|رجال|معاونين|ديال الخدامه)/.exec(t);
  const helpWord = (() => {
    for (const w of ['مساعدين', 'خدامه', 'عمال', 'حمالين', 'رجال', 'helpers', 'movers', 'porteurs', 'personnes', 'معاونين']) {
      const h = findWord(t, w);
      if (h) {
        const n = numberBefore(t, h.index);
        if (n) return n;
      }
    }
    return null;
  })();
  const noHelp = hasAny(t, ['no help', 'no helpers', "don't need help", 'dont need help', 'without help', "i'll load", 'we will load', 'we load', 'myself', 'ourselves', 'pas besoin d aide', "pas besoin d'aide", 'pas d aide', "pas d'aide", 'sans aide', 'moi-meme', 'nous-memes', 'nous memes', 'ما محتاجش', 'مامحتاجش', 'بلا مساعده', 'بلا خدامه', 'بلا ما يعاونو', 'غادي نحملو', 'حنا نحملو', 'انا نحمل', 'ma7tajch', 'bla mosa3ada', 'لا احتاج', 'بدون مساعده']);
  if (noHelp) {
    x.noHelp = true;
    x.loading = false;
    x.unloading = false;
    x.helpers = 0;
  }
  if (helpN || helpWord) x.helpers = Number(helpN?.[1] ?? helpWord);
  x.bothWord = hasAny(t, ['both', 'both are fine', 'les deux', 'tous les deux', 'بجوج', 'بزوج', 'كلاهما', 'الاثنين', 'bjoj']);
  const both = hasAny(t, ['loading and unloading', 'load and unload', 'chargement et dechargement', 'charger et decharger', 'التحميل والتفريغ', 'تحميل وتفريغ', 'both ways']) || (x.bothWord && (hasAny(t, loadW) || hasAny(t, HELP)));
  if (!noHelp) {
    if (both) {
      x.loading = true;
      x.unloading = true;
    } else {
      const only = hasAny(t, ['only', 'just', 'seulement', 'uniquement', 'غير', 'فقط', 'ghir']);
      if (hasAny(t, loadW)) {
        x.loading = !negBefore(firstHit(t, loadW)!.index, 10);
        if (only && x.loading) x.unloading = false;
      }
      if (hasAny(t, unloadW)) {
        x.unloading = !negBefore(firstHit(t, unloadW)!.index, 10);
        if (only && x.unloading && x.loading == null) x.loading = false;
      }
      if (x.loading == null && x.unloading == null && hasAny(t, HELP) && !negBefore(firstHit(t, HELP)!.index, 12)) {
        x.loading = true;
        x.unloading = true;
      }
      if (x.helpers && x.loading == null && x.unloading == null) {
        x.loading = true;
        x.unloading = true;
      }
    }
  }

  // --- people riding along
  const pax = /(\d)\s*(?:passengers?|people|persons?|personnes|اشخاص|أشخاص|ناس|نفار|عباد)/.exec(t);
  if (pax && !helpN) x.passengers = Number(pax[1]);
  else if (hasAny(t, ["i'll ride", 'i will ride', 'ride along', "i'll come", 'i will come', 'come with', 'go with', 'with the driver', 'accompany', 'je viens', 'je vais venir', 'accompagner', 'avec le chauffeur', 'je monte', 'غادي نمشي معاه', 'نمشي معاه', 'نركب معاه', 'غادي نركب', 'نركب', 'معاكم', 'معا الشيفور', 'مع الشيفور', 'سارافقه', 'ساركب', 'gha nmchi m3ah', 'nrkeb'])) x.passengers = 1;
  else if (hasAny(t, ['nobody', 'no one', 'noone', 'personne', 'حتى واحد', 'حتى حد', 'لا احد', 'walou', 'والو'])) x.passengers = 0;

  // --- savings options
  if (hasAny(t, ['shared', 'share', 'sharing', 'groupage', 'partage', 'partager', 'mutualise', 'مشترك', 'مشتركه', 'نتشاركو', 'تشارك', 'mchtarek'])) {
    const h = firstHit(t, ['shared', 'share', 'sharing', 'groupage', 'partage', 'partager', 'مشترك', 'مشتركه', 'نتشاركو', 'تشارك']);
    x.shared = !negBefore(h!.index, 12);
  }
  if (hasAny(t, ['return trip', 'return', 'way back', 'retour', 'trajet retour', 'رجوع', 'الرجوع', 'راجع', 'الرجعه', 'العوده', 'عوده', 'rjou3'])) {
    const h = firstHit(t, ['return', 'retour', 'رجوع', 'الرجوع', 'راجع', 'الرجعه', 'العوده', 'عوده']);
    x.returnTrip = !negBefore(h!.index, 12);
  }
  if (hasAny(t, ['neither', 'none of them', 'aucun des deux', 'ni l un ni l autre', 'حتى واحد فيهم', 'لا هادي لا هادي', 'لا هذا ولا ذاك', 'private only', 'just for me', 'rien que pour moi'])) {
    x.shared = false;
    x.returnTrip = false;
  }

  // --- short answers
  const words = t.split(' ');
  x.yes = hasAny(t, YES) && !hasAny(t, ['no', 'non', 'لا', 'ماشي']) ;
  x.no = (NO.includes(words[0]) || (words.length <= 3 && hasAny(t, NO))) && !x.yes;
  if (words[0] === 'no' || words[0] === 'non' || words[0] === 'لا' || words[0] === 'لالا') {
    x.no = true;
    x.yes = false;
  }
  x.unknown = hasAny(t, UNKNOWN);
  x.more = hasAny(t, ['more', 'other things', 'something else', 'autre chose', 'autres', 'il y a autre', 'خرين', 'اخرين', 'اخرى', 'حتى حوايج', 'أشياء أخرى', 'اشياء اخرى']);
  x.change = hasAny(t, CHANGE) || (x.no && t.split(' ').length > 2);
  x.only = hasAny(t, ['only', 'just', 'seulement', 'uniquement', 'juste', 'غير', 'فقط', 'ghir', 'that is all', "that's all", "c'est tout", 'c est tout', 'هادشي']);
  x.also = hasAny(t, ['also', 'and also', 'plus', 'as well', 'too', 'aussi', 'en plus', 'avec', 'حتى', 'و زيد', 'زيد', 'كذلك', 'ايضا', 'تاني', 'hta', 'zid']);
  x.number = firstNumber(t);
  x.nothing = hasAny(t, ['nothing', 'nothing else', 'no thanks', 'all good', 'rien', 'rien d autre', "rien d'autre", 'ca va', 'non merci', 'والو', 'لا شي', 'لا والو', 'ماكاين والو', 'صافي', 'لا شيء', 'walou', 'safi']);
  return x;
}

import { bestVehicle, fairPrice, THINGS, type Item, type VehicleId } from './data';
import { norm, PLACES, placeById, placesIn, routeOf, type L3 } from './places';
import { askJson, canThink } from './claude';

/**
 * The assistant's brain: it reads what the person writes or says (Darija, Arabic, French, English, mixed),
 * fills the request (what, from, to, when, helpers), and asks for ONE missing thing at a time with a card
 * to tap. With Claude available (claude.ai page) Claude understands and answers; otherwise a built-in
 * understanding does it, and the screen says so.
 */

export type Talk = 'darija' | 'fr' | 'en';
export type When = { kind: 'now' } | { kind: 'today' | 'tomorrow'; time: string };
export type Slots = { items: Item[]; from?: string; to?: string; when?: When; helpers?: number; notes: string };
export type CardKind = 'items' | 'from' | 'to' | 'when' | 'helpers' | 'summary';
export type Turn = { reply: string; card?: CardKind; quick?: string[]; patch: Partial<Slots>; by: 'claude' | 'builtin' };

export const emptySlots = (): Slots => ({ items: [], notes: '' });
export const kgOf = (s: { items: Item[] }) => s.items.reduce((n, i) => n + i.qty * i.kg, 0);
export const uid = () => Math.random().toString(36).slice(2, 9);

/** Which language the person speaks, from what they typed (Arabic letters → Darija). */
export function talkOf(text: string, fallback: Talk): Talk {
  if (/[؀-ۿ]/.test(text)) return 'darija';
  const t = norm(text);
  if (/\b(je|veux|bonjour|salut|demain|aujourd|maison|pour|des|les|une|vers|depuis|merci|oui|non)\b/.test(t)) return 'fr';
  if (/\b(i|want|hello|hi|tomorrow|today|move|from|to|the|please|yes|no|need)\b/.test(t)) return 'en';
  if (/\b(salam|bghit|n9el|ghda|lyoum|wach|safi|dyal)\b/.test(t)) return 'darija';
  return fallback;
}
export const say = (talk: Talk, v: { da: string; fr: string; en: string }) => (talk === 'darija' ? v.da : talk === 'fr' ? v.fr : v.en);

export function quote(s: Slots) {
  const kg = kgOf(s);
  const vehicle: VehicleId = bestVehicle(kg);
  const r = s.from && s.to ? routeOf(placeById(s.from), placeById(s.to)) : { km: 0, min: 0 };
  return { kg, vehicle, ...r, fair: fairPrice(vehicle, r.km, s.helpers ?? 0) };
}

/** The next thing still missing, in a natural order. */
export function nextNeed(s: Slots): CardKind {
  if (!s.items.length) return 'items';
  if (!s.from) return 'from';
  if (!s.to) return 'to';
  if (!s.when) return 'when';
  if (s.helpers === undefined) return 'helpers';
  return 'summary';
}

export function question(need: CardKind, talk: Talk): { text: string; quick?: string[] } {
  switch (need) {
    case 'items':
      return { text: say(talk, { da: 'شنو بغيتي تنقل؟ صوّر الحوايج بالكاميرا اللي حدا الميكرو، ولا كتبهم ليا.', fr: 'Que voulez-vous transporter ? Prenez une photo avec le bouton caméra à côté du micro, ou écrivez-le.', en: 'What do you want to move? Take a photo with the camera button next to the mic, or type it.' }), quick: say(talk, { da: 'صالون وتلاجة|حوايج ديال الدار كاملة|كراطن ديال السلعة', fr: 'Un canapé et un frigo|Tout un déménagement|Des cartons de marchandise', en: 'A sofa and a fridge|A full house move|Boxes of shop goods' }).split('|') };
    case 'from':
      return { text: say(talk, { da: 'منين غادي ياخد الشيفور الحوايج؟', fr: 'Où le chauffeur doit-il récupérer les affaires ?', en: 'Where should the driver pick everything up?' }) };
    case 'to':
      return { text: say(talk, { da: 'وفين غادي يوصّلهم؟', fr: 'Et où faut-il les livrer ?', en: 'And where should it go?' }) };
    case 'when':
      return { text: say(talk, { da: 'إمتى بغيتيها؟', fr: 'Pour quand ?', en: 'When do you need it?' }) };
    case 'helpers':
      return { text: say(talk, { da: 'واش خاصك شي واحد يعاون فالتحميل والتفريغ؟', fr: 'Avez-vous besoin d’aides pour charger et décharger ?', en: 'Do you need helpers to load and unload?' }) };
    case 'summary':
      return { text: say(talk, { da: 'هاهو الطلب ديالك. شوف واش كلشي صحيح، وصيفطو للشيفورات باش يعطيوك العروض.', fr: 'Voici votre demande. Vérifiez, puis envoyez-la aux chauffeurs pour recevoir des offres.', en: 'Here is your request. Check it, then send it to drivers to get offers.' }) };
  }
}

// ---------------- Built-in understanding ----------------
const NUMS: [string[], number][] = [[['واحد', 'وحدة', 'un', 'une', 'one'], 1], [['جوج', 'زوج', 'two', 'deux', 'اثنين', 'زوجة'], 2], [['تلاتة', 'ثلاثة', 'three', 'trois'], 3], [['ربعة', 'أربعة', 'اربعة', 'four', 'quatre'], 4], [['خمسة', 'five', 'cinq'], 5]];
function qtyBefore(t: string, at: number) {
  const before = t.slice(Math.max(0, at - 14), at).trim().split(' ').slice(-2);
  for (const w of before.reverse()) {
    if (/^\d+$/.test(w)) return Math.min(50, Number(w));
    for (const [ws, n] of NUMS) if (ws.some((x) => norm(x) === w)) return n;
  }
  return 1;
}
export function thingsIn(text: string): Item[] {
  const t = ` ${norm(text)} `;
  const out: Item[] = [];
  for (const th of THINGS) {
    for (const w of th.words) {
      const nw = norm(w);
      const latin = /^[a-z ]+$/.test(nw);
      const i = latin ? t.search(new RegExp(`[^a-z]${nw}s?[^a-z]`)) : t.indexOf(nw);
      if (i >= 0) {
        out.push({ id: uid(), name: th.name, qty: qtyBefore(t, i), kg: th.kg, conf: 'high' });
        break;
      }
    }
  }
  return out;
}
function whenIn(text: string): When | undefined {
  const t = norm(text);
  // A time needs a clear sign ("10h", "14:30", "مع 10", "at 9", "10 الصباح"), so "3 boxes" is never 3 o'clock.
  const m = t.match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/) ?? t.match(/(?:مع|الساعة|ساعة|at|a|vers)\s*(\d{1,2})()/) ?? t.match(/(\d{1,2})()\s*(?:د\s*|ديال\s*)?(?:الصباح|صباح|العشية|عشية|الليل|du matin|du soir|am|pm|o'?clock)/);
  let hour = m ? Number(m[1]) : null;
  if (hour !== null && /(عشية|العشية|بعد الزوال|soir|apres-midi|afternoon|evening|pm|ليل)/.test(t) && hour < 12) hour += 12;
  const time = hour !== null && hour <= 23 ? `${String(hour).padStart(2, '0')}:${m?.[2] || '00'}` : '10:00';
  if (/(دابا|daba|now|maintenant|tout de suite|ف الحين|فالحين|دغيا|urgent)/.test(t)) return { kind: 'now' };
  if (/(غدا|غدوة|ghda|demain|tomorrow)/.test(t)) return { kind: 'tomorrow', time };
  if (/(اليوم|lyoum|today|aujourd)/.test(t)) return { kind: 'today', time };
  return undefined;
}
function helpersIn(text: string): number | undefined {
  const t = norm(text);
  if (/(بلا مساعد|بلا عتال|ما خاصنيش|ماخاصنيش|غير الشيفور|no helper|sans aide|pas besoin|انا غادي نعاون|non merci|no thanks)/.test(t)) return 0;
  const m = t.match(/(\d)\s*(?:ديال)?\s*(?:مساعد|عتال|حمال|خدام|helpers?|aides?|personnes?)/);
  if (m) return Number(m[1]);
  for (const [ws, n] of NUMS) if (ws.some((w) => new RegExp(`${norm(w)}\\s*(?:ديال)?\\s*(?:مساعد|عتال|حمال|helpers?|aides?)`).test(t))) return n;
  if (/(مساعد|عتال|حمال|helper|aide|يعاوني|يعاون)/.test(t)) return 1;
  return undefined;
}

/** Built-in understanding: picks the places, things, time and helpers out of one message. */
export function understand(text: string, s: Slots): Partial<Slots> {
  const patch: Partial<Slots> = {};
  const found = thingsIn(text);
  if (found.length) patch.items = [...s.items, ...found];
  const t = ` ${norm(text)} `;
  const places = placesIn(text);
  const fromWords = /(من|منين|from|de|depuis|du)\s*$/;
  const toWords = /(ل|لـ|الى|إلى|حتى|to|a|à|vers|pour|jusqu)\s*$/;
  let from: string | undefined, to: string | undefined;
  for (const { place, at } of places) {
    const before = t.slice(Math.max(0, at - 9), at + 1);
    const glued = t.slice(at + 1, at + 2);
    if (fromWords.test(before)) from ??= place.id;
    else if (toWords.test(before) || glued === 'ل') to ??= place.id;
    else if (!from && !s.from) from = place.id;
    else to ??= place.id;
  }
  if (from) patch.from = from;
  if (to && to !== (from ?? s.from)) patch.to = to;
  const w = whenIn(text);
  if (w) patch.when = w;
  const h = helpersIn(text);
  if (h !== undefined) patch.helpers = h;
  return patch;
}

export function heardLine(patch: Partial<Slots>, talk: Talk) {
  const bits: string[] = [];
  const p = (l: L3) => (talk === 'en' ? l[0] : talk === 'fr' ? l[1] : l[2]);
  if (patch.items?.length) bits.push(patch.items.map((i) => `${i.qty > 1 ? i.qty + ' ' : ''}${p(i.name)}`).join(talk === 'darija' ? ' و' : ', '));
  if (patch.from) bits.push(say(talk, { da: `من ${p(placeById(patch.from).name)}`, fr: `depuis ${p(placeById(patch.from).name)}`, en: `from ${p(placeById(patch.from).name)}` }));
  if (patch.to) bits.push(say(talk, { da: `لـ ${p(placeById(patch.to).name)}`, fr: `vers ${p(placeById(patch.to).name)}`, en: `to ${p(placeById(patch.to).name)}` }));
  if (patch.when) bits.push(whenText(patch.when, talk));
  if (patch.helpers !== undefined) bits.push(patch.helpers ? say(talk, { da: `${patch.helpers} مساعد`, fr: `${patch.helpers} aide(s)`, en: `${patch.helpers} helper(s)` }) : say(talk, { da: 'بلا مساعدين', fr: 'sans aide', en: 'no helpers' }));
  if (!bits.length) return '';
  return say(talk, { da: `مزيان، فهمت: ${bits.join('، ')}.`, fr: `Très bien, j’ai noté : ${bits.join(', ')}.`, en: `Great, got it: ${bits.join(', ')}.` });
}
export function whenText(w: When, talk: Talk) {
  if (w.kind === 'now') return say(talk, { da: 'دابا', fr: 'maintenant', en: 'now' });
  return w.kind === 'today' ? say(talk, { da: `اليوم ${w.time}`, fr: `aujourd’hui ${w.time}`, en: `today ${w.time}` }) : say(talk, { da: `غدا ${w.time}`, fr: `demain ${w.time}`, en: `tomorrow ${w.time}` });
}

function builtinTurn(text: string, s: Slots, talk: Talk): Turn {
  const patch = understand(text, s);
  const merged = { ...s, ...patch };
  const need = nextNeed(merged);
  const heard = heardLine(patch, talk);
  const q = question(need, talk);
  if (!heard && need === nextNeed(s) && text.trim().length > 2) {
    const sorry = say(talk, { da: 'سمح ليا، ما فهمتش مزيان.', fr: 'Pardon, je n’ai pas bien compris.', en: 'Sorry, I didn’t quite get that.' });
    return { reply: `${sorry} ${q.text}`, card: need, quick: q.quick, patch, by: 'builtin' };
  }
  return { reply: [heard, q.text].filter(Boolean).join(' '), card: need, quick: q.quick, patch, by: 'builtin' };
}

// ---------------- Claude ----------------
const placeList = PLACES.map((p) => `${p.id}: ${p.name[0]} / ${p.name[2]}`).join('\n');
const thingList = THINGS.map((t) => `${t.name[0]} (${t.kg} kg)`).join(', ');
type AiOut = { reply: string; items?: { en: string; fr: string; ar: string; qty: number; kg: number }[]; from?: string | null; to?: string | null; when?: { kind: 'now' | 'today' | 'tomorrow'; time?: string } | null; helpers?: number | null; notes?: string | null };

async function claudeTurn(history: { from: 'user' | 'ai'; text: string }[], s: Slots, talk: Talk): Promise<Turn | null> {
  const state = JSON.stringify({ items: s.items.map((i) => `${i.qty} × ${i.name[0]}`), from: s.from ?? null, to: s.to ?? null, when: s.when ?? null, helpers: s.helpers ?? null });
  const convo = history.slice(-12).map((m) => `${m.from === 'user' ? 'Customer' : 'Xapp'}: ${m.text}`).join('\n');
  const prompt = `You are Xapp, a friendly Moroccan assistant that arranges goods transport inside Morocco (furniture, appliances, boxes, building materials, shop goods). You only help with transport; politely steer anything else back.
Reply in the customer's own language and style: Moroccan Darija in Arabic letters when they write Darija or Arabic, French if French, English if English. Keep replies to one or two short, warm sentences. Never invent or promise a price: drivers make offers.
Gather, one question at a time, in this order: what to move → pickup place → destination → when → helpers (people to load/unload). The app shows a tappable card for the question, so ask briefly.
Known place ids (use only these; pick the closest neighbourhood or city):
${placeList}
Typical items: ${thingList}.
Current request: ${state}
Conversation:
${convo}
Return JSON: {"reply": string, "items": [{"en","fr","ar","qty","kg"}] (only NEW items from the last message, honest kg per piece), "from": place id or null, "to": place id or null, "when": {"kind":"now"|"today"|"tomorrow","time":"HH:MM"} or null, "helpers": number or null, "notes": string or null (access details like floor, lift, fragile)}. Only fill fields the customer actually said in the last message.`;
  const out = (await askJson(prompt)) as AiOut | null;
  if (!out || typeof out.reply !== 'string') return null;
  const patch: Partial<Slots> = {};
  if (Array.isArray(out.items) && out.items.length) patch.items = [...s.items, ...out.items.slice(0, 10).map((i) => ({ id: uid(), name: [i.en, i.fr, i.ar] as L3, qty: Math.max(1, Math.round(i.qty || 1)), kg: Math.max(1, Math.round(i.kg || 10)), conf: 'high' as const }))];
  if (out.from && PLACES.some((p) => p.id === out.from)) patch.from = out.from;
  if (out.to && PLACES.some((p) => p.id === out.to) && out.to !== (patch.from ?? s.from)) patch.to = out.to;
  if (out.when?.kind) patch.when = out.when.kind === 'now' ? { kind: 'now' } : { kind: out.when.kind, time: out.when.time ?? '10:00' };
  if (typeof out.helpers === 'number') patch.helpers = Math.max(0, Math.min(6, Math.round(out.helpers)));
  if (out.notes) patch.notes = [s.notes, out.notes].filter(Boolean).join(' · ');
  const need = nextNeed({ ...s, ...patch });
  const q = question(need, talk);
  return { reply: out.reply, card: need, quick: need === 'items' ? q.quick : undefined, patch, by: 'claude' };
}

/** One turn of the conversation: Claude when the page allows it, the built-in understanding otherwise. */
export async function turn(text: string, history: { from: 'user' | 'ai'; text: string }[], s: Slots, talk: Talk): Promise<Turn> {
  if (canThink()) {
    try {
      const r = await claudeTurn(history, s, talk);
      if (r) return r;
    } catch {
      // fall back below
    }
  }
  return builtinTurn(text, s, talk);
}

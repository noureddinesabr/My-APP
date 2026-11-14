import { emptyStop, isReady, type Booking, type Lang, type Stop } from '../../../models/booking';
import { categoryOf, estimateKg, itemLabel, thingByKey, typicalRange, VEHICLES, suggestVehicle } from '../../../models/catalog';
import { placeName, toPlace } from '../../../models/places';
import type { AIProvider, AssistantRequest, AssistantResponse, ChatImage } from '../../types';
import { detectLang, extract, firstHit, hasAny, norm, type Extraction, type PlaceHit } from './nlu';
import { CHIPS, list, PH, say, type P } from './phrases';

/**
 * DEMO MODE brain. A rule-based simulation of the transport assistant so the full journey can be
 * tested without an AI key. It is labelled "Demo" everywhere in the UI and never claims to be AI.
 */

/** What the two sample photos show (the demo can't look at real photos). */
export const SAMPLE_SCANS: Record<string, { key: string; qty: number }[]> = {
  room: [
    { key: 'sofa', qty: 1 },
    { key: 'boxes', qty: 7 },
    { key: 'table', qty: 1 },
  ],
  movers: [{ key: 'boxes', qty: 4 }],
};

const FEM_FR = new Set(['table', 'chair', 'washer', 'cooker', 'tv', 'freezer']);
export function itemsText(items: { key: string; qty: number; label?: string }[], lang: Lang) {
  return list(
    lang,
    items.map((i) => {
      const l = itemLabel(i.key, lang, i.label);
      if (i.qty > 1) return `${i.qty} ${l}`;
      if (lang === 'en') return `${/^[aeiou]/i.test(l) ? 'an' : 'a'} ${l}`;
      if (lang === 'fr') return `${FEM_FR.has(i.key) ? 'une' : 'un'} ${l}`;
      return l;
    }),
  );
}
const theIt = (b: Booking, lang: Lang) => {
  const it = b.cargo.items;
  if (it.length === 1 && it[0].qty === 1) {
    const l = itemLabel(it[0].key, lang, it[0].label);
    if (lang === 'en') return `the ${l}`;
    if (lang === 'fr') return /^[aeiouéh]/i.test(l) ? `de l’${l}` : FEM_FR.has(it[0].key) ? `de la ${l}` : `du ${l}`;
    return l.includes(' ') ? l : `ال${l}`;
  }
  return lang === 'en' ? 'everything' : lang === 'fr' ? 'de l’ensemble' : lang === 'ar' ? 'الكل' : 'كلشي';
};
const dayName = (iso: string, lang: Lang, now: Date) => {
  const d = new Date(`${iso}T12:00:00`);
  const t = new Date(now);
  t.setHours(12, 0, 0, 0);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return say(lang, PH.today);
  if (diff === 1) return say(lang, PH.tomorrow);
  const loc = lang === 'en' ? 'en-GB' : lang === 'fr' ? 'fr-FR' : 'ar-MA';
  return d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
};
export const whenText = (b: Booking, lang: Lang, now: Date) => {
  if (b.schedule.mode === 'now') return say(lang, PH.nowLabel);
  if (!b.schedule.date) return '';
  return `${dayName(b.schedule.date, lang, now)}${b.schedule.time ? ` ${b.schedule.time}` : ''}`;
};

const asked = (b: Booking, k: string) => b.meta.asked.includes(k);
const BULKY = new Set(['furniture', 'appliance', 'home_move']);
const helpNeeded = (b: Booking) => !!(b.assistance.loading || b.assistance.unloading);
const weightOf = (b: Booking) => b.cargo.estimated_weight_kg ?? estimateKg(b.cargo.items);

type Q = { key: string; text: string; chips: string[] };

/** The next most useful question, or null when the request is complete. */
export function nextQuestion(b: Booking, lang: Lang, now: Date, flags: { samePlace?: boolean; oddWeight?: string; stairs?: string }): Q | null {
  const c = (k: string) => CHIPS[k][lang];
  const many = b.cargo.items.reduce((n, i) => n + i.qty, 0) > 1;
  if (!b.cargo.items.length && !b.cargo.description) return { key: 'cargo', text: say(lang, PH.askCargo), chips: c('cargo') };
  if (b.cargo.items.length && !b.cargo.items_confirmed && !asked(b, 'items_confirmed') && b.cargo.category !== 'home_move' && b.cargo.category !== 'construction')
    return { key: 'items_confirmed', text: say(lang, many || b.cargo.items.length > 1 ? PH.onlyThese : PH.onlyThis), chips: c('confirm') };
  if (!b.pickup) return { key: 'pickup', text: say(lang, many ? PH.askPickupMany : PH.askPickup), chips: c('city') };
  if (!b.destination) return { key: 'destination', text: say(lang, many ? PH.askDestMany : PH.askDest), chips: c('city') };
  if (flags.samePlace) return { key: 'same_place', text: say(lang, PH.samePlace, { p: placeName(b.pickup, lang) }), chips: c('yesno') };
  if (b.cargo.category === 'construction' && b.cargo.estimated_weight_kg == null) return { key: 'quantity', text: say(lang, PH.askQuantity), chips: c('quantity') };
  if (b.cargo.estimated_weight_kg == null && b.cargo.weight_source !== 'estimate') {
    if (!b.cargo.items.length) return { key: 'weight', text: say(lang, PH.askWeightFree), chips: c('weight').slice(1) };
    const [lo, hi] = typicalRange(b.cargo.items);
    return { key: 'weight', text: say(lang, PH.askWeight, { it: theIt(b, lang), lo, hi }), chips: c('weight') };
  }
  if (flags.oddWeight) return { key: 'confirm_weight', text: flags.oddWeight, chips: c('yesno') };
  if (b.cargo.category === 'refrigerated' && b.cargo.temperature_control == null) return { key: 'temperature', text: say(lang, PH.askTemp), chips: c('temp') };
  if (!b.schedule.mode) return { key: 'schedule', text: say(lang, PH.askWhen), chips: c('when') };
  if (b.schedule.mode === 'scheduled' && b.schedule.date && !b.schedule.time && !asked(b, 'time')) return { key: 'time', text: say(lang, PH.askTime, { d: dayName(b.schedule.date, lang, now) }), chips: c('time') };
  if (b.assistance.loading == null && b.assistance.unloading == null) return { key: 'assistance', text: say(lang, PH.askHelp), chips: c('help') };
  if (helpNeeded(b) && b.assistance.helpers == null && !asked(b, 'helpers')) {
    const w = weightOf(b);
    return { key: 'helpers', text: say(lang, PH.askHelpers, { w, n: w > 600 ? 3 : w > 120 ? 2 : 1 }), chips: c('helpers') };
  }
  // floors matter when someone has to carry bulky things up or down stairs
  const floorsMatter = helpNeeded(b) && b.cargo.category !== 'construction' && (BULKY.has(b.cargo.category ?? '') || weightOf(b) >= 40);
  if (floorsMatter && b.pickup.floor == null && !asked(b, 'floors_pickup')) return { key: 'floors_pickup', text: say(lang, PH.askFloorP), chips: c('floor') };
  if (b.pickup.floor && b.pickup.elevator == null && !asked(b, 'elevator_p')) return { key: 'elevator_p', text: say(lang, PH.askElev), chips: c('yesno') };
  if (flags.stairs) return { key: 'stairs', text: flags.stairs, chips: c('yesno') };
  if (floorsMatter && b.destination.floor == null && !asked(b, 'floors_destination')) return { key: 'floors_destination', text: say(lang, PH.askFloorD), chips: c('floor') };
  if (b.destination.floor && b.destination.elevator == null && !asked(b, 'elevator_d')) return { key: 'elevator_d', text: say(lang, PH.askElev), chips: c('yesno') };
  if (flags.stairs) return { key: 'stairs', text: flags.stairs, chips: c('yesno') };
  if (b.cargo.fragile == null && !asked(b, 'fragile') && !['construction', 'home_move', 'refrigerated'].includes(b.cargo.category ?? '')) return { key: 'fragile', text: say(lang, PH.askFragile), chips: c('fragile') };
  if (b.passengers.accompany == null && !asked(b, 'passengers')) return { key: 'passengers', text: say(lang, PH.askPassengers), chips: c('passengers') };
  if (b.shared_transport_accepted == null && b.return_trip_accepted == null && !asked(b, 'savings') && b.cargo.category !== 'refrigerated') return { key: 'savings', text: say(lang, PH.askSavings), chips: c('savings') };
  if (b.instructions == null && !asked(b, 'instructions')) return { key: 'instructions', text: say(lang, PH.askInstr), chips: c('instr') };
  return null;
}

// ---------------------------------------------------------------- applying what was understood

const placeLabel = (p: Stop | null, lang: Lang) => (p ? placeName(p, lang) : '—');
const setStop = (old: Stop | null, h: PlaceHit): Stop => {
  const p = toPlace(h.g);
  const keepFloors = old && old.city === p.city;
  return { ...emptyStop(p.city), ...p, floor: keepFloors ? old!.floor : null, elevator: keepFloors ? old!.elevator : null };
};

type Ctx = { b: Booking; lang: Lang; x: Extraction; pending: string | null; notes: string[]; understood: boolean; flags: { samePlace?: boolean; oddWeight?: string; stairs?: string } };

function applyItems(c: Ctx, photoItems: { key: string; qty: number }[] | null) {
  const { b, x, lang } = c;
  const before = JSON.stringify(b.cargo.items);
  const removed = x.items.filter((i) => i.removed);
  const named = x.items.filter((i) => !i.removed);
  if (removed.length) {
    b.cargo.items = b.cargo.items.filter((i) => !removed.some((r) => r.key === i.key));
    c.notes.push(say(lang, PH.removedItems, { items: itemsText(removed, lang) }));
  }
  const incoming = [...(photoItems ?? []).map((i) => ({ ...i, qtyGiven: true })), ...named];
  if (incoming.length) {
    if (x.only && named.length && !photoItems) {
      b.cargo.items = named.map((i) => ({ key: i.key, qty: i.qtyGiven ? i.qty : b.cargo.items.find((o) => o.key === i.key)?.qty ?? i.qty }));
      b.cargo.items_confirmed = true;
    } else {
      const added: { key: string; qty: number }[] = [];
      for (const i of incoming) {
        const old = b.cargo.items.find((o) => o.key === i.key);
        if (old) {
          if (i.qtyGiven && old.qty !== i.qty) old.qty = i.qty;
        } else {
          b.cargo.items.push({ key: i.key, qty: i.qty });
          if (before !== '[]') added.push(i);
        }
      }
      if (added.length && !photoItems) c.notes.push(say(lang, PH.addedItems, { items: itemsText(added, lang) }));
    }
  }
  if (JSON.stringify(b.cargo.items) !== before) {
    c.understood = true;
    b.cargo.category = categoryOf(b.cargo.items.map((i) => i.key)) ?? b.cargo.category;
    b.cargo.description = b.cargo.items.map((i) => `${i.qty > 1 ? `${i.qty} × ` : ''}${itemLabel(i.key, 'en', i.label)}`).join(', ');
    if (b.cargo.weight_source !== 'customer') {
      b.cargo.estimated_weight_kg = b.cargo.category === 'home_move' || b.cargo.weight_source === 'estimate' ? estimateKg(b.cargo.items) : b.cargo.estimated_weight_kg;
      if (b.cargo.category === 'home_move') b.cargo.weight_source = 'estimate';
      if (b.cargo.category === 'construction' && b.cargo.items.some((i) => i.key === 'cement' || i.key === 'bricks' || i.key === 'tiles') && b.cargo.items.every((i) => !['sand', 'rebar', 'materials'].includes(i.key) || i.qty > 1)) {
        b.cargo.estimated_weight_kg = estimateKg(b.cargo.items);
        b.cargo.weight_source = 'estimate';
      }
    }
    if (b.cargo.items.some((i) => thingByKey(i.key)?.fragile) && b.cargo.fragile == null) b.cargo.fragile = true;
    if (b.cargo.items.some((i) => i.key === 'fridge') && !b.cargo.special_handling?.includes('upright')) {
      b.cargo.special_handling = [b.cargo.special_handling, 'Refrigerator must stay upright'].filter(Boolean).join('; ');
      c.notes.push(say(lang, PH.fridgeUpright));
    }
    if (b.cargo.items.some((i) => thingByKey(i.key)?.cold) && b.cargo.items.some((i) => i.key === 'cold_food')) b.cargo.temperature_control = b.cargo.temperature_control ?? true;
  }
  if (c.pending === 'items_confirmed') {
    if (x.yes || x.only) {
      b.cargo.items_confirmed = true;
      c.understood = true;
    } else if ((x.no || x.more) && !named.length) {
      c.notes.push(say(lang, PH.whatElse));
      c.understood = true;
      c.flags = { ...c.flags };
      (c as Ctx & { keepPending?: boolean }).keepPending = true;
    } else if (named.length) b.cargo.items_confirmed = !x.also && !x.more;
  }
  if (c.pending === 'cargo' && !b.cargo.items.length && !x.places.length && x.text.length > 2 && !x.yes && !x.no) {
    b.cargo.description = x.text.slice(0, 200);
    b.cargo.category = 'other';
    b.cargo.items_confirmed = true;
    c.understood = true;
  }
}

function applyPlaces(c: Ctx) {
  const { b, x, lang } = c;
  if (!x.places.length) return;
  const hits = [...x.places];
  // "not Mohammedia, Rabat" / "machi lmohammedia, rbat": the negated place is replaced by the other one
  const neg = hits.find((h) => h.negated);
  if (neg && hits.length >= 2) {
    const other = hits.find((h) => h !== neg)!;
    const slot = b.pickup?.city === neg.g.city ? 'pickup' : b.destination?.city === neg.g.city ? 'destination' : null;
    if (slot) {
      const old = b[slot];
      b[slot] = setStop(old, other);
      c.notes.push(say(lang, PH.changed, { what: say(lang, slot === 'pickup' ? PH.whatPickup : PH.whatDest), a: placeLabel(old, lang), b: placeLabel(b[slot], lang) }));
      c.understood = true;
      return;
    }
  }
  const usable = hits.filter((h) => !h.negated);
  const unassigned = usable.filter((h) => !h.role);
  for (const h of unassigned) {
    // an area of a city already chosen refines that stop ("Casablanca" → "Aïn Sebaâ")
    if (h.g.area && b.pickup && b.pickup.city === h.g.city && !b.pickup.area && c.pending !== 'destination' && !(b.destination && b.destination.city === h.g.city && !b.destination.area && c.pending === 'floors_destination')) h.role = 'pickup';
    else if (h.g.area && b.destination && b.destination.city === h.g.city && !b.destination.area) h.role = 'destination';
  }
  const rest = usable.filter((h) => !h.role);
  if (rest.length >= 2 && !usable.some((h) => h.role)) {
    rest[0].role = 'pickup';
    rest[1].role = 'destination';
  } else {
    for (const h of rest) {
      if (c.pending === 'destination' || c.pending === 'floors_destination') h.role = 'destination';
      else if (c.pending === 'pickup' || c.pending === 'floors_pickup') h.role = 'pickup';
      else if (usable.some((o) => o.role === 'pickup')) h.role = 'destination';
      else if (usable.some((o) => o.role === 'destination')) h.role = 'pickup';
      else if (!b.pickup) h.role = 'pickup';
      else if (!b.destination) h.role = 'destination';
      else h.role = x.change && hasAny(norm(x.text), ['to', 'a', 'vers', 'ل', 'الى']) ? 'destination' : 'destination';
    }
  }
  for (const role of ['pickup', 'destination'] as const) {
    const h = usable.filter((u) => u.role === role).pop();
    if (!h) continue;
    const old = b[role];
    const sameAsOld = old && (old.id === h.g.id || (old.city === h.g.city && !h.g.area && old.area));
    if (sameAsOld) continue;
    const refine = old && old.city === h.g.city && !old.area && h.g.area;
    b[role] = setStop(old, h);
    c.understood = true;
    if (old && !refine) c.notes.push(say(lang, PH.changed, { what: say(lang, role === 'pickup' ? PH.whatPickup : PH.whatDest), a: placeLabel(old, lang), b: placeLabel(b[role], lang) }));
  }
  if (b.pickup && b.destination && b.pickup.id && b.pickup.id === b.destination.id) c.flags.samePlace = true;
}

function applyWeight(c: Ctx) {
  const { b, x, lang } = c;
  let w = x.weightKg;
  if (w == null && x.number != null && !x.items.length && !x.places.length && !x.time) {
    if (c.pending === 'weight' || c.pending === 'confirm_weight') w = x.number;
    else if (c.pending === 'quantity') w = x.number <= 40 ? x.number * 1000 : x.number;
  }
  if (c.pending === 'confirm_weight') {
    if (x.yes && w == null) {
      c.understood = true;
      return;
    }
    if (x.no && w == null) {
      b.cargo.estimated_weight_kg = null;
      b.cargo.weight_source = null;
      c.understood = true;
      return;
    }
  }
  if (w != null && w > 0) {
    const old = b.cargo.estimated_weight_kg;
    b.cargo.estimated_weight_kg = w;
    b.cargo.weight_source = 'customer';
    c.understood = true;
    if (old != null && old !== w && c.pending !== 'weight' && c.pending !== 'quantity') c.notes.push(say(lang, PH.changed, { what: say(lang, PH.whatWeight), a: `${old} kg`, b: `${w} kg` }));
    if (b.cargo.items.length && b.cargo.category !== 'construction' && b.cargo.category !== 'other' && c.pending !== 'confirm_weight') {
      const [lo, hi] = typicalRange(b.cargo.items);
      if (w < lo * 0.5 || w > hi * 2) c.flags.oddWeight = say(lang, PH.weightOdd, { w, it: theIt(b, lang), lo, hi, dir: say(lang, w < lo ? PH.light : PH.heavy) });
    }
  } else if (x.unknown && (c.pending === 'weight' || c.pending === 'quantity' || c.pending === null)) {
    const est = estimateKg(b.cargo.items);
    if (b.cargo.items.length) {
      b.cargo.estimated_weight_kg = est;
      b.cargo.weight_source = 'estimate';
      c.notes.push(say(lang, PH.usingEstimate, { w: est }));
      c.understood = true;
    }
  }
}

function applySchedule(c: Ctx, now: Date) {
  const { b, x, lang } = c;
  const before = JSON.stringify(b.schedule);
  const hadAny = !!b.schedule.mode;
  if (x.now) b.schedule = { ...b.schedule, mode: 'now', date: null, time: null };
  if (x.date) {
    b.schedule.mode = 'scheduled';
    b.schedule.date = x.date;
    if (!x.time && before !== JSON.stringify(b.schedule)) b.schedule.time = null;
  }
  if (x.time && !x.now) {
    if (!b.schedule.date) {
      const d = new Date(now);
      b.schedule.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    b.schedule.mode = 'scheduled';
    b.schedule.time = x.time;
  }
  if (c.pending === 'time' && !x.time && (x.nothing || hasAny(norm(x.text), ['any time', 'anytime', 'whenever', 'peu importe', "n'importe", 'اي وقت', 'فاي وقت', 'كيفما بغيتي']))) {
    b.meta.asked.push('time');
    c.understood = true;
  }
  if (before !== JSON.stringify(b.schedule)) {
    c.understood = true;
    if (hadAny && c.pending !== 'schedule' && c.pending !== 'time') {
      const old = JSON.parse(before) as Booking['schedule'];
      const oldB = { ...b, schedule: old } as Booking;
      c.notes.push(say(lang, PH.changed, { what: say(lang, PH.whatWhen), a: whenText(oldB, lang, now) || '—', b: whenText(b, lang, now) }));
    }
  }
}

function applyHelp(c: Ctx) {
  const { b, x, lang } = c;
  const before = JSON.stringify(b.assistance);
  if (x.loading != null) b.assistance.loading = x.loading;
  if (x.unloading != null) b.assistance.unloading = x.unloading;
  if (x.loading == null && x.unloading == null && c.pending === 'assistance') {
    if (x.yes || x.bothWord) {
      b.assistance.loading = true;
      b.assistance.unloading = true;
    } else if (x.no) {
      b.assistance.loading = false;
      b.assistance.unloading = false;
      b.assistance.helpers = 0;
    }
  }
  if (x.helpers != null) b.assistance.helpers = x.helpers;
  else if (c.pending === 'helpers' && x.number != null && x.number <= 10) b.assistance.helpers = x.number;
  if (b.assistance.loading === false && b.assistance.unloading === false) b.assistance.helpers = 0;
  if (c.pending === 'stairs') {
    if (x.yes) {
      b.assistance.helpers = Math.max(2, b.assistance.helpers ?? 0);
      b.assistance.loading = true;
      b.assistance.unloading = true;
      c.understood = true;
    } else if (x.no) {
      b.meta.asked.push('stairs');
      c.understood = true;
    }
  }
  if (before !== JSON.stringify(b.assistance)) {
    c.understood = true;
    const old = JSON.parse(before) as Booking['assistance'];
    if (old.helpers != null && b.assistance.helpers != null && old.helpers !== b.assistance.helpers && c.pending !== 'helpers' && c.pending !== 'stairs')
      c.notes.push(say(lang, PH.changed, { what: say(lang, PH.whatHelpers), a: old.helpers, b: b.assistance.helpers }));
  }
}

function applyFloors(c: Ctx) {
  const { b, x } = c;
  const floors = x.floors.map((f) => ({ ...f }));
  const unassigned = floors.filter((f) => !f.role);
  if (unassigned.length >= 2) {
    unassigned[0].role = 'pickup';
    unassigned[1].role = 'destination';
  } else
    for (const f of unassigned) f.role = c.pending === 'floors_destination' || c.pending === 'elevator_d' ? 'destination' : c.pending === 'floors_pickup' || c.pending === 'elevator_p' ? 'pickup' : b.pickup?.floor == null ? 'pickup' : 'destination';
  let lastStop: 'pickup' | 'destination' | null = null;
  for (const f of floors) {
    const s = b[f.role!];
    if (!s) continue;
    s.floor = f.floor;
    if (f.floor === 0) s.elevator = null;
    lastStop = f.role!;
    c.understood = true;
  }
  const elevTarget = lastStop ?? (c.pending === 'elevator_p' || c.pending === 'floors_pickup' ? 'pickup' : c.pending === 'elevator_d' || c.pending === 'floors_destination' ? 'destination' : null);
  if (elevTarget && b[elevTarget]) {
    const s = b[elevTarget]!;
    if (x.elevator != null) {
      s.elevator = x.elevator;
      c.understood = true;
    } else if ((c.pending === 'elevator_p' || c.pending === 'elevator_d') && (x.yes || x.no)) {
      s.elevator = x.yes;
      c.understood = true;
    }
  }
  // contradiction / risk: heavy cargo, stairs, no helpers
  const w = weightOf(b);
  for (const s of [b.pickup, b.destination]) {
    if (s && (s.floor ?? 0) >= 2 && s.elevator === false && w >= 60 && (b.assistance.helpers ?? 0) < 2 && !asked(b, 'stairs') && b.assistance.loading !== false) {
      c.flags.stairs = say(c.lang, PH.stairsWarn, { w, f: s.floor!, n: 2 });
      break;
    }
  }
}

function applyOthers(c: Ctx) {
  const { b, x, lang } = c;
  if (x.cold != null) {
    b.cargo.temperature_control = x.cold;
    if (x.cold && !b.cargo.category) b.cargo.category = 'refrigerated';
    c.understood = true;
  } else if (c.pending === 'temperature' && (x.yes || x.no)) {
    b.cargo.temperature_control = x.yes;
    c.understood = true;
  }
  if (x.fragile != null) {
    b.cargo.fragile = x.fragile;
    c.understood = true;
  } else if (c.pending === 'fragile' && (x.yes || x.no)) {
    b.cargo.fragile = x.yes;
    c.understood = true;
  }
  if (x.dims) {
    b.cargo.dimensions = x.dims;
    c.understood = true;
  }
  if (x.passengers != null) {
    b.passengers = { accompany: x.passengers > 0, count: x.passengers };
    c.understood = true;
    const seats = VEHICLES[b.vehicle.required ?? suggestVehicle(b)].seats;
    if (x.passengers > Math.max(1, seats)) c.notes.push(say(lang, PH.paxLimit, { n: Math.max(1, seats) }));
  } else if (c.pending === 'passengers' && (x.yes || x.no)) {
    b.passengers = { accompany: x.yes, count: x.yes ? 1 : 0 };
    c.understood = true;
  }
  if (x.shared != null || x.returnTrip != null) {
    if (x.shared != null) b.shared_transport_accepted = x.shared;
    if (x.returnTrip != null) b.return_trip_accepted = x.returnTrip;
    if (c.pending === 'savings') {
      b.shared_transport_accepted = b.shared_transport_accepted ?? false;
      b.return_trip_accepted = b.return_trip_accepted ?? false;
    }
    c.understood = true;
  } else if (c.pending === 'savings' && (x.yes || x.no || x.bothWord)) {
    b.shared_transport_accepted = x.no ? false : true;
    b.return_trip_accepted = x.no ? false : true;
    c.understood = true;
  }
  if (c.pending === 'instructions') {
    if (x.nothing || (x.no && x.text.split(' ').length <= 2)) b.instructions = '';
    else if (!c.understood) b.instructions = [b.instructions, x.text].filter(Boolean).join(' · ').slice(0, 400);
    else b.instructions = b.instructions ?? '';
    c.understood = true;
  } else if (!c.understood && x.text.length > 8 && hasAny(norm(x.text), ['call me', 'appelez', 'appeler', 'عيط', 'اتصل', 'code', 'digicode', 'parking', 'gate', 'portail', 'interphone', 'concierge', 'gardien', 'البواب', 'الكود', 'note', 'remarque'])) {
    b.instructions = [b.instructions, x.text].filter(Boolean).join(' · ').slice(0, 400);
    c.notes.push(say(lang, PH.noted));
    c.understood = true;
  }
}

// ---------------------------------------------------------------- trip mode

export const TRIP_STEPS: P[] = [
  { en: 'Booking accepted', fr: 'Réservation acceptée', ar: 'تم قبول الحجز', da: 'الحجز تقبل' },
  { en: 'Driver preparing', fr: 'Le chauffeur se prépare', ar: 'السائق يستعد', da: 'الشيفور كيوجد' },
  { en: 'On the way to pickup', fr: 'En route vers le départ', ar: 'في الطريق إلى نقطة الاستلام', da: 'فالطريق للاستلام' },
  { en: 'Driver arrived', fr: 'Chauffeur arrivé', ar: 'وصل السائق', da: 'الشيفور وصل' },
  { en: 'Cargo loaded', fr: 'Chargement effectué', ar: 'تم تحميل الشحنة', da: 'السلعة تحملات' },
  { en: 'In transit', fr: 'En cours de transport', ar: 'الشحنة في الطريق', da: 'السلعة فالطريق' },
  { en: 'Delivered', fr: 'Livré', ar: 'تم التوصيل', da: 'توصلات' },
  { en: 'Completed', fr: 'Terminé', ar: 'اكتمل', da: 'سالات' },
];

function tripAnswer(req: AssistantRequest, text: string, lang: Lang): AssistantResponse {
  const trip = req.trip!;
  const t = norm(text);
  const b = structuredClone(req.booking);
  const status = say(lang, TRIP_STEPS[Math.min(trip.statusIndex, TRIP_STEPS.length - 1)]);
  const base = { lang, booking: b, ready: false, source: 'demo' as const, quickReplies: CHIPS.trip[lang] };
  const pending = b.meta.pending;
  b.meta.pending = null;
  const instrMarkers = ['tell the driver', 'tell him', 'let the driver know', 'dis au chauffeur', 'dites au chauffeur', 'prevenez le chauffeur', 'قول للشيفور', 'قول ليه', 'قل للسائق', 'اخبر السائق', 'gol lchifour'];
  const marker = firstHit(t, instrMarkers);
  if (pending === 'trip_instr' && text.trim().length > 1) {
    b.instructions = [b.instructions, text.trim()].filter(Boolean).join(' · ');
    return { ...base, reply: say(lang, PH.tripInstr, { d: trip.driverName, i: text.trim() }), driverNote: text.trim() };
  }
  if (marker) {
    const note = text.trim().slice(Math.min(text.length, Math.round((marker.end / t.length) * text.length))).replace(/^[\s:,-]*(that|to|que|de|بلي|باش)?\s*/i, '').trim();
    if (note.length > 2) {
      b.instructions = [b.instructions, note].filter(Boolean).join(' · ');
      return { ...base, reply: say(lang, PH.tripInstr, { d: trip.driverName, i: note }), driverNote: note };
    }
  }
  if (hasAny(t, ['instruction', 'instructions', 'change pickup', 'modifier', 'consigne', 'consignes', 'تعليمات', 'التعليمات', 'بدل', 'غير التعليمات', 'tell the driver', 'dis au chauffeur', 'قول للشيفور'])) {
    b.meta.pending = 'trip_instr';
    return { ...base, reply: say(lang, PH.tripInstrAsk), quickReplies: CHIPS.instr[lang].slice(1) };
  }
  if (hasAny(t, ['another', 'new transport', 'new booking', 'book another', 'nouveau', 'nouvelle', 'autre transport', 'جديد', 'نقل جديد', 'نقل اخر', 'حجز جديد', 'واحد اخر']))
    return { ...base, reply: say(lang, PH.tripNew), action: 'new_booking' };
  if (hasAny(t, ['support', 'help me', 'problem', 'issue', 'complaint', 'assistance', 'probleme', 'reclamation', 'aide', 'مشكل', 'مشكله', 'الدعم', 'شكايه', 'مساعده', 'service client']))
    return { ...base, reply: say(lang, PH.tripSupport), action: 'support' };
  if (hasAny(t, ['call', 'contact', 'message the driver', 'appeler', 'contacter', 'ecrire', 'عيط', 'نعيط', 'اتصل', 'نتاصل', 'نكتب'])) return { ...base, reply: say(lang, PH.tripContact, { d: trip.driverName }) };
  if (hasAny(t, ['where', 'location', 'position', 'ou est', 'ou se trouve', 'localisation', 'فين', 'اين', 'وين', 'الموقع', 'fin']) && !hasAny(t, ['when', 'quand', 'امتى', 'متى']))
    return { ...base, reply: say(lang, PH.tripWhere, { d: trip.driverName, s: status }) };
  if (hasAny(t, ['when', 'eta', 'how long', 'arrive', 'arrival', 'time', 'quand', 'heure', 'combien de temps', 'امتى', 'متى', 'شحال باقي', 'الوقت', 'يوصل', 'غادي يوصل', 'وصل']))
    return { ...base, reply: say(lang, PH.tripEta, { p: trip.pickupEta, e: trip.deliveryEta, s: status }) };
  if (hasAny(t, ['status', 'statut', 'booking', 'reservation', 'etat', 'الحاله', 'الحجز', 'فين وصل', 'اشنو وقع', 'شنو وقع']))
    return { ...base, reply: say(lang, PH.tripStatus, { d: trip.driverName, s: status }) };
  return { ...base, reply: say(lang, PH.tripHelp) };
}

// ---------------------------------------------------------------- the provider

export function demoRespond(req: AssistantRequest): AssistantResponse {
  const now = new Date(req.now);
  const last = [...req.messages].reverse().find((m) => m.role === 'user');
  const text = last?.text ?? '';
  const images: ChatImage[] = last?.images ?? [];
  const lang = text.trim() ? detectLang(text, req.lang) : req.lang ?? 'en';
  if (req.mode === 'trip' && req.trip) return tripAnswer(req, text, lang);

  const b = structuredClone(req.booking);
  const x = extract(text, now);
  const c: Ctx & { keepPending?: boolean } = { b, lang, x, pending: b.meta.pending, notes: [], understood: false, flags: {} };
  const lead: string[] = [];

  // photos
  let photoItems: { key: string; qty: number }[] | null = null;
  if (images.length) {
    b.cargo.images = [...new Set([...b.cargo.images, ...images.map((i) => i.id)])];
    const known = images.filter((i) => i.sample && SAMPLE_SCANS[i.sample]);
    if (known.length) {
      const merged = new Map<string, number>();
      for (const k of known) for (const it of SAMPLE_SCANS[k.sample!]) merged.set(it.key, Math.max(merged.get(it.key) ?? 0, it.qty));
      photoItems = [...merged].map(([key, qty]) => ({ key, qty }));
      lead.push(say(lang, known.length > 1 ? PH.sawMany : PH.sawPhoto, { items: itemsText(photoItems, lang) }));
      b.cargo.items_confirmed = false;
      b.meta.asked = b.meta.asked.filter((k) => k !== 'items_confirmed');
      c.understood = true;
    } else if (!x.items.length) {
      lead.push(say(lang, PH.cantSee));
      c.understood = true;
      b.meta.pending = 'cargo';
      return finish(b, lang, lead, { key: 'cargo', text: '', chips: CHIPS.cargo[lang] }, false);
    }
  }

  // same-place confirmation
  if (c.pending === 'same_place') {
    if (x.yes) {
      b.meta.asked.push('same_place');
      c.understood = true;
    } else if (x.no && !x.places.length) {
      b.destination = null;
      c.understood = true;
    }
  }

  applyItems(c, photoItems);
  applyPlaces(c);
  if (b.pickup?.id && b.pickup.id === b.destination?.id && !b.meta.asked.includes('same_place')) c.flags.samePlace = true;
  if (c.flags.samePlace && b.meta.asked.includes('same_place')) delete c.flags.samePlace;
  applyWeight(c);
  applySchedule(c, now);
  applyHelp(c);
  applyFloors(c);
  applyOthers(c);

  if (b.cargo.category === 'home_move' && b.cargo.estimated_weight_kg == null) {
    b.cargo.estimated_weight_kg = estimateKg(b.cargo.items);
    b.cargo.weight_source = 'estimate';
  }
  if (b.cargo.category === 'refrigerated' && b.cargo.temperature_control) b.vehicle.required = 'refrigerated';
  b.vehicle.suggested = suggestVehicle(b);

  // the question we just asked is answered (or skipped) — never ask an optional one twice
  if (c.pending && c.understood && !['cargo', 'pickup', 'destination', 'weight', 'quantity', 'schedule', 'assistance', 'temperature'].includes(c.pending)) b.meta.asked.push(c.pending);
  if (c.pending === 'items_confirmed' && c.understood && !c.keepPending) b.meta.asked.push('items_confirmed');
  b.meta.asked = [...new Set(b.meta.asked)];

  if (!c.understood && text.trim()) lead.push(say(lang, PH.sorry));
  lead.push(...c.notes);

  if (c.keepPending) return finish(b, lang, lead, null, false, 'items_confirmed');
  const q = nextQuestion(b, lang, now, c.flags);
  return finish(b, lang, lead, q, !q && isReady(b));
}

function finish(b: Booking, lang: Lang, lead: string[], q: Q | null, ready: boolean, keepPending?: string): AssistantResponse {
  b.meta.pending = keepPending ?? q?.key ?? null;
  if (q && !['cargo', 'pickup', 'destination', 'weight', 'quantity', 'schedule', 'assistance', 'temperature', 'confirm_weight', 'same_place', 'stairs'].includes(q.key)) b.meta.asked = [...new Set([...b.meta.asked])];
  if (ready) b.meta.review_requested = true;
  const reply = [...lead, ready ? say(lang, PH.ready) : q?.text ?? ''].filter(Boolean).join(' ');
  return { reply, lang, booking: b, quickReplies: ready ? [] : q?.chips ?? [], ready, source: 'demo' };
}

export class DemoProvider implements AIProvider {
  readonly source = 'demo' as const;
  async respond(req: AssistantRequest) {
    await new Promise((r) => setTimeout(r, 450 + Math.random() * 500));
    return demoRespond(req);
  }
}

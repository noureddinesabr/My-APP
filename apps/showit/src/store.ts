import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { translate, type Key, type Lang } from './i18n';
import type { VehicleId } from './vehicles';
import type { MarketSample } from './lib/pricing';

/**
 * A trip's life: open (waiting for offers) → accepted (booked) → enroute (driver on the way to the
 * pickup) → arrived (at the pickup, loading) → loaded (on the way to the destination) → dropoff (at
 * the destination, unloading) → delivered (the driver handed the load over). There is no delivery
 * code (round 7): the driver's two taps and the GPS end the trip; the customer then says "I received
 * it" and rates. It can be cancelled on the way, by either side, with a reason.
 */
export type Stage = 'open' | 'accepted' | 'enroute' | 'arrived' | 'loaded' | 'dropoff' | 'delivered' | 'cancelled';
/** The stages of a trip that is booked and not finished. */
export const LIVE_STAGES: Stage[] = ['accepted', 'enroute', 'arrived', 'loaded', 'dropoff'];
export const isLive = (stage: Stage) => LIVE_STAGES.includes(stage);

export type Request = {
  id: string;
  createdAt: number;
  /** Type of goods (a key such as 'furniture'), plus the customer's own description in `load`. */
  goods?: string;
  load: string;
  /** The customer doesn't mind which vehicle (any that can carry it). */
  anyVehicle?: boolean;
  /** Someone the customer sends rides with the goods (no name asked). */
  riderOther?: boolean;
  /** Old test versions: the lowest price allowed. Now only a hint (`costHint`), never a limit. */
  minPrice?: number;
  /** What the trip costs a driver (fuel, wear, time), shown as a hint; the customer may go below it. */
  costHint?: number;
  /** The customer accepts that the driver carries other loads on the way (cheaper); otherwise private. */
  shared?: boolean;
  /** Who will be with the driver (round 7): the customer or someone else, riding along or waiting at the destination, and who pays. */
  companion?: Companion;
  /** Simple design: who is at the pickup, riding along and at the destination, and who pays. */
  parties?: Parties;
  /** Did the driver come with the helpers asked (the customer's answer on arrival). */
  helpersCame?: 'yes' | 'fewer';
  /** The customer (or companion) said "I received it", maybe with a problem. */
  receivedAt?: number;
  problem?: { text: string; photo?: string; at: number; /** Voice notes, photos and files sent with it (round 8). */ bits?: { kind: 'text' | 'voice' | 'photo' | 'file'; text?: string; uri?: string; ms?: number; name?: string }[] };
  /** Photos taken during the trip (optional, by either side): loading, delivery, a problem. */
  tripPhotos?: { uri: string; by: 'customer' | 'driver'; at: number; stage: Stage }[];
  /** Chosen by hand: the kinds of load (ids) and other things written; the load is shown from these in each reader's language. */
  loadKinds?: string[];
  loadOthers?: string[];
  /** The floor number ('1'…'4+'), shown as "Floor 3" in each reader's language. */
  floor?: string;
  /** Round 10: floors and elevators at the pickup and at the destination. */
  floors?: Floors;
  weightKg: number;
  vehicle: VehicleId;
  from: string;
  to: string;
  /** 'now', or a local time "YYYY-MM-DDTHH:mm". */
  when: string;
  price: number;
  fairMin: number;
  fairMax: number;
  km: number;
  notes: string;
  /** Quick notes for the driver (keys such as 'lift', 'fragile'). */
  noteTags: string[];
  said: string;
  photoUri: string;
  /** All photos of the load (the first is photoUri). */
  photoUris?: string[];
  voiceUri: string;
  voiceMs: number;
  /** More voice notes and photos the customer left for the driver in the message bar. */
  noteVoices?: { uri: string; ms: number }[];
  notePhotos?: string[];
  noteFiles?: { uri: string; name: string }[];
  stage: Stage;
  /** Who cancelled, and why (when it was cancelled). */
  cancelledBy?: 'customer' | 'driver';
  cancelReason?: string;
  /** Old test versions only (the delivery code is gone). */
  code?: string;
  /** Places picked from the search (coordinates give the distance). */
  fromPlaceId?: string;
  toPlaceId?: string;
  helpers: number;
  rideAlong: boolean;
  /** Who travels with the goods when it isn't the customer. */
  riderName?: string;
  riderPhone?: string;
  messages: Message[];
  /** Messages each side has seen, for the unread badge. */
  seenByCustomer?: number;
  seenByDriver?: number;
  driverName?: string;
  driverVehicle?: VehicleId;
  driverIsExample?: boolean;
  acceptedAt?: number;
  /** The driver confirmed he takes the trip after the customer accepted (round 8, required before anything else). */
  takenAt?: number;
  /** When the current stage began (for the moving vehicle and the timers). */
  phaseAt?: number;
  /** The driver's last position (from the driver's phone GPS). */
  driverPos?: { lat: number; lng: number; at: number };
  /** Reminders already sent (keys of the trip engine's plan). */
  reminders?: string[];
  /** The driver confirmed a booking made days ahead ("still on"). */
  driverConfirmedAt?: number;
  /** Drivers who took this request and then cancelled it, with why. */
  cancelledDrivers?: { name: string; reason: string; at: number }[];
  /** What the customer liked (after rating). */
  ratingTags?: string[];
  deliveredAt?: number;
  rating?: number;
  /** Round 10: a new price being talked over after booking (the driver starts it; only before loading). */
  priceAsk?: PriceAsk;
  /** Every step of the price talks, kept for Xapp's team (the server later). */
  priceLog?: { at: number; by: 'customer' | 'driver'; what: 'ask' | 'counter' | 'accept' | 'keep' | 'cancel' | 'expired'; price: number }[];
};

/**
 * Round 10: the driver suggests a new price after booking (he found more to carry, a 4th floor
 * without elevator…), with his reason in the chat. `by` is whose suggestion waits for an answer;
 * `driverPrice` is the driver's last suggestion (for «keep my price»). The agreed price stays in
 * `Request.price` until both agree. Rounds are unlimited; either side can cancel for free.
 */
export type PriceAsk = { by: 'customer' | 'driver'; price: number; driverPrice: number; at: number };
/** The driver can suggest a new price only before the load is on board. */
export const canAskPrice = (r: Request) => (r.stage === 'accepted' || r.stage === 'enroute' || r.stage === 'arrived') && !!r.driverName;

export type Message = { id: string; from: 'customer' | 'driver' | 'app'; text: string; at: number; /** App lines: the sentence's key and details, shown in each reader's own language. */ tKey?: Key; tVars?: Record<string, string | number>; /** Written by the app for the driver (marked "automatic"). */ auto?: boolean; /** An app line meant for one side only (e.g. the driver's "go now"). */ to?: 'customer' | 'driver'; kind?: 'text' | 'voice' | 'photo' | 'file'; uri?: string; ms?: number; name?: string };

export type Offer = {
  id: string;
  requestId: string;
  driverName: string;
  vehicle: VehicleId;
  price: number;
  createdAt: number;
  /** Made up by the app so one phone can test the whole trip; always shown as an example. */
  example: boolean;
  /** The customer turned it down, or answered it with their own price. */
  status?: 'declined' | 'countered';
  counterPrice?: number;
};

/** Papers a driver adds to the profile (photos on the phone; not checked in this test version). */
export type PaperId = 'license' | 'registration' | 'insurance' | 'idCard';
export type Profile = { /** Round 10: trips cancelled because the price wasn't agreed (counted quietly, never a penalty). */ priceCancels?: number; /** Round 10: when he cancelled booked jobs (for the gentle pauses; support can remove one). */ cancels?: number[]; name: string; vehicle: VehicleId; phone?: string; photoUri?: string; plate?: string; papers?: Partial<Record<PaperId, string>>; work?: DriverWork; /** When the driver read and accepted the main rules. */ rulesAt?: number; /** When he finished signing up (photo, phone, vehicle, papers). */ signedUpAt?: number; /** Receiving new loads (round 8 switch; on unless he turns it off). */ online?: boolean; /** Trips he announced (where he's going, and back). */ plans?: TripPlan[]; /** Test version: sign-up skipped with «Skip (test)» (#99). */ testSkip?: boolean };
/** A driver's answers about his work (asked when he joins, changeable in his profile). */
export type DriverWork = {
  helpers?: 'no' | 'yes' | 'depends';
  helperCount?: number;
  /** Dirhams per helper, when he always brings them. */
  helperPrice?: number;
  skills?: ('stairs' | 'dismantle' | 'wrap' | 'fragile')[];
  area?: 'city' | 'intercity' | 'everywhere';
  shared?: boolean;
};
/** A trip the driver announced: from → to on a day, maybe coming back the day after. */
export type TripPlan = { id: string; from: string; to: string; fromPlaceId?: string; toPlaceId?: string; /** Old versions: 'today' | 'tomorrow' | 'after'. */ day: string; back: boolean; /** When he leaves: 'now' or "YYYY-MM-DDTHH:mm" (round 8). */ go?: string; /** When he comes back, if he does. */ backWhen?: string };
/**
 * Will someone be with the driver (round 8): no one, the customer, or someone else (name and phone
 * optional, seen only by the customer, never by the driver); riding with the load or waiting at the
 * destination, and who pays. Unanswered parts stay undefined: nothing is chosen by default.
 */
/** Where the customer (or the person they send) will be: at the pickup, riding with the load, waiting at the destination. */
export type CompAt = 'pickup' | 'rides' | 'waits';
/**
 * Round 10: the floor at one end of the trip and whether there is an elevator. Nothing is assumed:
 * an end left untouched is "not given", the same as «لا أعرف» ('unknown'); the elevator is only
 * asked above the ground floor.
 */
export type FloorEnd = { floor?: 'ground' | 'unknown' | number; lift?: 'yes' | 'no' | 'unknown' };
export type Floors = { pickup: FloorEnd; dropoff: FloorEnd };
/** Floors climbed on foot (no elevator) at both ends, for the price hint. */
export const stairFloors = (f?: Floors) => [f?.pickup, f?.dropoff].reduce((n, e) => n + (e && typeof e.floor === 'number' && e.lift === 'no' ? e.floor : 0), 0);
/** Whether an end's floor or elevator is still unknown (not given or «لا أعرف»). */
export const floorUnknown = (e?: FloorEnd) => !e || e.floor === undefined || e.floor === 'unknown' || (typeof e.floor === 'number' && (!e.lift || e.lift === 'unknown'));
/**
 * Round 9 (#95/#96): `at` holds one or more places (riding along and waiting at the destination
 * exclude each other); `rides` stays for older requests and is kept equal to `at` including
 * 'rides'. Who pays is asked when no one goes with the driver and when someone else does.
 */
export type Companion = { who?: 'none' | 'me' | 'other'; at?: CompAt[]; rides?: boolean; name?: string; phone?: string; pays?: 'me' | 'them' };
/** Where the person will be (older requests only have `rides`). */
export const companionAt = (c?: Companion): CompAt[] => c?.at ?? (c?.rides === true ? ['rides'] : c?.rides === false ? ['waits'] : []);
/** The first question still unanswered, in the order they are asked, or null when all are. */
export const companionNext = (c?: Companion): 'who' | 'where' | 'pays' | null => {
  if (!c?.who) return 'who';
  if (c.who !== 'none' && !companionAt(c).length) return 'where';
  if (c.who !== 'me' && !c.pays) return 'pays';
  return null;
};
/**
 * Simple design (owner's edit #1): who is there is asked BY PLACE, not by person, because the
 * person who hands over the load, the one riding with it and the one receiving it can all differ
 * (the father at the pickup, the brother riding along…). Each place: me / someone else (name and
 * phone optional, never shown to the driver); riding along may also be no one. Who pays is asked
 * only when someone else is involved, among the people actually named.
 */
export type Party = { who?: 'me' | 'other' | 'none'; name?: string; phone?: string };
export type PartyPlace = 'pickup' | 'rides' | 'dropoff';
export type Parties = { pickup: Party; rides: Party; dropoff: Party; pays?: 'me' | PartyPlace };
export const NO_PARTIES: Parties = { pickup: {}, rides: {}, dropoff: {} };
export const PARTY_PLACES: PartyPlace[] = ['pickup', 'rides', 'dropoff'];
/** Someone other than the customer is involved somewhere: then who pays is asked. */
export const partiesNeedPays = (p: Parties) => PARTY_PLACES.some((k) => p[k].who === 'other');
/** The people who can pay: me, then each other person once (the same name in two places counts once). */
export function partyPayers(p: Parties): ('me' | PartyPlace)[] {
  const out: ('me' | PartyPlace)[] = ['me'];
  const seen = new Set<string>();
  for (const k of PARTY_PLACES) {
    const x = p[k];
    if (x.who !== 'other') continue;
    const key = (x.name ?? '').trim().toLowerCase() || `#${k}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}
/** The first question still open, in order, or null. */
export function partiesNext(p?: Parties): PartyPlace | 'pays' | null {
  const q = p ?? NO_PARTIES;
  for (const k of PARTY_PLACES) if (!q[k].who) return k;
  if (partiesNeedPays(q) && !(q.pays && partyPayers(q).includes(q.pays))) return 'pays';
  return null;
}
/** The older one-person answer, kept filled for the screens that still read it. */
export function companionFromParties(p: Parties): Companion {
  const others = PARTY_PLACES.filter((k) => p[k].who === 'other');
  const mine = PARTY_PLACES.filter((k) => p[k].who === 'me');
  const at = (ks: PartyPlace[]) => ks.map((k) => (k === 'pickup' ? 'pickup' : k === 'rides' ? 'rides' : 'waits') as CompAt);
  const payer = p.pays && p.pays !== 'me' ? p[p.pays] : undefined;
  if (others.length) {
    const first = payer ?? p[others[0]];
    return { who: 'other', at: at(others), rides: others.includes('rides'), name: (first.name ?? '').trim() || undefined, phone: (first.phone ?? '').trim() || undefined, pays: p.pays && p.pays !== 'me' ? 'them' : 'me' };
  }
  if (mine.length) return { who: 'me', at: at(mine), rides: mine.includes('rides'), pays: 'me' };
  return { who: 'none', pays: 'me' };
}
/** Who the driver deals with at this moment of the trip (before loading: the pickup; after: the destination). */
export function partyNow(r: Request): Party | undefined {
  if (!r.parties) return undefined;
  return r.stage === 'loaded' || r.stage === 'dropoff' || r.stage === 'delivered' ? r.parties.dropoff : r.parties.pickup;
}

/** Whether the companion questions are fully answered. */
export const companionDone = (c?: Companion) => companionNext(c) === null;
export type CustomerProfile = { name: string; phone: string; city: string; photoUri?: string; company?: string };
export type Role = 'customer' | 'driver';

type State = {
  requests: Request[];
  offers: Offer[];
  driver: Profile;
  customer: CustomerProfile;
  /** Which side of the app is showing; changed in Settings. */
  role: Role;
  /** Light or dark, picked in Settings; unset keeps the original look (customers light, drivers dark). */
  appearance?: 'light' | 'dark';
  sounds: boolean;
  aiKey: string;
  activeRequestId: string | null;
  lang: Lang;
  /** Test version: problems the tester reported (screenshot + note), newest last. */
  reports?: Report[];
  /** Test version: the report tab on the screen's edge (on unless switched off in Settings). */
  reportTab?: boolean;
  /** Prices customers accepted (market memory for the price hint; the server keeps these later). */
  market?: MarketSample[];
  /** The conversation with Xapp support (Help › Write to us). */
  support?: SupportMessage[];
  /** When the support conversation was last opened (its unread answers count after it). */
  supportSeenAt?: number;
  /** Simple design preview: the driver's hands-free voice assistant (switched on in Settings). */
  voice?: { on: boolean; lang: 'ar' | 'fr' | 'en' };
};

/** One message in the support conversation: the user's own (text, voice, photo, file) or Xapp's answer. */
export type SupportMessage = { id: string; from: 'me' | 'xapp'; kind: 'text' | 'voice' | 'photo' | 'file'; text?: string; uri?: string; ms?: number; name?: string; at: number };

/** A problem the tester reported: the screen as it was, what they said, and where they were. */
export type Report = { id: string; at: number; shot?: string; /** The map behind the screen, pictured on its own. */ mapShot?: string; text: string; where: string; lang: Lang; role: Role; look: 'light' | 'dark' };

const KEY = 'showit.state.v1';
const initial: State = { requests: [], offers: [], driver: { name: '', vehicle: 'smallVan' }, customer: { name: '', phone: '', city: '' }, role: 'customer', sounds: true, aiKey: '', activeRequestId: null, lang: 'en' };

let state: State = initial;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

export function update(fn: (s: State) => State) {
  state = fn(state);
  emit();
}

export function getState() {
  return state;
}

export async function loadState() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as State;
      state = { ...initial, ...saved, requests: (saved.requests ?? []).map((r) => ({ ...r, helpers: r.helpers ?? 0, rideAlong: r.rideAlong ?? false, messages: r.messages ?? [], noteTags: r.noteTags ?? [] })) };
    }
  } catch {
    state = initial;
  }
  loaded = true;
  listeners.forEach((l) => l());
}

/** Re-renders the caller whenever the shared state changes. */
export function useStore(): State {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function patchRequest(id: string, patch: Partial<Request>) {
  update((s) => ({ ...s, requests: s.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
}

export function addOffer(offer: Offer) {
  // No more offers once the request is booked or cancelled.
  const r = state.requests.find((x) => x.id === offer.requestId);
  if (r && r.stage !== 'open') return;
  update((s) => ({ ...s, offers: [...s.offers.filter((o) => o.id !== offer.id), offer] }));
  notify('customer', 'newOffer', 'offer', { price: offer.price, name: offer.driverName }, undefined, offer.requestId);
}

/**
 * Chat rule (round 8): phone numbers are hidden in messages, so contact and deals stay in the app
 * (calls go through the call button).
 */
export const hidePhones = (text: string) =>
  text
    // Moroccan numbers: 06…, 07…, 05… or +212 / 00212, with or without spaces, dots or dashes.
    .replace(/(?:\+212|00212|\b0)[\s.\-]?[5-7](?:[\s.\-]?\d){8}\b/g, '•••• ••••')
    // Any other international number written with +.
    .replace(/\+\d(?:[\s.\-]?\d){8,13}\b/g, '•••• ••••');

export function sendMessage(reqId: string, from: 'customer' | 'driver', text: string, media?: { kind: 'voice' | 'photo' | 'file'; uri: string; ms?: number; name?: string }) {
  const r = state.requests.find((x) => x.id === reqId);
  if (!r || (!text.trim() && !media)) return;
  const clean = hidePhones(text.trim());
  const msg: Message = { id: newId(), from, text: clean, at: Date.now(), ...(media ? { kind: media.kind, uri: media.uri, ms: media.ms, name: media.name } : {}) };
  patchRequest(reqId, { messages: [...(r.messages ?? []), msg] });
  if (clean !== text.trim()) appMessage(reqId, 'phoneHidden', undefined, from);
  notify(from === 'customer' ? 'driver' : 'customer', 'messageFrom', 'pop', { text: msg.text || (media?.kind === 'voice' ? '🎤' : media?.kind === 'file' ? `📎 ${media.name ?? ''}` : '📷') }, reqId);
}

/** A line from the app itself in a trip's conversation (bookings, reminders, cancellations), seen by both sides. */
/** A line from the app in a trip's conversation, kept as a key so each side reads it in their own language. */
export function appMessage(reqId: string, key: Key, vars?: Record<string, string | number>, to?: 'customer' | 'driver') {
  const r = state.requests.find((x) => x.id === reqId);
  if (!r) return;
  const text = translate(state.lang, key, vars);
  patchRequest(reqId, { messages: [...(r.messages ?? []), { id: newId(), from: 'app', text, tKey: key, tVars: vars, at: Date.now(), ...(to ? { to } : {}) }] });
}

/** The messages one side sees: app lines meant only for the other side are left out. */
export const messagesFor = (r: Request, role: 'customer' | 'driver') => (r.messages ?? []).filter((m) => !m.to || m.to === role);

/**
 * An automatic message from the driver (round 6): the app writes it for the driver at each step
 * (booked, on the way, arrived, loaded, confirmed for another day), clearly marked "automatic",
 * and each side reads it in their own language.
 */
export function driverAutoMessage(reqId: string, key: Key, vars?: Record<string, string | number>) {
  const r = state.requests.find((x) => x.id === reqId);
  if (!r || !r.driverName) return;
  const text = translate(state.lang, key, vars);
  patchRequest(reqId, { messages: [...(r.messages ?? []), { id: newId(), from: 'driver', text, tKey: key, tVars: vars, auto: true, at: Date.now() }] });
}

/** What a message says, in the reader's language (app lines), or as its writer wrote it. */
export const messageText = (m: Message, lang: Lang) => (m.tKey ? translate(lang, m.tKey, moneyVars(m.tVars, lang)) : m.text);

/** Dirhams in the reader's language ("1 200 DH", «1 200 درهم»); the same as `dh` in the screens. */
export const money = (n: number, lang: Lang) => {
  const digits = String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return lang === 'ar' ? `${digits} درهم` : `${digits} DH`;
};
/** App lines keep prices as numbers (`price`, `old`) and show them in each reader's language. */
const moneyVars = (v: Message['tVars'], lang: Lang) => {
  if (!v) return v;
  const out: Record<string, string | number> = { ...v };
  for (const k of ['price', 'old']) if (typeof out[k] === 'number') out[k] = money(out[k] as number, lang);
  return out;
};

// ---------- Round 10: talking over a new price ----------

function logPrice(r: Request, by: 'customer' | 'driver', what: NonNullable<Request['priceLog']>[number]['what'], price: number) {
  return [...(r.priceLog ?? []), { at: Date.now(), by, what, price }];
}

/** The driver suggests a new price (his reason is already in the chat). */
export function askPrice(reqId: string, price: number) {
  const r = state.requests.find((x) => x.id === reqId);
  if (!r || !canAskPrice(r) || price === r.price) return;
  patchRequest(reqId, { priceAsk: { by: 'driver', price, driverPrice: price, at: Date.now() }, priceLog: logPrice(r, 'driver', 'ask', price) });
  appMessage(reqId, 'pa_asksMsg', { name: r.driverName ?? '', price, old: r.price });
  notify('customer', 'nt_priceAsk', 'offer', { name: r.driverName ?? '', price }, reqId);
}

/** The customer answers with another price; the driver answers it in turn. */
export function counterPrice(reqId: string, price: number) {
  const r = state.requests.find((x) => x.id === reqId);
  if (!r?.priceAsk || r.priceAsk.by !== 'driver' || !canAskPrice(r)) return;
  patchRequest(reqId, { priceAsk: { ...r.priceAsk, by: 'customer', price, at: Date.now() }, priceLog: logPrice(r, 'customer', 'counter', price) });
  appMessage(reqId, 'pa_counterMsg', { price });
  notify('driver', 'nt_priceCounter', 'offer', { price }, reqId);
  // Test version: an example driver agrees to the customer's price after a moment.
  if (r.driverIsExample) {
    setTimeout(() => {
      const now = state.requests.find((x) => x.id === reqId);
      if (now?.priceAsk?.by === 'customer' && now.priceAsk.price === price) agreePrice(reqId, 'driver');
    }, 4500);
  }
}

/** The side whose turn it is accepts the suggested price: it becomes the trip's price. */
export function agreePrice(reqId: string, by: 'customer' | 'driver') {
  const r = state.requests.find((x) => x.id === reqId);
  if (!r?.priceAsk || r.priceAsk.by === by) return;
  const price = r.priceAsk.price;
  patchRequest(reqId, { price, priceAsk: undefined, priceLog: logPrice(r, by, 'accept', price) });
  appMessage(reqId, 'pa_agreedMsg', { price });
  notify(by === 'customer' ? 'driver' : 'customer', 'nt_priceAgreed', 'success', { price }, undefined, reqId);
}

/** Back to the price agreed before (the customer keeps it, or the driver goes back to it). */
export function keepPrice(reqId: string, by: 'customer' | 'driver') {
  const r = state.requests.find((x) => x.id === reqId);
  if (!r?.priceAsk || r.priceAsk.by === by) return;
  patchRequest(reqId, { priceAsk: undefined, priceLog: logPrice(r, by, 'keep', r.price) });
  appMessage(reqId, 'pa_keptMsg', { price: r.price });
  notify(by === 'customer' ? 'driver' : 'customer', 'nt_priceKept', 'pop', { price: r.price }, undefined, reqId);
}

/** The driver keeps his own suggestion: it goes back to the customer. */
export function keepMyPrice(reqId: string) {
  const r = state.requests.find((x) => x.id === reqId);
  if (!r?.priceAsk || r.priceAsk.by !== 'customer' || !canAskPrice(r)) return;
  const price = r.priceAsk.driverPrice;
  patchRequest(reqId, { priceAsk: { ...r.priceAsk, by: 'driver', price, at: Date.now() }, priceLog: logPrice(r, 'driver', 'ask', price) });
  appMessage(reqId, 'pa_asksMsg', { name: r.driverName ?? '', price, old: r.price });
  notify('customer', 'nt_priceAsk', 'offer', { name: r.driverName ?? '', price }, reqId);
}

// ---- short notices at the top of the screen (not saved) ----
/** `price` in vars is a number of dirhams, formatted when shown. */
export type Notice = { id: string; side: 'customer' | 'driver'; key: Key; vars?: Record<string, string | number>; sound: 'offer' | 'pop' | 'step' | 'success' | 'send'; chat?: string; /** The request it is about. */ trip?: string };
const noticeListeners = new Set<(n: Notice) => void>();
/** `chat`: the request whose conversation a tap on the notice opens (otherwise it opens the trip). */
export function notify(side: Notice['side'], key: Key, sound: Notice['sound'] = 'pop', vars?: Notice['vars'], chat?: string, trip?: string) {
  const n: Notice = { id: newId(), side, key, vars, sound, chat, trip: trip ?? chat };
  noticeListeners.forEach((l) => l(n));
}
export function onNotice(l: (n: Notice) => void) {
  noticeListeners.add(l);
  return () => {
    noticeListeners.delete(l);
  };
}

const STAGE_NOTICE: Partial<Record<Stage, Key>> = {
  accepted: 'nt_accepted',
  enroute: 'nt_enroute',
  arrived: 'nt_arrived',
  loaded: 'nt_loaded',
  dropoff: 'nt_dropoff',
  delivered: 'nt_handedOver',
};

/** Moves a trip on and tells the other side. */
export function setStage(reqId: string, stage: Stage) {
  const now = Date.now();
  // The load is on board: a price still being talked over stays as agreed before (round 10).
  const before = state.requests.find((x) => x.id === reqId);
  if (before?.priceAsk && stage !== 'accepted' && stage !== 'enroute' && stage !== 'arrived') {
    patchRequest(reqId, { priceAsk: undefined, priceLog: logPrice(before, before.priceAsk.by, 'expired', before.price) });
    if (stage !== 'cancelled') appMessage(reqId, 'pa_expiredMsg', { price: before.price });
  }
  patchRequest(reqId, stage === 'delivered' ? { stage, deliveredAt: now, phaseAt: now } : { stage, phaseAt: now });
  const key = STAGE_NOTICE[stage];
  if (!key) return;
  const r = state.requests.find((x) => x.id === reqId);
  // The driver's automatic line in the chat for each step of the trip.
  if (r && stage === 'enroute') driverAutoMessage(reqId, r.driverIsExample ? 'drvAuto_onWay' : 'drvAuto_onWayNoEta', { min: Math.max(1, Math.round(SIM.toPickup / 60000)) });
  if (r && stage === 'arrived') driverAutoMessage(reqId, 'drvAuto_arrived');
  if (r && stage === 'loaded') driverAutoMessage(reqId, 'drvAuto_loaded');
  if (r && stage === 'dropoff') driverAutoMessage(reqId, 'drvAuto_dropoff');
  if (r && stage === 'delivered') driverAutoMessage(reqId, 'drvAuto_handedOver');
  if (stage === 'accepted') notify('driver', key, 'success', undefined, undefined, reqId);
  else notify('customer', key, stage === 'delivered' ? 'success' : 'step', { name: r?.driverName ?? '' }, undefined, reqId);
}

/**
 * How long each moving part of an example trip takes (so one phone can watch a whole trip):
 * the driver's ride to the pickup, the loading, and the ride to the destination.
 */
/** Example trips (test version). The example driver stays 45 s at the pickup, time to take photos of the load (#86). */
export const SIM = { toPickup: 24000, loading: 45000, toDrop: 30000, unloading: 8000 };

const EXAMPLE_DRIVERS: { name: string; vehicle: VehicleId; delta: number; after: number }[] = [
  { name: 'Youssef', vehicle: 'smallVan', delta: 0, after: 6000 },
  { name: 'Karim', vehicle: 'pickup', delta: 50, after: 13000 },
];

/** Two example offers arrive a few seconds after sending, so a single phone can test the flow. */
export function scheduleExampleOffers(req: Request) {
  EXAMPLE_DRIVERS.forEach((d, i) => {
    setTimeout(() => {
      const r = getState().requests.find((x) => x.id === req.id);
      if (!r || r.stage !== 'open') return;
      addOffer({
        id: `${req.id}_ex${i}`,
        requestId: req.id,
        driverName: d.name,
        vehicle: d.vehicle,
        price: Math.round((r.price + d.delta) / 10) * 10,
        createdAt: Date.now(),
        example: true,
      });
    }, d.after);
  });
}

/**
 * An example driver runs the trip by itself: sets off, drives to the pickup, loads, drives to the
 * destination and delivers, so the moving vehicle can be watched on one phone. A trip booked for
 * later starts only at its time (or when "try the trip now" is tapped in the test version).
 */
const running = new Set<string>();
export function runExampleTrip(reqId: string) {
  if (running.has(reqId)) return;
  running.add(reqId);
  const plan: [Stage, number][] = [
    ['enroute', 2500],
    ['arrived', 2500 + SIM.toPickup],
    ['loaded', 2500 + SIM.toPickup + SIM.loading],
    ['dropoff', 2500 + SIM.toPickup + SIM.loading + SIM.toDrop],
    ['delivered', 2500 + SIM.toPickup + SIM.loading + SIM.toDrop + SIM.unloading],
  ];
  plan.forEach(([stage, after], i) => {
    setTimeout(() => {
      const r = getState().requests.find((x) => x.id === reqId);
      if (i === plan.length - 1) running.delete(reqId);
      if (!r || !r.driverIsExample || r.stage === 'delivered' || r.stage === 'cancelled' || r.stage === 'open') return;
      setStage(reqId, stage);
    }, after);
  });
}

/** Messages from the other side not seen yet in a conversation. */
export function unread(r: Request, side: Role) {
  const seen = side === 'customer' ? (r.seenByCustomer ?? 0) : (r.seenByDriver ?? 0);
  return (r.messages ?? []).slice(seen).filter((m) => m.from !== side && m.from !== 'app').length;
}
export function markSeen(reqId: string, side: Role) {
  const r = state.requests.find((x) => x.id === reqId);
  if (!r) return;
  const n = (r.messages ?? []).length;
  if ((side === 'customer' ? r.seenByCustomer : r.seenByDriver) === n) return;
  patchRequest(reqId, side === 'customer' ? { seenByCustomer: n } : { seenByDriver: n });
}

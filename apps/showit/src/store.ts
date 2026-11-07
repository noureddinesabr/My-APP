import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { translate, type Key, type Lang } from './i18n';
import type { VehicleId } from './vehicles';

/**
 * A trip's life: open (waiting for offers) → accepted (booked) → enroute (driver on the way to the
 * pickup) → arrived (at the pickup, loading) → loaded (on the way to the destination) → delivered.
 * It can be cancelled on the way, by either side, with a reason.
 */
export type Stage = 'open' | 'accepted' | 'enroute' | 'arrived' | 'loaded' | 'delivered' | 'cancelled';
/** The stages of a trip that is booked and not finished. */
export const LIVE_STAGES: Stage[] = ['accepted', 'enroute', 'arrived', 'loaded'];
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
  /** The lowest price the customer may offer (what the trip costs a driver). */
  minPrice?: number;
  /** Chosen by hand: the kinds of load (ids) and other things written; the load is shown from these in each reader's language. */
  loadKinds?: string[];
  loadOthers?: string[];
  /** The floor number ('1'…'4+'), shown as "Floor 3" in each reader's language. */
  floor?: string;
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
  code: string;
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
};

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
export type Profile = { name: string; vehicle: VehicleId; phone?: string; photoUri?: string; plate?: string; papers?: Partial<Record<PaperId, string>> };
export type CustomerProfile = { name: string; phone: string; city: string; photoUri?: string };
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
};

/** A problem the tester reported: the screen as it was, what they said, and where they were. */
export type Report = { id: string; at: number; shot?: string; text: string; where: string; lang: Lang; role: Role; look: 'light' | 'dark' };

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

export function sendMessage(reqId: string, from: 'customer' | 'driver', text: string, media?: { kind: 'voice' | 'photo' | 'file'; uri: string; ms?: number; name?: string }) {
  const r = state.requests.find((x) => x.id === reqId);
  if (!r || (!text.trim() && !media)) return;
  const msg: Message = { id: newId(), from, text: text.trim(), at: Date.now(), ...(media ? { kind: media.kind, uri: media.uri, ms: media.ms, name: media.name } : {}) };
  patchRequest(reqId, { messages: [...(r.messages ?? []), msg] });
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
export const messageText = (m: Message, lang: Lang) => (m.tKey ? translate(lang, m.tKey, m.tVars) : m.text);

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
  delivered: 'nt_delivered',
};

/** Moves a trip on and tells the other side. */
export function setStage(reqId: string, stage: Stage) {
  const now = Date.now();
  patchRequest(reqId, stage === 'delivered' ? { stage, deliveredAt: now, phaseAt: now } : { stage, phaseAt: now });
  const key = STAGE_NOTICE[stage];
  if (!key) return;
  const r = state.requests.find((x) => x.id === reqId);
  // The driver's automatic line in the chat for each step of the trip.
  if (r && stage === 'enroute') driverAutoMessage(reqId, r.driverIsExample ? 'drvAuto_onWay' : 'drvAuto_onWayNoEta', { min: Math.max(1, Math.round(SIM.toPickup / 60000)) });
  if (r && stage === 'arrived') driverAutoMessage(reqId, 'drvAuto_arrived');
  if (r && stage === 'loaded') driverAutoMessage(reqId, 'drvAuto_loaded');
  if (stage === 'accepted') notify('driver', key, 'success', undefined, undefined, reqId);
  else notify('customer', key, stage === 'delivered' ? 'success' : 'step', { name: r?.driverName ?? '' }, undefined, reqId);
}

/**
 * How long each moving part of an example trip takes (so one phone can watch a whole trip):
 * the driver's ride to the pickup, the loading, and the ride to the destination.
 */
export const SIM = { toPickup: 24000, loading: 9000, toDrop: 30000 };

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
    ['delivered', 2500 + SIM.toPickup + SIM.loading + SIM.toDrop],
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

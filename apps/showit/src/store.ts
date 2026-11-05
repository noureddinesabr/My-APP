import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { Key, Lang } from './i18n';
import type { VehicleId } from './vehicles';

export type Stage = 'open' | 'accepted' | 'arrived' | 'loaded' | 'delivered' | 'cancelled';

export type Request = {
  id: string;
  createdAt: number;
  /** Type of goods (a key such as 'furniture'), plus the customer's own description in `load`. */
  goods?: string;
  load: string;
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
  stage: Stage;
  code: string;
  /** Places picked from the search (coordinates give the distance). */
  fromPlaceId?: string;
  toPlaceId?: string;
  helpers: number;
  rideAlong: boolean;
  messages: Message[];
  /** Messages each side has seen, for the unread badge. */
  seenByCustomer?: number;
  seenByDriver?: number;
  driverName?: string;
  driverVehicle?: VehicleId;
  driverIsExample?: boolean;
  acceptedAt?: number;
  deliveredAt?: number;
  rating?: number;
};

export type Message = { id: string; from: 'customer' | 'driver'; text: string; at: number };

export type Offer = {
  id: string;
  requestId: string;
  driverName: string;
  vehicle: VehicleId;
  price: number;
  createdAt: number;
  /** Made up by the app so one phone can test the whole trip; always shown as an example. */
  example: boolean;
};

export type Profile = { name: string; vehicle: VehicleId };

type State = {
  requests: Request[];
  offers: Offer[];
  driver: Profile;
  aiKey: string;
  activeRequestId: string | null;
  lang: Lang;
};

const KEY = 'showit.state.v1';
const initial: State = { requests: [], offers: [], driver: { name: '', vehicle: 'smallVan' }, aiKey: '', activeRequestId: null, lang: 'en' };

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
  update((s) => ({ ...s, offers: [...s.offers.filter((o) => o.id !== offer.id), offer] }));
  notify('customer', 'newOffer', 'offer', { price: offer.price, name: offer.driverName });
}

export function sendMessage(reqId: string, from: 'customer' | 'driver', text: string) {
  const r = state.requests.find((x) => x.id === reqId);
  if (!r || !text.trim()) return;
  const msg: Message = { id: newId(), from, text: text.trim(), at: Date.now() };
  patchRequest(reqId, { messages: [...(r.messages ?? []), msg] });
  notify(from === 'customer' ? 'driver' : 'customer', 'messageFrom', 'pop', { text: msg.text });
}

// ---- short notices at the top of the screen (not saved) ----
/** `price` in vars is a number of dirhams, formatted when shown. */
export type Notice = { id: string; side: 'customer' | 'driver'; key: Key; vars?: Record<string, string | number>; sound: 'offer' | 'pop' | 'step' | 'success' | 'send' };
const noticeListeners = new Set<(n: Notice) => void>();
export function notify(side: Notice['side'], key: Key, sound: Notice['sound'] = 'pop', vars?: Notice['vars']) {
  const n: Notice = { id: newId(), side, key, vars, sound };
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
  arrived: 'nt_arrived',
  loaded: 'nt_loaded',
  delivered: 'nt_delivered',
};

/** Moves a trip on and tells the other side. */
export function setStage(reqId: string, stage: Stage) {
  patchRequest(reqId, stage === 'delivered' ? { stage, deliveredAt: Date.now() } : { stage });
  const key = STAGE_NOTICE[stage];
  if (!key) return;
  if (stage === 'accepted') notify('driver', key, 'success');
  else notify('customer', key, stage === 'delivered' ? 'success' : 'step');
}

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

/** An example driver moves the trip on by itself, a step every few seconds. */
export function runExampleTrip(reqId: string) {
  const steps: Stage[] = ['arrived', 'loaded', 'delivered'];
  steps.forEach((stage, i) => {
    setTimeout(() => {
      const r = getState().requests.find((x) => x.id === reqId);
      if (!r || !r.driverIsExample || r.stage === 'delivered' || r.stage === 'cancelled') return;
      setStage(reqId, stage);
    }, 7000 * (i + 1));
  });
}

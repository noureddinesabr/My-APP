import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { VehicleId } from './vehicles';

export type Stage = 'open' | 'accepted' | 'arrived' | 'loaded' | 'delivered' | 'cancelled';

export type Request = {
  id: string;
  createdAt: number;
  load: string;
  weightKg: number;
  vehicle: VehicleId;
  from: string;
  to: string;
  when: string;
  price: number;
  fairMin: number;
  fairMax: number;
  km: number;
  notes: string;
  said: string;
  photoUri: string;
  voiceUri: string;
  voiceMs: number;
  stage: Stage;
  code: string;
  driverName?: string;
  driverVehicle?: VehicleId;
  driverIsExample?: boolean;
  acceptedAt?: number;
  deliveredAt?: number;
  rating?: number;
};

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
};

const KEY = 'showit.state.v1';
const initial: State = { requests: [], offers: [], driver: { name: '', vehicle: 'smallVan' }, aiKey: '', activeRequestId: null };

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
    if (raw) state = { ...initial, ...JSON.parse(raw) };
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
}

const EXAMPLE_DRIVERS: { name: string; vehicle: VehicleId; delta: number; after: number }[] = [
  { name: 'Example driver · Youssef', vehicle: 'smallVan', delta: 0, after: 6000 },
  { name: 'Example driver · Karim', vehicle: 'pickup', delta: 50, after: 13000 },
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
      patchRequest(reqId, stage === 'delivered' ? { stage, deliveredAt: Date.now() } : { stage });
    }, 7000 * (i + 1));
  });
}

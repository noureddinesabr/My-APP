import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { bestVehicle, DRIVERS, firstName, fairPrice, OTHER_LOADS, placeById, routeOf, SAMPLE_ROOM_ITEMS, type Item, type L3, type Lang, type VehicleId } from './data';
import { sfx } from './sound';
import { dh, tr } from './i18n';

/**
 * One shared marketplace for the whole preview: the customer's request is a real load on the
 * driver's side, the driver's offer is a real offer on the customer's side, and a trip moves on
 * both sides at once. Other drivers and customers are simulated (clearly marked as samples).
 */

export type Role = 'customer' | 'driver' | 'admin';
export type Photo = { id: string; src: string; user: boolean; b64?: string };
export type FloorEnd = { floor: number | null; lift: 'yes' | 'no' | 'unknown' };
export type Contact = { self: boolean; name: string; phone: string };
export type Draft = {
  photos: Photo[];
  items: Item[];
  ai: 'none' | 'sample' | 'claude' | 'manual';
  from: string;
  to: string;
  when: 'asap' | 'today' | 'tomorrow';
  time: string;
  helpers: number;
  floors: { pickup: FloorEnd; dropoff: FloorEnd };
  fragile: boolean;
  heavy: boolean;
  cover: boolean;
  shared: boolean;
  notes: string;
  voiceNote: boolean;
  pickupContact: Contact;
  dropoffContact: Contact;
  access: string;
  price: number | null;
  vehicle: VehicleId | null;
};
export type Turn = { by: 'customer' | 'driver'; price: number; at: number };
export type OfferStatus = 'pending' | 'countered' | 'accepted' | 'declined';
export type Offer = { id: string; reqId: string; driverId: string; price: number; etaMin: number; helpers: boolean; sharedOk: boolean; status: OfferStatus; turns: Turn[]; awaiting: 'customer' | 'driver'; at: number };
export type Stage = 0 | 1 | 2 | 3 | 4 | 5; // booked, approaching, arrived, loading, on the way, delivered
export type Req = {
  id: string;
  mine: boolean; // posted by the customer using the preview
  customer: string;
  createdAt: number;
  photos: string[];
  items: Item[];
  from: string;
  to: string;
  when: L3;
  helpers: number;
  floors: { pickup: FloorEnd; dropoff: FloorEnd };
  fragile: boolean;
  heavy: boolean;
  cover: boolean;
  shared: boolean;
  notes: string;
  vehicle: VehicleId;
  km: number;
  min: number;
  fair: { low: number; mid: number; high: number };
  price: number; // the customer's proposed price
  status: 'open' | 'booked' | 'delivered' | 'cancelled';
  booked?: { offerId: string; driverId: string; price: number; at: number };
  stage: Stage;
  stageAt: number;
  rating?: number;
  tags?: string[];
  feedback?: string;
  problem?: string;
  confirmedAt?: number;
  deliveryPhotos?: string[];
  savedByMe?: boolean;
};
export type ChatMsg = { id: string; reqId: string; from: 'customer' | 'driver' | 'xapp'; text: string; at: number };
export type VoiceLang = 'darija' | 'msa' | 'fr' | 'en';
export type VoiceMsg = { id: string; from: 'me' | 'xapp'; text: string; at: number; confirm?: { kind: 'counter' | 'accept' | 'stage' | 'cancel'; reqId: string; price?: number; stage?: Stage; label: string }; done?: boolean; cancelled?: boolean };
export type Toast = { id: string; text: string; tone: 'info' | 'ok' | 'offer'; role: Role };
export type Plan = { from: string; to: string; depart: L3; back: L3 | null };

export type State = {
  role: Role;
  lang: Lang;
  theme: 'light' | 'dark';
  sound: boolean;
  notifications: boolean;
  location: boolean;
  draft: Draft;
  reqs: Req[];
  offers: Offer[];
  chats: ChatMsg[];
  toasts: Toast[];
  driverOnline: boolean;
  plan: Plan | null;
  voice: VoiceMsg[];
  voiceLang: VoiceLang;
  voiceRead: boolean;
  commission: number; // Xapp's share, set by the admin (default 10%)
  approvedDocs: string[]; // admin verifications
  activeReqId: string | null; // the customer's request on screen
};

const now = () => Date.now();
export const uid = () => Math.random().toString(36).slice(2, 9);

export const emptyDraft = (): Draft => ({
  photos: [],
  items: [],
  ai: 'none',
  from: 'maarif',
  to: '',
  when: 'asap',
  time: '15:00',
  helpers: 0,
  floors: { pickup: { floor: null, lift: 'unknown' }, dropoff: { floor: null, lift: 'unknown' } },
  fragile: false,
  heavy: false,
  cover: false,
  shared: false,
  notes: '',
  voiceNote: false,
  pickupContact: { self: true, name: '', phone: '' },
  dropoffContact: { self: true, name: '', phone: '' },
  access: '',
  price: null,
  vehicle: null,
});

const draftKg = (d: Draft) => d.items.reduce((n, i) => n + i.qty * i.kg, 0);
const stairs = (d: { floors: Draft['floors'] }) => [d.floors.pickup, d.floors.dropoff].reduce((n, f) => n + (f.floor && f.lift === 'no' ? f.floor : 0), 0);
export function draftQuote(d: Draft) {
  const kg = draftKg(d);
  const vehicle = d.vehicle ?? bestVehicle(kg);
  const r = d.to ? routeOf(placeById(d.from), placeById(d.to)) : { km: 0, min: 0, city: true };
  const fair = fairPrice(vehicle, r.km, d.helpers, stairs(d));
  return { kg, vehicle, km: r.km, min: r.min, fair };
}

/** The sample loads other customers posted, plus one trip Hamid already booked for this afternoon. */
function seedReqs(): Req[] {
  const list: Req[] = OTHER_LOADS.map((l) => {
    const r = routeOf(placeById(l.from), placeById(l.to));
    return {
      id: l.id, mine: false, customer: l.customer, createdAt: now() - l.ageMin * 60000, photos: [l.photo], items: l.items, from: l.from, to: l.to, when: l.when, helpers: l.helpers,
      floors: { pickup: { floor: l.id === 'L1' ? 3 : l.id === 'L2' ? 2 : 0, lift: l.id === 'L1' ? 'no' : 'yes' }, dropoff: { floor: 0, lift: 'unknown' } },
      fragile: l.id === 'L1', heavy: l.id === 'L4', cover: false, shared: l.shared, notes: '', vehicle: l.vehicle, km: r.km, min: r.min, fair: fairPrice(l.vehicle, r.km, l.helpers, 0), price: l.price, status: 'open', stage: 0, stageAt: now(),
    };
  });
  const b = routeOf(placeById('hayhassani'), placeById('sidimaarouf'));
  list.push({
    id: 'B1', mine: false, customer: 'Rachid', createdAt: now() - 3 * 3600000, photos: [OTHER_LOADS[1].photo],
    items: [{ id: 'a', name: ['Wardrobe', 'Armoire', 'خزانة'], qty: 1, kg: 60, conf: 'high' }, { id: 'b', name: ['Mattress', 'Matelas', 'ماطلة'], qty: 2, kg: 25, conf: 'high' }],
    from: 'hayhassani', to: 'sidimaarouf', when: ['Today 16:00', "Aujourd'hui 16:00", 'اليوم 16:00'], helpers: 1, floors: { pickup: { floor: 1, lift: 'no' }, dropoff: { floor: 0, lift: 'unknown' } },
    fragile: false, heavy: false, cover: true, shared: false, notes: '', vehicle: 'largeVan', km: b.km, min: b.min, fair: fairPrice('largeVan', b.km, 1, 1), price: 230, status: 'booked',
    booked: { offerId: 'OB1', driverId: 'me', price: 240, at: now() - 2 * 3600000 }, stage: 0, stageAt: now(),
  });
  return list;
}

export const initialState = (): State => ({
  role: 'customer',
  lang: 'en',
  theme: 'light',
  sound: true,
  notifications: true,
  location: true,
  draft: emptyDraft(),
  reqs: seedReqs(),
  offers: [{ id: 'OB1', reqId: 'B1', driverId: 'me', price: 240, etaMin: 20, helpers: true, sharedOk: false, status: 'accepted', turns: [{ by: 'driver', price: 240, at: now() - 2.5 * 3600000 }], awaiting: 'customer', at: now() - 2.5 * 3600000 }],
  chats: [
    { id: 'c1', reqId: 'B1', from: 'customer', text: 'Salam, the wardrobe is dismantled already.', at: now() - 3600000 },
    { id: 'c2', reqId: 'B1', from: 'driver', text: 'Perfect, see you at 16:00.', at: now() - 3500000 },
  ],
  toasts: [],
  driverOnline: true,
  plan: { from: 'maarif', to: 'agadir', depart: ['Tomorrow 07:00', 'Demain 07:00', 'غدا 07:00'], back: ['Thursday', 'Jeudi', 'الخميس'] },
  voice: [],
  voiceLang: 'darija',
  voiceRead: true,
  commission: 0.1,
  approvedDocs: [],
  activeReqId: null,
});

// ---------------- Actions ----------------
export type Action =
  | { t: 'set'; patch: Partial<State> }
  | { t: 'draft'; patch: Partial<Draft> }
  | { t: 'resetDraft' }
  | { t: 'publish' }
  | { t: 'offer'; reqId: string; driverId: string; price: number; etaMin?: number }
  | { t: 'counter'; offerId: string; by: 'customer' | 'driver'; price: number }
  | { t: 'acceptOffer'; offerId: string; by: 'customer' | 'driver' }
  | { t: 'declineOffer'; offerId: string }
  | { t: 'raisePrice'; reqId: string; price: number }
  | { t: 'cancelReq'; reqId: string }
  | { t: 'stage'; reqId: string; stage: Stage }
  | { t: 'confirmDelivery'; reqId: string; rating: number; tags: string[]; feedback: string; problem?: string }
  | { t: 'chat'; reqId: string; from: ChatMsg['from']; text: string }
  | { t: 'toast'; toast: Omit<Toast, 'id'> }
  | { t: 'dropToast'; id: string }
  | { t: 'voice'; msg: Omit<VoiceMsg, 'id' | 'at'> }
  | { t: 'voiceDone'; id: string; cancelled?: boolean }
  | { t: 'save'; reqId: string }
  | { t: 'reset' };

function bookReq(s: State, offer: Offer): State {
  return {
    ...s,
    offers: s.offers.map((o) => (o.id === offer.id ? { ...o, status: 'accepted' as const } : o.reqId === offer.reqId && o.status !== 'declined' ? { ...o, status: 'declined' as const } : o)),
    reqs: s.reqs.map((r) => (r.id === offer.reqId ? { ...r, status: 'booked' as const, booked: { offerId: offer.id, driverId: offer.driverId, price: offer.price, at: now() }, stage: 0 as Stage, stageAt: now() } : r)),
  };
}

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case 'set':
      return { ...s, ...a.patch };
    case 'draft':
      return { ...s, draft: { ...s.draft, ...a.patch } };
    case 'resetDraft':
      return { ...s, draft: emptyDraft() };
    case 'publish': {
      const d = s.draft;
      const q = draftQuote(d);
      const id = 'R' + uid();
      const when: L3 = d.when === 'asap' ? ['As soon as possible', 'Dès que possible', 'في أقرب وقت'] : d.when === 'today' ? [`Today ${d.time}`, `Aujourd'hui ${d.time}`, `اليوم ${d.time}`] : [`Tomorrow ${d.time}`, `Demain ${d.time}`, `غدا ${d.time}`];
      const req: Req = {
        id, mine: true, customer: 'Salma', createdAt: now(), photos: d.photos.map((p) => p.src), items: d.items, from: d.from, to: d.to, when, helpers: d.helpers, floors: d.floors,
        fragile: d.fragile, heavy: d.heavy, cover: d.cover, shared: d.shared, notes: d.notes, vehicle: q.vehicle, km: q.km, min: q.min, fair: q.fair, price: d.price ?? q.fair.mid, status: 'open', stage: 0, stageAt: now(),
      };
      return { ...s, reqs: [req, ...s.reqs], activeReqId: id, draft: emptyDraft() };
    }
    case 'offer': {
      const existing = s.offers.find((o) => o.reqId === a.reqId && o.driverId === a.driverId && o.status !== 'declined');
      if (existing) return reducer(s, { t: 'counter', offerId: existing.id, by: 'driver', price: a.price });
      const o: Offer = { id: 'O' + uid(), reqId: a.reqId, driverId: a.driverId, price: a.price, etaMin: a.etaMin ?? 15, helpers: (a.driverId === 'me' ? true : DRIVERS.find((d) => d.id === a.driverId)?.helpers) ?? false, sharedOk: true, status: 'pending', turns: [{ by: 'driver', price: a.price, at: now() }], awaiting: 'customer', at: now() };
      return { ...s, offers: [...s.offers, o] };
    }
    case 'counter':
      return { ...s, offers: s.offers.map((o) => (o.id === a.offerId ? { ...o, price: a.price, status: 'countered', turns: [...o.turns, { by: a.by, price: a.price, at: now() }], awaiting: a.by === 'customer' ? 'driver' : 'customer' } : o)) };
    case 'acceptOffer': {
      const o = s.offers.find((x) => x.id === a.offerId);
      if (!o) return s;
      // Both sides agree: the price on the table becomes the booking.
      return bookReq(s, o);
    }
    case 'declineOffer':
      return { ...s, offers: s.offers.map((o) => (o.id === a.offerId ? { ...o, status: 'declined' } : o)) };
    case 'raisePrice':
      return { ...s, reqs: s.reqs.map((r) => (r.id === a.reqId ? { ...r, price: a.price } : r)) };
    case 'cancelReq':
      return { ...s, reqs: s.reqs.map((r) => (r.id === a.reqId ? { ...r, status: 'cancelled' } : r)) };
    case 'stage':
      return { ...s, reqs: s.reqs.map((r) => (r.id === a.reqId ? { ...r, stage: a.stage, stageAt: now(), status: a.stage === 5 ? 'delivered' : r.status, deliveryPhotos: a.stage === 5 ? r.photos.slice(0, 2) : r.deliveryPhotos } : r)) };
    case 'confirmDelivery':
      return { ...s, reqs: s.reqs.map((r) => (r.id === a.reqId ? { ...r, rating: a.rating, tags: a.tags, feedback: a.feedback, problem: a.problem, confirmedAt: now() } : r)) };
    case 'chat':
      return { ...s, chats: [...s.chats, { id: uid(), reqId: a.reqId, from: a.from, text: a.text, at: now() }] };
    case 'toast':
      return { ...s, toasts: [...s.toasts.slice(-2), { ...a.toast, id: uid() }] };
    case 'dropToast':
      return { ...s, toasts: s.toasts.filter((x) => x.id !== a.id) };
    case 'voice':
      return { ...s, voice: [...s.voice, { ...a.msg, id: uid(), at: now() }] };
    case 'voiceDone':
      return { ...s, voice: s.voice.map((m) => (m.id === a.id ? { ...m, done: true, cancelled: a.cancelled } : m)) };
    case 'save':
      return { ...s, reqs: s.reqs.map((r) => (r.id === a.reqId ? { ...r, savedByMe: !r.savedByMe } : r)) };
    case 'reset':
      return { ...initialState(), role: s.role, lang: s.lang, theme: s.theme, sound: s.sound };
    default:
      return s;
  }
}

const Ctx = createContext<{ s: State; d: Dispatch<Action> } | null>(null);
export const useApp = () => useContext(Ctx)!;

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, d] = useReducer(reducer, undefined, initialState);
  const value = useMemo(() => ({ s, d }), [s]);
  return (
    <Ctx.Provider value={value}>
      <Simulator />
      {children}
    </Ctx.Provider>
  );
}

// ---------------- Derived helpers ----------------
export const offersFor = (s: State, reqId: string) => s.offers.filter((o) => o.reqId === reqId && o.status !== 'declined').sort((a, b) => a.price - b.price);
export const myOffer = (s: State, reqId: string) => s.offers.find((o) => o.reqId === reqId && o.driverId === 'me' && o.status !== 'declined');
export const myTrips = (s: State) => s.reqs.filter((r) => r.booked?.driverId === 'me');
export const myActiveTrip = (s: State) => myTrips(s).find((r) => r.status === 'booked');
/** Loads Hamid can see: open, not his own booking, fit his van (≤ 1400 kg). */
export const openLoads = (s: State) => s.reqs.filter((r) => r.status === 'open' && r.items.reduce((n, i) => n + i.qty * i.kg, 0) <= 1400);
/** Whether a load lies on Hamid's announced trip (simple corridor check on the Morocco map). */
export function onRoute(s: State, r: Req) {
  if (!s.plan) return false;
  const a = placeById(s.plan.from), b = placeById(s.plan.to), p = placeById(r.from), q = placeById(r.to);
  const along = (x: typeof a) => {
    const dx = b.mx - a.mx, dy = b.my - a.my;
    const t = ((x.mx - a.mx) * dx + (x.my - a.my) * dy) / (dx * dx + dy * dy);
    const px = a.mx + t * dx, py = a.my + t * dy;
    return { t, d: Math.hypot(x.mx - px, x.my - py) };
  };
  const u = along(p), v = along(q);
  return r.km >= 25 && u.d < 22 && v.d < 22 && u.t >= -0.05 && v.t <= 1.05 && v.t >= u.t - 0.02;
}
/** A return trip: from near his destination back towards his start. */
export function isReturn(s: State, r: Req) {
  if (!s.plan) return false;
  const back = { ...s, plan: { ...s.plan, from: s.plan.to, to: s.plan.from } };
  return onRoute(back, r);
}
export const kgOf = (r: { items: Item[] }) => r.items.reduce((n, i) => n + i.qty * i.kg, 0);

// ---------------- Simulated other people ----------------
/**
 * Other drivers answer the customer's request, sample customers answer Hamid's offers, and a
 * sample driver's trip moves on by itself. Everything here is simulation for the preview.
 */
function Simulator() {
  const { s, d } = useApp();
  const seen = useRef<Set<string>>(new Set());
  const ref = useRef(s);
  ref.current = s;
  const say = (text: string, tone: Toast['tone'], role: Role) => d({ t: 'toast', toast: { text, tone, role } });

  // Sample drivers send offers a few seconds after a request is published.
  useEffect(() => {
    s.reqs.filter((r) => r.mine && r.status === 'open').forEach((r) => {
      if (seen.current.has('pub:' + r.id)) return;
      seen.current.add('pub:' + r.id);
      const plan: [string, number, number][] = [['youssef', -10, 3500], ['hamza', 15, 8000], ['karim', 0, 13000]];
      plan.forEach(([driverId, delta, after]) =>
        setTimeout(() => {
          const now = ref.current.reqs.find((x) => x.id === r.id);
          if (!now || now.status !== 'open') return;
          const price = Math.max(50, Math.round((now.price + delta) / 10) * 10);
          d({ t: 'offer', reqId: r.id, driverId, price, etaMin: driverId === 'youssef' ? 12 : driverId === 'hamza' ? 20 : 25 });
          sfx('offer', ref.current.sound);
          const name = firstName(DRIVERS.find((x) => x.id === driverId)!, ref.current.lang);
          say(`${name} · ${dh(price, ref.current.lang)}`, 'offer', 'customer');
        }, after),
      );
      // The customer's request also reaches the driver (Hamid) as a new load.
      setTimeout(() => {
        sfx('ping', ref.current.sound);
        say(tr(ref.current.lang, 'toastNewLoad'), 'info', 'driver');
      }, 1200);
    });
  }, [s.reqs, d]);

  // Whoever must answer a counter-offer answers (sample drivers and sample customers).
  useEffect(() => {
    s.offers.forEach((o) => {
      const last = o.turns[o.turns.length - 1];
      const key = `turn:${o.id}:${o.turns.length}`;
      if (seen.current.has(key) || o.status === 'accepted' || o.status === 'declined') return;
      const req = s.reqs.find((r) => r.id === o.reqId);
      if (!req) return;
      // A sample driver answers the customer's counter.
      if (last.by === 'customer' && o.driverId !== 'me') {
        seen.current.add(key);
        setTimeout(() => {
          const cur = ref.current.offers.find((x) => x.id === o.id);
          if (!cur || cur.turns.length !== o.turns.length || cur.status === 'accepted' || cur.status === 'declined') return;
          const firstAsk = o.turns.find((t) => t.by === 'driver')!.price;
          if (last.price >= firstAsk * 0.9) {
            d({ t: 'acceptOffer', offerId: o.id, by: 'driver' });
            sfx('success', ref.current.sound);
            say(tr(ref.current.lang, 'sBooked'), 'ok', 'customer');
          } else {
            const mid = Math.round((last.price + firstAsk) / 20) * 10;
            d({ t: 'counter', offerId: o.id, by: 'driver', price: mid });
            sfx('offer', ref.current.sound);
            say(tr(ref.current.lang, 'offTheyCounter', { name: firstName(DRIVERS.find((x) => x.id === o.driverId)!, ref.current.lang), price: mid }), 'offer', 'customer');
          }
        }, 3500);
      }
      // A sample customer answers Hamid's offer.
      if (last.by === 'driver' && o.driverId === 'me' && !req.mine) {
        seen.current.add(key);
        setTimeout(() => {
          const cur = ref.current.offers.find((x) => x.id === o.id);
          if (!cur || cur.turns.length !== o.turns.length || cur.status === 'accepted' || cur.status === 'declined') return;
          const r2 = ref.current.reqs.find((x) => x.id === o.reqId)!;
          if (last.price <= r2.price + 30 || o.turns.length >= 3) {
            d({ t: 'acceptOffer', offerId: o.id, by: 'customer' });
            sfx('success', ref.current.sound);
            say(tr(ref.current.lang, 'ldBooked'), 'ok', 'driver');
          } else {
            const mid = Math.round((last.price + r2.price) / 20) * 10;
            d({ t: 'counter', offerId: o.id, by: 'customer', price: mid });
            sfx('offer', ref.current.sound);
            say(tr(ref.current.lang, 'ldTheyCounter', { price: mid }), 'offer', 'driver');
          }
        }, 5000);
      }
    });
  }, [s.offers, s.reqs, d]);

  // A sample driver's trip moves on by itself (the customer watches it).
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    s.reqs.filter((r) => r.mine && r.status === 'booked' && r.booked && r.booked.driverId !== 'me').forEach((r) => {
      const next = (r.stage + 1) as Stage;
      const wait = [5000, 7000, 6000, 7000, 7000][r.stage];
      timers.push(
        setTimeout(() => {
          d({ t: 'stage', reqId: r.id, stage: next });
          sfx(next === 5 ? 'success' : 'step', ref.current.sound);
        }, wait),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [s.reqs, d]);

  // Toasts leave by themselves.
  useEffect(() => {
    if (!s.toasts.length) return;
    const t = setTimeout(() => d({ t: 'dropToast', id: s.toasts[0].id }), 3800);
    return () => clearTimeout(t);
  }, [s.toasts, d]);
  return null;
}

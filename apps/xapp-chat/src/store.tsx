import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { DRIVERS, driverById, SAMPLE_PHOTO, type Item } from './data';
import { placeById, pick, type Lang, type L3 } from './places';
import { emptySlots, quote, say, uid, whenText, type CardKind, type Slots, type Talk, type When } from './brain';
import { sfx } from './sound';

/**
 * One small marketplace shared by the customer chat and the driver side: the customer's request
 * becomes a load the driver sees; the driver's offer appears in the customer's chat; a booked trip
 * moves on both sides. Other drivers and customers are samples, labelled as such.
 */
export type Role = 'customer' | 'driver';
export type CardRef = CardKind | 'scan' | 'offers' | 'booked' | 'trip';
export type Msg = { id: string; from: 'user' | 'ai'; text?: string; photo?: string; card?: CardRef; quick?: string[]; at: number; by?: 'claude' | 'builtin' | 'app' };
export type Scan = { photo: string; sample: boolean; status: 'reading' | 'done'; items: Item[]; by: 'claude' | 'sample' };
export type Offer = { id: string; driverId: string; price: number; eta: number; status: 'pending' | 'accepted' | 'declined'; counter?: number };
export type Load = { id: string; mine: boolean; customer: string; from: string; to: string; what: { name: L3; qty: number }[]; kg: number; when: When; price: number; photo?: string; helpers: number; status: 'open' | 'offered' | 'booked' | 'declined' | 'done'; myPrice?: number };
export type Stage = 0 | 1 | 2 | 3 | 4 | 5;

export type State = {
  role: Role;
  lang: Lang;
  theme: 'light' | 'dark';
  sound: boolean;
  speakReplies: boolean;
  talk: Talk;
  msgs: Msg[];
  slots: Slots;
  scans: Record<string, Scan>;
  thinking: boolean;
  phase: 'chat' | 'sent' | 'booked' | 'done';
  price: number | null;
  offers: Offer[];
  booked: { driverId: string; price: number } | null;
  stage: Stage;
  stageAt: number;
  rating: number;
  online: boolean;
  loads: Load[];
  activeLoad: string | null;
  toasts: { id: string; text: string; role: Role }[];
};

const now = () => Date.now();
const SAMPLE_LOADS: Load[] = [
  { id: 'L1', mine: false, customer: 'Nadia', from: 'maarif', to: 'rabat', what: [{ name: ['Sofa', 'Canapé', 'صالون'], qty: 1 }, { name: ['Fridge', 'Frigo', 'تلاجة'], qty: 1 }, { name: ['Boxes', 'Cartons', 'كراطن'], qty: 8 }], kg: 216, when: { kind: 'today', time: '15:00' }, price: 520, photo: SAMPLE_PHOTO, helpers: 2, status: 'open' },
  { id: 'L2', mine: false, customer: 'Omar', from: 'derbomar', to: 'ainsebaa', what: [{ name: ['Washing machine', 'Machine à laver', 'ماشينة الصابون'], qty: 1 }], kg: 70, when: { kind: 'now' }, price: 150, helpers: 1, status: 'open' },
  { id: 'L3', mine: false, customer: 'Atlas Déco', from: 'marrakech', to: 'agadir', what: [{ name: ['Shop goods (boxes)', 'Marchandise (cartons)', 'سلعة (كراطن)'], qty: 20 }], kg: 400, when: { kind: 'tomorrow', time: '08:00' }, price: 1100, helpers: 0, status: 'open' },
];

export const initialState = (): State => ({
  role: 'customer',
  lang: 'ar',
  theme: 'light',
  sound: true,
  speakReplies: false,
  talk: 'darija',
  msgs: [],
  slots: emptySlots(),
  scans: {},
  thinking: false,
  phase: 'chat',
  price: null,
  offers: [],
  booked: null,
  stage: 0,
  stageAt: now(),
  rating: 0,
  online: true,
  loads: SAMPLE_LOADS,
  activeLoad: null,
  toasts: [],
});

export type Action =
  | { t: 'set'; patch: Partial<State> }
  | { t: 'msg'; msg: Omit<Msg, 'id' | 'at'> & { id?: string } }
  | { t: 'slots'; patch: Partial<Slots> }
  | { t: 'scan'; id: string; scan: Partial<Scan> }
  | { t: 'send'; price: number }
  | { t: 'offer'; driverId: string; price: number; eta: number }
  | { t: 'declineOffer'; id: string }
  | { t: 'accept'; id: string }
  | { t: 'counter'; id: string; price: number }
  | { t: 'stage'; stage: Stage }
  | { t: 'rate'; n: number }
  | { t: 'load'; id: string; patch: Partial<Load> }
  | { t: 'toast'; text: string; role: Role }
  | { t: 'dropToast'; id: string }
  | { t: 'newChat' }
  | { t: 'reset' };

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case 'set':
      return { ...s, ...a.patch };
    case 'msg':
      return { ...s, msgs: [...s.msgs, { ...a.msg, id: a.msg.id ?? uid(), at: now() }] };
    case 'slots':
      return { ...s, slots: { ...s.slots, ...a.patch } };
    case 'scan':
      return { ...s, scans: { ...s.scans, [a.id]: { ...(s.scans[a.id] ?? { photo: '', sample: true, status: 'reading', items: [], by: 'sample' }), ...a.scan } } };
    case 'send': {
      const q = quote(s.slots);
      const mineLoad: Load = {
        id: 'C1', mine: true, customer: 'Salma', from: s.slots.from!, to: s.slots.to!, what: s.slots.items.map((i) => ({ name: i.name, qty: i.qty })), kg: q.kg,
        when: s.slots.when ?? { kind: 'now' }, price: a.price, photo: Object.values(s.scans)[0]?.photo, helpers: s.slots.helpers ?? 0, status: 'open',
      };
      return { ...s, phase: 'sent', price: a.price, offers: [], loads: [mineLoad, ...s.loads.filter((l) => !l.mine)] };
    }
    case 'offer': {
      if (s.phase !== 'sent') return s;
      const existing = s.offers.find((o) => o.driverId === a.driverId && o.status !== 'declined');
      if (existing) return { ...s, offers: s.offers.map((o) => (o.id === existing.id ? { ...o, price: a.price, counter: undefined } : o)) };
      return { ...s, offers: [...s.offers, { id: uid(), driverId: a.driverId, price: a.price, eta: a.eta, status: 'pending' }] };
    }
    case 'declineOffer':
      return { ...s, offers: s.offers.map((o) => (o.id === a.id ? { ...o, status: 'declined' } : o)) };
    case 'counter':
      return { ...s, offers: s.offers.map((o) => (o.id === a.id ? { ...o, counter: a.price } : o)) };
    case 'accept': {
      const o = s.offers.find((x) => x.id === a.id);
      if (!o) return s;
      return {
        ...s, phase: 'booked', booked: { driverId: o.driverId, price: o.price }, stage: 0, stageAt: now(),
        offers: s.offers.map((x) => ({ ...x, status: x.id === o.id ? 'accepted' : 'declined' })),
        loads: s.loads.map((l) => (l.mine ? { ...l, status: o.driverId === 'me' ? 'booked' : 'declined' } : l)),
        activeLoad: o.driverId === 'me' ? 'C1' : s.activeLoad,
      };
    }
    case 'stage':
      return { ...s, stage: a.stage, stageAt: now(), phase: a.stage === 5 ? 'done' : s.phase, loads: a.stage === 5 ? s.loads.map((l) => (l.id === s.activeLoad ? { ...l, status: 'done' } : l)) : s.loads };
    case 'rate':
      return { ...s, rating: a.n };
    case 'load':
      return { ...s, loads: s.loads.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)) };
    case 'toast':
      return { ...s, toasts: [...s.toasts.slice(-1), { id: uid(), text: a.text, role: a.role }] };
    case 'dropToast':
      return { ...s, toasts: s.toasts.filter((x) => x.id !== a.id) };
    case 'newChat':
      return { ...initialState(), role: s.role, lang: s.lang, theme: s.theme, sound: s.sound, speakReplies: s.speakReplies, online: s.online, loads: s.loads.filter((l) => !l.mine) };
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

/** A message from the assistant in the customer's chat, in the language they speak. */
export const aiSay = (d: Dispatch<Action>, talk: Talk, v: { da: string; fr: string; en: string }, card?: CardRef) => d({ t: 'msg', msg: { from: 'ai', text: say(talk, v), card, by: 'app' } });

const STAGE_WORDS: { da: string; fr: string; en: string }[] = [
  { da: 'الحجز مأكد.', fr: 'Réservation confirmée.', en: 'Booking confirmed.' },
  { da: '{n} خرج وجاي عندك.', fr: '{n} est en route vers vous.', en: '{n} is on the way to you.' },
  { da: '{n} وصل لبلاصة الاستلام.', fr: '{n} est arrivé au départ.', en: '{n} has arrived at the pickup.' },
  { da: 'بداو كيحمّلو الحوايج.', fr: 'Le chargement a commencé.', en: 'Loading has started.' },
  { da: 'الحوايج فالطريق.', fr: 'Vos affaires sont en route.', en: 'Your things are on the way.' },
  { da: 'وصلات الحوايج بالسلامة. خلّص {p} درهم كاش للشيفور.', fr: 'Livré ! Payez {p} DH en espèces au chauffeur.', en: 'Delivered! Pay {p} DH cash to the driver.' },
];
export const stageWords = (stage: Stage, talk: Talk, name: string, price: number) => say(talk, STAGE_WORDS[stage]).replace('{n}', name).replace('{p}', String(price));

/**
 * The other people in the marketplace (all samples): drivers who answer the customer's request,
 * a sample driver's trip moving on, sample customers answering the driver's offers.
 */
function Simulator() {
  const { s, d } = useApp();
  const ref = useRef(s);
  ref.current = s;
  const name = (id: string) => (ref.current.talk === 'darija' ? driverById(id).nameAr : driverById(id).name.split(' ')[0]);

  // Offers arrive after the request is sent.
  useEffect(() => {
    if (s.phase !== 'sent' || !s.price) return;
    const plan: [string, number, number][] = [['youssef', -20, 3500], ['hamza', 30, 8000], ['karim', 0, 13000]];
    const timers = plan.map(([id, delta, after]) =>
      setTimeout(() => {
        const cur = ref.current;
        if (cur.phase !== 'sent') return;
        const price = Math.max(60, Math.round(((cur.price ?? 0) + delta) / 10) * 10);
        d({ t: 'offer', driverId: id, price, eta: id === 'youssef' ? 15 : id === 'hamza' ? 25 : 40 });
        sfx('offer', cur.sound);
        const first = !cur.offers.length;
        if (first) aiSay(d, cur.talk, { da: `جاك أول عرض من ${name(id)}: ${price} درهم. تقدر تقبلو، ولا تتسنى العروض الأخرين.`, fr: `Première offre de ${name(id)} : ${price} DH. Acceptez-la ou attendez les autres.`, en: `First offer from ${name(id)}: ${price} DH. Accept it, or wait for more.` }, 'offers');
        else d({ t: 'toast', text: `${name(id)} · ${price} DH`, role: 'customer' });
      }, after),
    );
    const toDriver = setTimeout(() => {
      sfx('ping', ref.current.sound);
      d({ t: 'toast', text: ref.current.lang === 'ar' ? 'طلب جديد: ' + pick(placeById(ref.current.slots.from!).name, 'ar') : 'New request near you', role: 'driver' });
    }, 1500);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(toDriver);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.price]);

  // A sample driver answers the customer's counter-price.
  useEffect(() => {
    const o = s.offers.find((x) => x.counter && x.status === 'pending' && x.driverId !== 'me');
    if (!o) return;
    const t = setTimeout(() => {
      const cur = ref.current.offers.find((x) => x.id === o.id);
      if (!cur?.counter) return;
      const agree = cur.counter >= cur.price * 0.9;
      const price = agree ? cur.counter : Math.round((cur.counter + cur.price) / 20) * 10;
      d({ t: 'offer', driverId: o.driverId, price, eta: o.eta });
      sfx('offer', ref.current.sound);
      aiSay(d, ref.current.talk, agree ? { da: `${name(o.driverId)} قبل ${price} درهم.`, fr: `${name(o.driverId)} accepte ${price} DH.`, en: `${name(o.driverId)} agreed to ${price} DH.` } : { da: `${name(o.driverId)} كيقترح ${price} درهم.`, fr: `${name(o.driverId)} propose ${price} DH.`, en: `${name(o.driverId)} proposes ${price} DH.` }, 'offers');
    }, 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.offers]);

  // A sample driver's trip moves on by itself; each step is told in the chat.
  useEffect(() => {
    if (s.phase !== 'booked' || !s.booked || s.booked.driverId === 'me') return;
    const wait = [4000, 6000, 5000, 6000, 7000][s.stage];
    const t = setTimeout(() => {
      const next = (ref.current.stage + 1) as Stage;
      d({ t: 'stage', stage: next });
      sfx(next === 5 ? 'success' : 'step', ref.current.sound);
      d({ t: 'msg', msg: { from: 'ai', text: stageWords(next, ref.current.talk, name(ref.current.booked!.driverId), ref.current.booked!.price), card: next === 5 ? 'trip' : undefined, by: 'app' } });
    }, wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.stage, s.booked]);

  // Sample customers answer the driver's offers.
  useEffect(() => {
    const l = s.loads.find((x) => !x.mine && x.status === 'offered');
    if (!l) return;
    const t = setTimeout(() => {
      const cur = ref.current.loads.find((x) => x.id === l.id);
      if (cur?.status !== 'offered') return;
      d({ t: 'load', id: l.id, patch: { status: 'booked' } });
      d({ t: 'set', patch: { activeLoad: l.id, stage: 0, stageAt: Date.now() } });
      sfx('success', ref.current.sound);
      d({ t: 'toast', text: ref.current.lang === 'ar' ? `${l.customer} قبل العرض ديالك` : `${l.customer} accepted your offer`, role: 'driver' });
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.loads]);

  useEffect(() => {
    if (!s.toasts.length) return;
    const t = setTimeout(() => d({ t: 'dropToast', id: s.toasts[0].id }), 3800);
    return () => clearTimeout(t);
  }, [s.toasts, d]);
  return null;
}

export const DRIVER_IDS = DRIVERS.map((x) => x.id);

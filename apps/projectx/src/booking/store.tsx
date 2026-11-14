import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import { askAssistant, detectAI } from '../ai/service';
import type { AISource, ChatImage, ChatMsg, TripContext } from '../ai/types';
import { TRIP_STEPS } from '../ai/providers/demo/brain';
import { say } from '../ai/providers/demo/phrases';
import { emptyBooking, uiLangOf, type Booking, type Lang, type UiLang } from '../models/booking';
import type { Offer } from '../models/marketplace';
import { fetchOffers } from '../marketplace/service';
import { browserUiLang } from '../i18n/ui';
import { uid } from '../images/images';
import { driverReply, driverStatusLine } from './driverSim';
import { slot } from '../lib/format';

export type Screen = 'welcome' | 'chat' | 'market' | 'trip';
export type Market = { status: 'idle' | 'searching' | 'ready' | 'error'; offers: Offer[]; rejected: string[]; page: number; more: boolean; searchId: number };
export type Trip = { offer: Offer; statusIndex: number; history: number[]; auto: boolean; bookedAt: number; rating: number | null; support: boolean };

export type State = {
  v: 2;
  screen: Screen;
  prefs: { ui: 'auto' | UiLang; speak: boolean };
  lang: Lang | null;
  photos: ChatImage[];
  messages: ChatMsg[];
  quick: string[];
  booking: Booking;
  ready: boolean;
  thinking: boolean;
  ai: AISource | null;
  notice: string | null;
  market: Market;
  trip: Trip | null;
  driverChat: ChatMsg[];
  driverTyping: boolean;
  tripChat: ChatMsg[];
  tripQuick: string[];
  tripThinking: boolean;
};

const fresh = (prefs?: State['prefs'], ai: AISource | null = null): State => ({
  v: 2,
  screen: 'welcome',
  prefs: prefs ?? { ui: 'auto', speak: false },
  lang: null,
  photos: [],
  messages: [],
  quick: [],
  booking: emptyBooking(),
  ready: false,
  thinking: false,
  ai,
  notice: null,
  market: { status: 'idle', offers: [], rejected: [], page: 0, more: false, searchId: 0 },
  trip: null,
  driverChat: [],
  driverTyping: false,
  tripChat: [],
  tripQuick: [],
  tripThinking: false,
});

type A =
  | { t: 'set'; patch: Partial<State> }
  | { t: 'msg'; m: ChatMsg }
  | { t: 'driverMsg'; m: ChatMsg }
  | { t: 'tripMsg'; m: ChatMsg }
  | { t: 'market'; patch: Partial<Market> }
  | { t: 'trip'; patch: Partial<Trip> }
  | { t: 'reset'; keepTrip?: boolean };

function reducer(s: State, a: A): State {
  switch (a.t) {
    case 'set':
      return { ...s, ...a.patch };
    case 'msg':
      return { ...s, messages: [...s.messages, a.m] };
    case 'driverMsg':
      return { ...s, driverChat: [...s.driverChat, a.m] };
    case 'tripMsg':
      return { ...s, tripChat: [...s.tripChat, a.m] };
    case 'market':
      return { ...s, market: { ...s.market, ...a.patch } };
    case 'trip':
      return s.trip ? { ...s, trip: { ...s.trip, ...a.patch } } : s;
    case 'reset':
      return { ...fresh(s.prefs, s.ai), screen: 'welcome' };
  }
}

const KEY = 'x.session.v2';
function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s.v === 2) return { ...fresh(), ...s, thinking: false, tripThinking: false, driverTyping: false, notice: null, market: s.market.status === 'searching' ? { ...s.market, status: 'idle' } : s.market };
    }
  } catch {
    // private mode / corrupt — start fresh
  }
  return fresh();
}
function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage full: keep the session without photo data
    try {
      const slim = { ...s, photos: [], messages: s.messages.map((m) => ({ ...m, images: m.images?.map((i) => ({ ...i, dataUrl: '' })) })) };
      localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      // give up quietly
    }
  }
}

const now = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
};

// ---------------------------------------------------------------- context

type Api = ReturnType<typeof useApi>;
const Ctx = createContext<Api | null>(null);
export const useX = () => useContext(Ctx)!;

function useApi() {
  const [s, d] = useReducer(reducer, undefined, load);
  const ref = useRef(s);
  ref.current = s;
  useEffect(() => save(s), [s]);
  useEffect(() => {
    detectAI().then((ai) => d({ t: 'set', patch: { ai } }));
  }, []);

  const ui: UiLang = s.prefs.ui !== 'auto' ? s.prefs.ui : s.lang ? uiLangOf(s.lang) : browserUiLang();

  /** One conversation turn: user message (text and/or photos) → assistant reply + updated booking. */
  const send = useCallback(async (text: string, images: ChatImage[] = []) => {
    const st = ref.current;
    if (st.thinking || (!text.trim() && !images.length)) return null;
    const m: ChatMsg = { id: uid(), role: 'user', text: text.trim(), images: images.length ? images : undefined, at: Date.now() };
    d({ t: 'msg', m });
    d({ t: 'set', patch: { thinking: true, quick: [], notice: null } });
    const messages = [...st.messages, m];
    try {
      const r = await askAssistant({ mode: 'collect', messages, booking: st.booking, lang: st.lang, now: now() });
      const reply: ChatMsg = { id: uid(), role: 'assistant', text: r.reply, lang: r.lang, at: Date.now(), card: r.ready ? 'review' : null, source: r.fellBack ? 'demo' : r.source };
      d({ t: 'msg', m: reply });
      d({ t: 'set', patch: { booking: r.booking, lang: r.lang, quick: r.quickReplies, ready: r.ready, thinking: false, notice: r.fellBack ? 'fallback' : null } });
      return reply;
    } catch (e) {
      console.error(e);
      d({ t: 'set', patch: { thinking: false, notice: 'error' } });
      return null;
    }
  }, []);

  /** First visit to the chat: the assistant greets (and reads the welcome photos, if any). */
  const enterChat = useCallback(async () => {
    const st = ref.current;
    d({ t: 'set', patch: { screen: 'chat' } });
    if (st.messages.length) return;
    if (st.photos.length) {
      d({ t: 'set', patch: { photos: [] } });
      await send('', st.photos);
      return;
    }
    const lang: Lang = st.lang ?? (ui === 'ar' ? 'darija' : ui);
    const greet = `${say(lang, { en: 'Hello! I’m X, your transport assistant.', fr: 'Bonjour ! Je suis X, votre assistant transport.', ar: 'مرحباً! أنا X، مساعدك في النقل.', da: 'السلام! أنا X، المساعد ديالك فالنقل.' })} ${say(lang, { en: 'What would you like to move, and from where to where? You can type, speak, or send a photo.', fr: 'Que souhaitez-vous transporter, et d’où à où ? Écrivez, parlez ou envoyez une photo.', ar: 'ماذا تريد أن تنقل، ومن أين إلى أين؟ يمكنك الكتابة أو التحدث أو إرسال صورة.', da: 'شنو بغيتي تنقل، ومنين لفين؟ تقدر تكتب، تهضر، ولا تصيفط تصويرة.' })}`;
    d({ t: 'msg', m: { id: uid(), role: 'assistant', text: greet, lang, at: Date.now() } });
    d({ t: 'set', patch: { lang, booking: { ...st.booking, meta: { ...st.booking.meta, pending: 'cargo' } } } });
  }, [send, ui]);

  // ------------------------------------------------ marketplace
  const search = useCallback(async () => {
    const st = ref.current;
    const searchId = st.market.searchId + 1;
    d({ t: 'set', patch: { screen: 'market' } });
    d({ t: 'market', patch: { status: 'searching', offers: [], rejected: [], page: 0, more: false, searchId } });
    try {
      const [res] = await Promise.all([fetchOffers(st.booking, 0), new Promise((r) => setTimeout(r, 3600))]);
      if (ref.current.market.searchId !== searchId) return;
      d({ t: 'market', patch: { status: 'ready', offers: res.offers, more: res.more } });
    } catch {
      d({ t: 'market', patch: { status: 'error' } });
    }
  }, []);
  const moreOffers = useCallback(async () => {
    const st = ref.current;
    const page = st.market.page + 1;
    const res = await fetchOffers(st.booking, page);
    d({ t: 'market', patch: { offers: [...st.market.offers, ...res.offers], page, more: res.more && page < 1 } });
  }, []);
  const reject = useCallback((id: string) => d({ t: 'market', patch: { rejected: [...ref.current.market.rejected, id] } }), []);

  // ------------------------------------------------ booking + trip
  const accept = useCallback((offer: Offer) => {
    const t0 = Date.now();
    d({ t: 'set', patch: { screen: 'trip', trip: { offer, statusIndex: 0, history: [t0], auto: true, bookedAt: t0, rating: null, support: false }, driverChat: [], tripChat: [], tripQuick: [] } });
    const lang = ref.current.lang ?? 'en';
    setTimeout(() => d({ t: 'driverMsg', m: { id: uid(), role: 'assistant', text: driverStatusLine(0, lang, ref.current.booking), at: Date.now() } }), 1200);
  }, []);

  const advance = useCallback(() => {
    const st = ref.current;
    if (!st.trip || st.trip.statusIndex >= TRIP_STEPS.length - 1) return;
    const i = st.trip.statusIndex + 1;
    d({ t: 'trip', patch: { statusIndex: i, history: [...st.trip.history, Date.now()] } });
    const line = driverStatusLine(i, st.lang ?? 'en', st.booking);
    if (line) d({ t: 'driverMsg', m: { id: uid(), role: 'assistant', text: line, at: Date.now() } });
  }, []);

  // automatic (simulated) status updates
  useEffect(() => {
    if (!s.trip?.auto || s.screen !== 'trip' || s.trip.statusIndex >= 6) return;
    const id = setTimeout(advance, s.trip.statusIndex === 0 ? 5000 : 7000);
    return () => clearTimeout(id);
  }, [s.trip?.auto, s.trip?.statusIndex, s.screen, advance]);

  const sendDriver = useCallback((text: string, fromX = false) => {
    const st = ref.current;
    if (!text.trim() || !st.trip) return;
    d({ t: 'driverMsg', m: { id: uid(), role: fromX ? 'system' : 'user', text: text.trim(), at: Date.now() } });
    d({ t: 'set', patch: { driverTyping: true } });
    setTimeout(() => {
      d({ t: 'driverMsg', m: { id: uid(), role: 'assistant', text: driverReply(text, ref.current.lang ?? 'en', ref.current.trip?.statusIndex ?? 0), at: Date.now() } });
      d({ t: 'set', patch: { driverTyping: false } });
    }, 1600 + Math.random() * 900);
  }, []);

  const tripContext = (st: State): TripContext => {
    const o = st.trip!.offer;
    const lang = st.lang ?? 'en';
    return {
      driverName: o.driver.name.split(' ')[0],
      vehicle: `${o.vehicle.model}`,
      price: o.price,
      status: say(lang, TRIP_STEPS[st.trip!.statusIndex]),
      statusIndex: st.trip!.statusIndex,
      pickupEta: slot(o.pickupAt, uiLangOf(lang)),
      deliveryEta: o.deliveryAt,
      gpsConnected: false,
      instructions: st.booking.instructions,
    };
  };
  const askTrip = useCallback(async (text: string) => {
    const st = ref.current;
    if (!text.trim() || !st.trip || st.tripThinking) return;
    const m: ChatMsg = { id: uid(), role: 'user', text: text.trim(), at: Date.now() };
    d({ t: 'tripMsg', m });
    d({ t: 'set', patch: { tripThinking: true, tripQuick: [] } });
    const r = await askAssistant({ mode: 'trip', messages: [...st.tripChat, m], booking: st.booking, lang: st.lang, trip: tripContext(st), now: now() });
    d({ t: 'tripMsg', m: { id: uid(), role: 'assistant', text: r.reply, lang: r.lang, at: Date.now(), source: r.fellBack ? 'demo' : r.source } });
    d({ t: 'set', patch: { tripThinking: false, tripQuick: r.quickReplies, booking: r.booking, lang: r.lang } });
    if (r.driverNote) sendDriver(r.driverNote, true);
    if (r.action === 'support') d({ t: 'trip', patch: { support: true } });
    return r;
  }, [sendDriver]);

  const api = {
    s,
    ui,
    rtl: ui === 'ar',
    d,
    send,
    enterChat,
    search,
    moreOffers,
    reject,
    accept,
    advance,
    sendDriver,
    askTrip,
    setPrefs: (p: Partial<State['prefs']>) => d({ t: 'set', patch: { prefs: { ...ref.current.prefs, ...p } } }),
    go: (screen: Screen) => d({ t: 'set', patch: { screen } }),
    reset: () => d({ t: 'reset' }),
  };
  return api;
}

export function XProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

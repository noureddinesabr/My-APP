import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, CircleDot, FastForward, LifeBuoy, MessageCircle, Pause, Play, Plus, Satellite, Star } from 'lucide-react';
import { useX } from '../booking/store';
import { tr } from '../i18n/ui';
import { TRIP_STEPS } from '../ai/providers/demo/brain';
import { CHIPS, say } from '../ai/providers/demo/phrases';
import { VEHICLES } from '../models/catalog';
import { MapView, type MapMarker } from '../map/MapView';
import { along, curve, type LatLng, type Route } from '../map/route';
import type { Lang } from '../models/booking';
import { Composer } from './Composer';
import { BookingSummary } from './Review';
import { RouteChip, useDesktop } from './Market';
import { DriverAvatar, Sheet, Stars, VEHICLE_IMG, spring } from './ui';

/** Screen 4 — booking confirmation, status timeline, map, driver chat and the trip assistant. */
export function Trip() {
  const { s, ui, advance, d, reset } = useX();
  const desk = useDesktop();
  const [chat, setChat] = useState(false);
  const [details, setDetails] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const trip = s.trip!;
  const o = trip.offer;
  const b = s.booking;
  const lang: Lang = s.lang ?? (ui === 'ar' ? 'darija' : ui);
  const i = trip.statusIndex;
  const done = i >= 6;
  const now = useMemo(() => new Date(), []);
  const firstSeen = useRef(Date.now() - trip.bookedAt < 4000);

  const P: LatLng | null = b.pickup?.lat ? [b.pickup.lat, b.pickup.lng!] : null;
  const D: LatLng | null = b.destination?.lat ? [b.destination.lat, b.destination.lng!] : null;
  const start: LatLng = [o.driver.gps.lat, o.driver.gps.lng];

  // simulated vehicle position (clearly labelled), animated between status updates
  const [f, setF] = useState(0);
  useEffect(() => {
    setF(0);
    if (i !== 2 && i !== 5) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 6500);
      setF(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i]);
  let car: LatLng | null = null;
  if (P && D) {
    if (i <= 1) car = start;
    else if (i === 2) car = along(curve(start, P, 24), f);
    else if (i <= 4) car = P;
    else if (i === 5) car = along(route?.points ?? curve(P, D), f);
    else car = D;
  }
  const markers: MapMarker[] = [
    ...(P ? [{ id: 'p', at: P, kind: 'pickup' as const, label: tr(ui, 'pickup') }] : []),
    ...(D ? [{ id: 'd', at: D, kind: 'dropoff' as const, label: tr(ui, 'dropoff') }] : []),
    ...(car && i < 7 ? [{ id: 'car', at: car, kind: 'vehicle' as const, label: tr(ui, 'simulated') }] : []),
  ];

  const panel = (
    <div className="scroll-thin h-full overflow-y-auto px-4 pb-10 pt-3">
      {firstSeen.current && i === 0 && (
        <motion.div className="mb-3 flex items-center gap-3 rounded-3xl bg-gradient-to-r from-violet-500/25 to-cyan-500/15 p-4 ring-1 ring-violet-300/25" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring} data-testid="booked">
          <motion.div className="grid h-11 w-11 place-items-center rounded-full bg-[#000] text-snow" initial={{ rotate: -90, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ ...spring, delay: 0.15 }}>
            <Check size={24} strokeWidth={3} />
          </motion.div>
          <div>
            <div className="font-display text-[18px] font-semibold">{tr(ui, 'booked')}</div>
            <div className="text-[13.5px] text-mist-200">{tr(ui, 'bookedSub', { d: o.driver.name.split(' ')[0], p: o.price })}</div>
          </div>
        </motion.div>
      )}

      {/* driver card */}
      <div className="rounded-3xl bg-white/[.05] p-4 ring-1 ring-white/10" data-testid="driver-card">
        <div className="flex items-center gap-3">
          <DriverAvatar name={o.driver.name} hue={o.driver.hue} size={52} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{o.driver.name}</div>
            <div className="text-[12.5px] text-mist-300">
              <Stars value={o.driver.rating} /> · {tr(ui, 'trips', { n: o.driver.trips })}
            </div>
          </div>
          <div className="text-end">
            <div className="font-display text-[22px] font-semibold leading-none" dir="ltr">
              {o.price}
            </div>
            <div className="text-[11px] text-mist-400">{tr(ui, 'mad')}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <img src={VEHICLE_IMG[o.vehicle.type]} alt="" className="h-10 w-16 object-contain" />
          <div className="min-w-0 flex-1 text-[13px]">
            <div>{VEHICLES[o.vehicle.type].label[ui]} · {o.vehicle.model}</div>
            <div className="text-mist-400" dir="ltr">{o.vehicle.plateMasked}</div>
          </div>
          <button className="btn-primary min-h-[44px] w-full px-4 text-[14px] sm:w-auto" onClick={() => setChat(true)} data-testid="message-driver">
            <MessageCircle size={17} /> {tr(ui, 'messageDriver')}
          </button>
        </div>
      </div>

      {/* status timeline */}
      <div className="mt-4 rounded-3xl bg-white/[.03] p-4 ring-1 ring-white/[.07]">
        <div className="mb-2 flex items-center justify-between">
          <div className="label">{tr(ui, 'status')}</div>
          <div className="inline-flex items-center gap-1 text-[11px] text-mist-400">
            <Satellite size={12} /> GPS ✕
          </div>
        </div>
        <ol className="relative" data-testid="timeline">
          {TRIP_STEPS.map((st, k) => {
            const state = k < i ? 'done' : k === i ? 'now' : 'next';
            const at = trip.history[k];
            return (
              <li key={k} className="relative flex gap-3 pb-3 last:pb-0">
                {k < TRIP_STEPS.length - 1 && <span className={`absolute start-[11px] top-6 h-[calc(100%-18px)] w-0.5 ${k < i ? 'bg-gradient-to-b from-violet-400 to-cyan-400' : 'bg-white/10'}`} />}
                <span className={`relative z-[1] mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${state === 'done' ? 'bg-[#000] text-snow' : state === 'now' ? 'bg-[#000] text-snow ring-4 ring-[#000]/15' : 'bg-white/8 text-mist-500 ring-1 ring-white/10'}`}>
                  {state === 'done' ? <Check size={13} strokeWidth={3} /> : <CircleDot size={12} />}
                </span>
                <div className={`flex-1 text-[14px] ${state === 'next' ? 'text-mist-500' : state === 'now' ? 'font-semibold text-white' : 'text-mist-200'}`}>
                  {say(lang, st)}
                </div>
                {at && <span className="text-[11.5px] text-mist-400" dir="ltr">{new Date(at).toLocaleTimeString(ui === 'en' ? 'en-GB' : ui === 'fr' ? 'fr-FR' : 'ar-MA', { hour: '2-digit', minute: '2-digit' })}</span>}
              </li>
            );
          })}
        </ol>
        {i < 7 && (
          <div className="mt-3 rounded-2xl bg-amber-400/[.07] p-3 ring-1 ring-amber-300/15">
            <div className="mb-2 text-[11.5px] font-medium text-amber-200/90">{tr(ui, 'demoControls')}</div>
            <div className="flex gap-2">
              <button className="btn-glass min-h-[40px] flex-1 px-3 text-[13px]" onClick={advance} data-testid="next-status">
                <FastForward size={15} /> {tr(ui, 'nextUpdate')}
              </button>
              <button className="btn-ghost min-h-[40px] px-3 text-[13px]" onClick={() => d({ t: 'trip', patch: { auto: !trip.auto } })} aria-pressed={trip.auto}>
                {trip.auto ? <Pause size={15} /> : <Play size={15} />} {trip.auto ? tr(ui, 'pause') : tr(ui, 'autoPlay')}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-mist-400">{tr(ui, 'gpsOff')}</p>
          </div>
        )}
      </div>

      {done && <Rating />}

      {trip.support && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-cyan-400/10 px-3 py-2.5 text-[13px] text-cyan-100 ring-1 ring-cyan-300/20">
          <LifeBuoy size={16} /> {tr(ui, 'supportOpened')}
        </div>
      )}

      <button className="mt-4 flex w-full items-center justify-between rounded-2xl bg-white/[.04] px-4 py-3 text-[14px] ring-1 ring-white/[.07]" onClick={() => setDetails(!details)} aria-expanded={details}>
        {tr(ui, 'details')} <ChevronDown size={18} className={`transition ${details ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {details && (
          <motion.div className="overflow-hidden px-1" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <BookingSummary b={b} ui={ui} now={now} compact />
          </motion.div>
        )}
      </AnimatePresence>
      <button className="btn-ghost mt-3 w-full" onClick={reset} data-testid="new-transport">
        <Plus size={16} /> {tr(ui, 'newTransport')}
      </button>
    </div>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      <MapView from={P} to={D} markers={markers} onRoute={setRoute} padding={desk ? [90, 60, 60, 480] : [90, 30, Math.round(window.innerHeight * 0.52) + 20, 30]} offlineLabel={tr(ui, 'mapFallback')} approxLabel={tr(ui, 'routeApprox')} />
      <div className="absolute inset-x-0 top-0 z-[600] flex items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))] lg:start-[460px]">
        <div className="glass grid h-10 max-w-[45%] shrink-0 place-items-center truncate whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold text-cyan-200" data-testid="trip-status">
          {say(lang, TRIP_STEPS[i])}
        </div>
        <RouteChip ui={ui} />
      </div>
      {desk ? (
        <div className="glass-strong absolute bottom-4 start-4 top-4 z-[600] w-[440px] overflow-hidden rounded-[28px] shadow-card">{panel}</div>
      ) : (
        <motion.div className="glass-strong absolute inset-x-0 bottom-0 z-[600] overflow-hidden rounded-t-[28px] shadow-card" style={{ height: '52%' }} initial={{ y: 60 }} animate={{ y: 0 }} transition={spring}>
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" />
          {panel}
        </motion.div>
      )}

      <DriverChat open={chat} onClose={() => setChat(false)} />
    </div>
  );
}

function Rating() {
  const { s, ui, d } = useX();
  const r = s.trip?.rating ?? 0;
  return (
    <motion.div className="mt-4 rounded-3xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 p-4 text-center ring-1 ring-violet-300/20" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} data-testid="rating">
      <div className="font-display text-[17px] font-semibold">{r ? tr(ui, 'thanks') : tr(ui, 'rateTitle')}</div>
      <div className="mt-2 flex justify-center gap-1.5" dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => d({ t: 'trip', patch: { rating: n, statusIndex: 7, history: [...(s.trip?.history ?? []).slice(0, 7), Date.now()] } })} aria-label={`${n}`} className="p-1">
            <Star size={30} className={n <= r ? 'fill-amber-300 text-amber-300' : 'text-mist-500'} />
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function DriverChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { s, ui, sendDriver } = useX();
  const [draft, setDraft] = useState('');
  const o = s.trip!.offer;
  const end = useRef<HTMLDivElement>(null);
  const lang: Lang = s.lang ?? (ui === 'ar' ? 'darija' : ui);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [s.driverChat.length, s.driverTyping, open]);
  const quick = CHIPS.instr[lang].slice(1).concat(say(lang, { en: 'Please be careful, it’s fragile', fr: 'Attention, c’est fragile', ar: 'انتبه، إنها قابلة للكسر', da: 'رد البال، كتهرس' }));
  return (
    <Sheet open={open} onClose={onClose} height="72dvh" label="driver chat" title={
      <div className="flex items-center gap-2.5">
        <DriverAvatar name={o.driver.name} hue={o.driver.hue} size={34} />
        <div className="leading-tight">
          <div className="text-[15px]">{tr(ui, 'driverChat', { d: o.driver.name.split(' ')[0] })}</div>
          <div className="text-[11.5px] font-normal text-amber-200/80">{tr(ui, 'driverAuto')}</div>
        </div>
      </div>
    }>
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-2.5 px-4 py-3" data-testid="driver-thread">
          {s.driverChat.map((m) =>
            m.role === 'system' ? (
              <div key={m.id} className="mx-auto max-w-[90%] rounded-2xl bg-violet-500/10 px-3 py-2 text-center text-[12.5px] text-violet-100 ring-1 ring-violet-300/20" dir="auto">
                <div className="label mb-0.5 text-violet-300">{tr(ui, 'instrShared')}</div>
                {m.text}
              </div>
            ) : (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-3xl px-4 py-2.5 text-[14.5px] ${m.role === 'user' ? 'rounded-ee-md text-white' : 'rounded-es-md bg-white/[.07] text-mist-100 ring-1 ring-white/10'}`} style={m.role === 'user' ? { background: '#000', color: '#fff' } : undefined} dir="auto">
                  {m.text}
                </div>
              </div>
            ),
          )}
          {s.driverTyping && (
            <div className="dots ps-2">
              <span />
              <span />
              <span />
            </div>
          )}
          <div ref={end} />
        </div>
        <div className="sticky bottom-0 bg-gradient-to-t from-ink-900 via-ink-900/95 to-transparent pt-2">
          <div className="flex gap-2 overflow-x-auto px-4 pb-1">
            {quick.map((q) => (
              <button key={q} className="chip shrink-0" onClick={() => sendDriver(q)} dir="auto">
                {q}
              </button>
            ))}
          </div>
          <Composer ui={ui} draft={draft} setDraft={setDraft} onSend={(t) => sendDriver(t)} allowPhotos={false} placeholder={tr(ui, 'writeDriver')} testid="driver-composer" />
        </div>
      </div>
    </Sheet>
  );
}

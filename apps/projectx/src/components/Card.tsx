import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, LayoutGroup } from 'framer-motion';
import { ArrowRight, CalendarClock, ChevronDown, ChevronLeft, MapPin, Search, Send, Truck, Users, Volume2, VolumeX } from 'lucide-react';
import { useX } from '../booking/store';
import { tr } from '../i18n/ui';
import { emptyStop, type Booking, type UiLang, type VehicleType } from '../models/booking';
import { estimateKg, priceRange, suggestVehicle, VEHICLES } from '../models/catalog';
import { PLACES, placeName, roadKm, toPlace, type Gaz } from '../models/places';
import { norm } from '../ai/providers/demo/nlu';
import { setSound, sfx } from '../lib/sfx';
import { iconOf, langOf, nameOf, Stepper } from './items';
import { Sheet, spring, VEHICLE_IMG } from './ui';

const POPULAR = ['maarif', 'ainsebaa', 'casablanca', 'mohammedia', 'rabat', 'settat', 'marrakech', 'tangier'];
const TIMES = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Screen 3 — everything on one card. Smart defaults are pre-selected; the only must-taps are From and To. */
export function Card() {
  const { s, ui, go, setBooking, search, setPrefs } = useX();
  const b = s.booking;
  const [placeFor, setPlaceFor] = useState<'pickup' | 'destination' | null>(null);
  const [more, setMore] = useState(false);
  const [shake, setShake] = useState(0);
  const refs = { pickup: useRef<HTMLDivElement>(null), destination: useRef<HTMLDivElement>(null) };
  const sound = s.prefs.sound !== false;
  setSound(sound);
  const kg = b.cargo.estimated_weight_kg ?? estimateKg(b.cargo.items);
  const suggestedHelpers = kg > 600 ? 3 : kg > 120 ? 2 : kg > 25 ? 1 : 0;
  const helpers = b.assistance.helpers ?? suggestedHelpers;
  const vehicle: VehicleType = b.vehicle.required ?? suggestVehicle(b);
  const km = roadKm(b.pickup, b.destination);
  const price = b.pickup && b.destination ? priceRange({ ...b, assistance: { loading: helpers > 0, unloading: helpers > 0, helpers }, vehicle: { required: vehicle, suggested: vehicle } }, km) : null;
  const ready = !!b.pickup && !!b.destination && b.cargo.items.length > 0;
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const day = b.schedule.mode === 'now' || !b.schedule.mode ? 'now' : b.schedule.date === iso(today) ? 'today' : 'tomorrow';

  const set = (f: (b: Booking) => Booking, sound: 'tap' | 'select' = 'select') => {
    sfx[sound]();
    setBooking(f);
  };
  const setDay = (d: 'now' | 'today' | 'tomorrow') =>
    set((x) => ({ ...x, schedule: d === 'now' ? { ...x.schedule, mode: 'now', date: null, time: null } : { ...x.schedule, mode: 'scheduled', date: iso(d === 'today' ? today : tomorrow), time: x.schedule.time ?? (d === 'today' ? nextSlot() : '10:00') } }));
  const send = () => {
    if (!ready) {
      sfx.error();
      setShake((n) => n + 1);
      if (!b.cargo.items.length) return go('scan');
      (b.pickup ? refs.destination : refs.pickup).current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    sfx.success();
    setBooking((x) => ({
      ...x,
      schedule: x.schedule.mode ? x.schedule : { ...x.schedule, mode: 'now' },
      assistance: { loading: helpers > 0, unloading: helpers > 0, helpers },
      vehicle: { required: vehicle, suggested: suggestVehicle(x) },
      passengers: { accompany: x.passengers.accompany ?? false, count: x.passengers.count },
      meta: { ...x.meta, review_requested: true },
    }));
    setTimeout(search, 50);
  };

  return (
    <div className="aurora relative flex h-full flex-col overflow-hidden bg-ink-950">
      <header className="relative z-10 flex items-center gap-2 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
        <button className="icon-btn" onClick={() => (sfx.tap(), go('scan'))} aria-label={tr(ui, 'back')}>
          <ChevronLeft size={22} className="rtl:rotate-180" />
        </button>
        <h1 className="flex-1 font-display text-[18px] font-semibold">{tr(ui, 'cardTitle')}</h1>
        <button className="icon-btn" onClick={() => setPrefs({ sound: !sound })} aria-label="sound" data-testid="sound">
          {sound ? <Volume2 size={19} /> : <VolumeX size={19} className="text-mist-400" />}
        </button>
      </header>

      <div className="scroll-thin relative z-0 min-h-0 flex-1 overflow-y-auto">
        <LayoutGroup>
          <div className="mx-auto max-w-lg space-y-3 px-4 pb-6">
            {/* load summary */}
            <button onClick={() => (sfx.tap(), go('scan'))} className="flex w-full items-center gap-3 rounded-3xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 p-3 text-start ring-1 ring-violet-300/20" data-testid="load-summary">
              {s.photos[0] ? <img src={s.photos[0].dataUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10">{(() => { const I = iconOf(b.cargo.items[0]?.key ?? 'boxes'); return <I size={24} />; })()}</div>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold" dir="auto">
                  {b.cargo.items.length ? b.cargo.items.map((i) => `${i.qty > 1 ? `${i.qty} ` : ''}${nameOf(i, ui)}`).join(' · ') : tr(ui, 'whatMoving')}
                </div>
                <div className="text-[12.5px] text-mist-300">{tr(ui, 'weightEst', { w: kg })}</div>
              </div>
              <span className="text-[12.5px] font-semibold text-violet-200">{tr(ui, 'edit')}</span>
            </button>

            {/* route */}
            <Section icon={<MapPin size={17} />} title={`${tr(ui, 'fromQ')} → ${tr(ui, 'toQ')}`}>
              <div className="space-y-2">
                {(['pickup', 'destination'] as const).map((role) => {
                  const v = b[role];
                  const missing = !v;
                  return (
                    <motion.div key={`${role}-${missing ? shake : 0}`} ref={refs[role]} animate={missing && shake ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }} transition={{ duration: 0.4 }}>
                      <button onClick={() => (sfx.tap(), setPlaceFor(role))} className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-start ring-1 transition ${v ? 'bg-white/[.05] ring-white/10' : 'bg-violet-500/10 ring-violet-300/40'}`} data-testid={`place-${role}`}>
                        <span className={`h-3 w-3 shrink-0 ${role === 'pickup' ? 'rounded-full bg-violet-400' : 'rotate-45 rounded-[3px] bg-cyan-400'} shadow-[0_0_12px_currentColor]`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] text-mist-400">{tr(ui, role === 'pickup' ? 'fromQ' : 'toQ')}</div>
                          <div className={`truncate text-[15.5px] ${v ? 'font-semibold text-white' : 'text-violet-200'}`} dir="auto">
                            {v ? placeName(v, langOf(ui)) : tr(ui, 'choose')}
                          </div>
                        </div>
                        <Search size={17} className="text-mist-400" />
                      </button>
                    </motion.div>
                  );
                })}
                {km > 0 && <div className="px-1 text-[12.5px] text-mist-400">{tr(ui, 'km', { n: km })}</div>}
              </div>
            </Section>

            {/* when */}
            <Section icon={<CalendarClock size={17} />} title={tr(ui, 'whenQ')}>
              <Segmented id="day" value={day} onChange={(v) => setDay(v as 'now' | 'today' | 'tomorrow')} options={[['now', tr(ui, 'whenNow')], ['today', tr(ui, 'whenToday')], ['tomorrow', tr(ui, 'whenTomorrow')]]} />
              <AnimatePresence initial={false}>
                {day !== 'now' && (
                  <motion.div className="mt-2.5 grid grid-cols-3 gap-2 overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    {TIMES.filter((t) => day !== 'today' || t > nowHHMM()).concat(day === 'today' && !TIMES.some((t) => t > nowHHMM()) ? ['20:00'] : []).map((t) => (
                      <Pill key={t} on={b.schedule.time === t} onClick={() => set((x) => ({ ...x, schedule: { ...x.schedule, time: t } }), 'tap')}>
                        <span dir="ltr">{t}</span>
                      </Pill>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>

            {/* helpers */}
            <Section icon={<Users size={17} />} title={tr(ui, 'helpersQ')}>
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((n) => (
                  <Pill key={n} on={helpers === n} onClick={() => set((x) => ({ ...x, assistance: { loading: n > 0, unloading: n > 0, helpers: n } }))} testid={`helpers-${n}`}>
                    <div className="flex flex-col items-center leading-tight">
                      <span className="font-display text-[17px] font-semibold">{n === 0 ? '—' : n}</span>
                      <span className="text-[10.5px] opacity-80">{n === 0 ? tr(ui, 'noneHelp') : n === suggestedHelpers ? tr(ui, 'suggested') : ' '}</span>
                    </div>
                  </Pill>
                ))}
              </div>
            </Section>

            {/* vehicle */}
            <Section icon={<Truck size={17} />} title={tr(ui, 'vehicleQ')}>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-testid="vehicles">
                {(Object.keys(VEHICLES) as VehicleType[])
                  .filter((v) => VEHICLES[v].maxKg >= kg || v === vehicle)
                  .filter((v) => v !== 'refrigerated' || b.cargo.category === 'refrigerated')
                  .filter((v) => v !== 'triporteur' || !['furniture', 'appliance', 'home_move'].includes(b.cargo.category ?? ''))
                  .map((v) => {
                    const on = v === vehicle;
                    return (
                      <motion.button key={v} whileTap={{ scale: 0.95 }} onClick={() => set((x) => ({ ...x, vehicle: { ...x.vehicle, required: v } }))} className={`relative w-[118px] shrink-0 rounded-2xl p-2.5 text-center ring-1 transition ${on ? 'bg-violet-500/20 ring-violet-300/60' : 'bg-white/[.04] ring-white/10'}`}>
                        {v === suggestVehicle(b) && <span className="absolute inset-x-0 -top-px z-10 mx-auto w-fit rounded-b-lg bg-[#000] px-2 py-0.5 text-[9.5px] font-bold text-snow">{tr(ui, 'suggested')}</span>}
                        <img src={VEHICLE_IMG[v]} alt="" className={`mx-auto h-12 object-contain transition ${on ? 'scale-110' : 'opacity-70'}`} />
                        <div className={`mt-1 text-[12.5px] font-medium ${on ? 'text-white' : 'text-mist-300'}`}>{VEHICLES[v].label[ui]}</div>
                        <div className="text-[10.5px] text-mist-400" dir="ltr">≤ {VEHICLES[v].maxKg} kg</div>
                      </motion.button>
                    );
                  })}
              </div>
            </Section>

            {/* more */}
            <button onClick={() => (sfx.tap(), setMore(!more))} className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-[14px] text-mist-200 ring-1 ring-white/10" aria-expanded={more} data-testid="more">
              {tr(ui, 'moreOpts')} <ChevronDown size={18} className={`transition ${more ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {more && (
                <motion.div className="space-y-3 overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  {(['pickup', 'destination'] as const).map((role) => {
                    const st = b[role];
                    return (
                      <div key={role} className="flex items-center gap-3 rounded-2xl bg-white/[.04] px-3.5 py-2.5 ring-1 ring-white/10">
                        <div className="flex-1 text-[14px]">{tr(ui, role === 'pickup' ? 'floorP' : 'floorD')}</div>
                        {(st?.floor ?? 0) > 0 && (
                          <Toggle on={!!st?.elevator} label={tr(ui, 'lift')} onClick={() => set((x) => ({ ...x, [role]: { ...(x[role] ?? emptyStop('')), elevator: !x[role]?.elevator } }), 'tap')} />
                        )}
                        <Stepper value={st?.floor ?? 0} max={20} onChange={(n) => set((x) => ({ ...x, [role]: x[role] ? { ...x[role]!, floor: Math.max(0, n) } : x[role] }), 'tap')} />
                      </div>
                    );
                  })}
                  <Row label={tr(ui, 'rideAlong')} on={!!b.passengers.accompany} onClick={() => set((x) => ({ ...x, passengers: { accompany: !x.passengers.accompany, count: x.passengers.accompany ? 0 : 1 } }), 'tap')} />
                  <Row label={tr(ui, 'saveMoney')} on={!!b.shared_transport_accepted} onClick={() => set((x) => ({ ...x, shared_transport_accepted: !x.shared_transport_accepted, return_trip_accepted: !x.shared_transport_accepted }), 'tap')} />
                  <div className="rounded-2xl bg-white/[.04] px-3.5 py-2.5 ring-1 ring-white/10">
                    <label className="text-[12px] text-mist-400" htmlFor="note">
                      {tr(ui, 'noteQ')}
                    </label>
                    <input id="note" dir="auto" value={b.instructions ?? ''} onChange={(e) => setBooking((x) => ({ ...x, instructions: e.target.value }))} placeholder={tr(ui, 'notePh')} className="mt-1 w-full bg-transparent text-[15px] outline-none placeholder:text-mist-500 focus-visible:outline-none" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      </div>

      {/* sticky action */}
      <div className="relative z-10 border-t border-white/[.06] bg-ink-950/85 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-lg">
          <AnimatePresence>
            {price && (
              <motion.div className="mb-2.5 flex items-baseline justify-between text-[13px]" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span className="text-mist-300">{tr(ui, 'usualPrice')}</span>
                <motion.span key={`${price.low}-${price.high}`} className="font-display text-[18px] font-semibold text-cyan-200" dir="ltr" initial={{ scale: 1.15, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }}>
                  {price.low}–{price.high} MAD
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
          <button className={`btn-primary w-full text-[16.5px] ${ready ? '' : 'opacity-60'}`} onClick={send} data-testid="send">
            {ready ? (
              <>
                <Send size={18} className="rtl:-scale-x-100" /> {tr(ui, 'sendDrivers')}
              </>
            ) : (
              <>
                {tr(ui, 'pickBoth')} <ArrowRight size={18} className="rtl:rotate-180" />
              </>
            )}
          </button>
        </div>
      </div>

      <PlaceSheet ui={ui} role={placeFor} onClose={() => setPlaceFor(null)} onPick={(g) => {
        const role = placeFor!;
        set((x) => ({ ...x, [role]: { ...emptyStop(g.city), ...toPlace(g), floor: x[role]?.floor ?? null, elevator: x[role]?.elevator ?? null } }));
        setPlaceFor(null);
        if (role === 'pickup' && !b.destination) setTimeout(() => setPlaceFor('destination'), 280);
      }} />
    </div>
  );
}

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const nextSlot = () => TIMES.find((t) => t > nowHHMM()) ?? '20:00';

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <motion.section layout className="rounded-3xl bg-white/[.035] p-3.5 ring-1 ring-white/[.08]" transition={spring}>
      <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-mist-200">
        <span className="text-violet-300">{icon}</span>
        {title}
      </div>
      {children}
    </motion.section>
  );
}

function Segmented({ id, value, onChange, options }: { id: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="relative grid rounded-2xl bg-ink-850 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={`relative z-[1] rounded-xl py-2.5 text-[14px] font-semibold transition ${v === value ? 'text-snow' : 'text-mist-300'}`} data-testid={`${id}-${v}`}>
          {v === value && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 -z-[1] rounded-xl" style={{ background: '#000' }} transition={spring} />}
          {l}
        </button>
      ))}
    </div>
  );
}

function Pill({ on, onClick, children, testid }: { on: boolean; onClick: () => void; children: ReactNode; testid?: string }) {
  return (
    <motion.button whileTap={{ scale: 0.94 }} onClick={onClick} className={`min-h-[48px] rounded-2xl px-2 py-2 text-[14px] font-medium ring-1 transition ${on ? 'bg-[#000] text-snow ring-[#000]' : 'bg-ink-900 text-mist-200 ring-[#000]/[.06]'}`} data-testid={testid}>
      {children}
    </motion.button>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 ${on ? 'bg-cyan-400/20 text-cyan-100 ring-cyan-300/50' : 'bg-white/5 text-mist-400 ring-white/10'}`} aria-pressed={on}>
      {label}
    </button>
  );
}

function Row({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl bg-white/[.04] px-3.5 py-3 text-start ring-1 ring-white/10" role="switch" aria-checked={on}>
      <span className="flex-1 text-[14px]">{label}</span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-violet-500' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-snow shadow transition-all ${on ? 'start-[22px]' : 'start-0.5'}`} />
      </span>
    </button>
  );
}

export function PlaceSheet({ ui, role, onClose, onPick }: { ui: UiLang; role: 'pickup' | 'destination' | null; onClose: () => void; onPick: (g: Gaz) => void }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const t = norm(q);
    const all = t ? PLACES.filter((p) => [p.city, p.area ?? '', p.ar, ...p.words].some((w) => norm(w).includes(t))) : POPULAR.map((id) => PLACES.find((p) => p.id === id)!).concat(PLACES.filter((p) => !POPULAR.includes(p.id)));
    return all.slice(0, 40);
  }, [q]);
  return (
    <Sheet open={!!role} onClose={() => (onClose(), setQ(''))} height="80dvh" title={role ? tr(ui, role === 'pickup' ? 'fromQ' : 'toQ') : ''}>
      <div className="flex h-full flex-col">
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 rounded-2xl bg-white/[.06] px-3.5 ring-1 ring-white/10 focus-within:ring-violet-300/50">
            <Search size={17} className="text-mist-400" />
            <input autoFocus dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(ui, 'searchPlace')} className="h-12 flex-1 bg-transparent text-[15.5px] outline-none placeholder:text-mist-500 focus-visible:outline-none" data-testid="place-search" />
          </div>
        </div>
        <div className="space-y-1 px-2 pb-6" data-testid="place-list">
          {list.map((p) => (
            <button key={p.id} onClick={() => (onPick(p), setQ(''))} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start hover:bg-white/5 active:bg-white/10">
              <MapPin size={17} className={p.area ? 'text-cyan-300' : 'text-violet-300'} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px]" dir="auto">
                  {placeName(p, langOf(ui), true)}
                </div>
                {p.area && <div className="text-[12px] text-mist-400">{placeName({ id: null, city: p.city }, langOf(ui))}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

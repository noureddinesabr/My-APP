import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft, Clock, PackageCheck, Recycle, RefreshCw, ShieldCheck, Sparkles, Users, Zap } from 'lucide-react';
import { useX } from '../booking/store';
import { tr } from '../i18n/ui';
import type { Offer } from '../models/marketplace';
import { VEHICLES, estimateKg } from '../models/catalog';
import { placeName, roadKm } from '../models/places';
import { sampleVehiclesNear } from '../marketplace/offers';
import { MapView, type MapMarker } from '../map/MapView';
import type { UiLang } from '../models/booking';
import { Orb } from './Orb';
import { slot } from '../lib/format';
import { DriverAvatar, Sheet, Stars, VEHICLE_IMG, spring } from './ui';

export const useDesktop = () => {
  const q = '(min-width: 1024px)';
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setD(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return d;
};

export function RouteChip({ ui }: { ui: UiLang }) {
  const { s } = useX();
  const b = s.booking;
  const lang = ui === 'ar' ? 'darija' : ui;
  const km = roadKm(b.pickup, b.destination);
  return (
    <div className="glass flex min-w-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px]" dir="auto">
      <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />
      <span className="truncate">{b.pickup ? placeName(b.pickup, lang, true) : ''}</span>
      <span className="text-mist-400 rtl:rotate-180">→</span>
      <span className="h-2 w-2 shrink-0 rotate-45 bg-cyan-400" />
      <span className="truncate">{b.destination ? placeName(b.destination, lang, true) : ''}</span>
      {km ? <span className="shrink-0 text-mist-400">· {tr(ui, 'km', { n: km })}</span> : null}
    </div>
  );
}

/** Screen 3 — map + transport offers. */
export function Market() {
  const { s, ui, go, search, moreOffers, reject, accept } = useX();
  const desk = useDesktop();
  const [view, setView] = useState<Offer | null>(null);
  const [confirm, setConfirm] = useState<Offer | null>(null);
  const b = s.booking;
  const m = s.market;
  const visible = m.offers.filter((o) => !m.rejected.includes(o.id));
  const searching = m.status === 'searching' || m.status === 'idle';

  useEffect(() => {
    if (m.status === 'idle') search();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tags = useMemo(() => {
    const t: Record<string, ('best' | 'fastest' | 'topRated')[]> = {};
    if (visible.length < 2) return t;
    const add = (id: string, k: 'best' | 'fastest' | 'topRated') => (t[id] = [...(t[id] ?? []), k]);
    add([...visible].sort((a, z) => a.price - z.price)[0].id, 'best');
    if (b.schedule.mode !== 'scheduled') add([...visible].sort((a, z) => a.pickupInMin - z.pickupInMin)[0].id, 'fastest');
    add([...visible].sort((a, z) => z.driver.rating - a.driver.rating || z.driver.trips - a.driver.trips)[0].id, 'topRated');
    return t;
  }, [visible.map((v) => v.id).join(), b.schedule.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const markers: MapMarker[] = [
    ...(b.pickup?.lat ? [{ id: 'p', at: [b.pickup.lat, b.pickup.lng!] as [number, number], kind: 'pickup' as const, label: tr(ui, 'pickup') }] : []),
    ...(b.destination?.lat ? [{ id: 'd', at: [b.destination.lat, b.destination.lng!] as [number, number], kind: 'dropoff' as const, label: tr(ui, 'dropoff') }] : []),
    ...(searching ? sampleVehiclesNear(b).map((v) => ({ id: v.id, at: [v.lat, v.lng] as [number, number], kind: 'sample' as const })) : []),
  ];
  const kg = b.cargo.estimated_weight_kg ?? estimateKg(b.cargo.items);
  const lang = ui === 'ar' ? 'darija' : ui;

  const panel = (
    <div className="flex h-full min-h-0 flex-col">
      <AnimatePresence mode="wait">
        {searching ? (
          <motion.div key="s" className="flex flex-col items-center px-6 py-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="searching">
            <Orb size={86} state="thinking" />
            <h2 className="mt-5 font-display text-[19px] font-semibold">{tr(ui, 'finding')}</h2>
            <div className="mt-4 w-full max-w-xs space-y-2.5 text-start">
              {[tr(ui, 'step1', { w: kg }), tr(ui, 'step2', { p: b.pickup ? placeName(b.pickup, lang, true) : '' }), tr(ui, 'step3')].map((t, i) => (
                <motion.div key={i} className="flex items-center gap-2.5 text-[13.5px] text-mist-200" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.9 }}>
                  <motion.span className="grid h-5 w-5 place-items-center rounded-full bg-[#000] text-snow" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ delay: 0.9 + i * 0.9 }}>
                    <Check size={12} />
                  </motion.span>
                  {t}
                </motion.div>
              ))}
            </div>
            <p className="mt-5 text-[11.5px] text-mist-400">{tr(ui, 'sampleVehicles')}</p>
          </motion.div>
        ) : m.status === 'error' ? (
          <motion.div key="e" className="space-y-3 p-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p>{tr(ui, 'searchError')}</p>
            <button className="btn-primary" onClick={search}>
              <RefreshCw size={16} /> {tr(ui, 'retry')}
            </button>
          </motion.div>
        ) : (
          <motion.div key="o" className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex items-center gap-2 px-5 pb-2 pt-4">
              <h2 className="font-display text-[19px] font-semibold">{tr(ui, 'offersN', { n: visible.length })}</h2>
              <span className="tag bg-amber-400/12 text-amber-200 ring-1 ring-amber-300/20">{tr(ui, 'sampleOffers')}</span>
            </div>
            <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4" data-testid="offers">
              <AnimatePresence>
                {visible.map((o, i) => (
                  <OfferCard key={o.id} o={o} i={i} tags={tags[o.id] ?? []} onView={() => setView(o)} onAccept={() => setConfirm(o)} onReject={() => reject(o.id)} />
                ))}
              </AnimatePresence>
              {!visible.length && (
                <div className="space-y-3 rounded-3xl bg-white/5 p-5 text-center" data-testid="no-offers">
                  <p className="text-mist-200">{tr(ui, 'noMore')}</p>
                  <div className="flex justify-center gap-2">
                    <button className="btn-glass" onClick={search}>
                      <RefreshCw size={16} /> {tr(ui, 'searchAgain')}
                    </button>
                    <button className="btn-ghost" onClick={() => go('card')}>
                      {tr(ui, 'backToChat')}
                    </button>
                  </div>
                </div>
              )}
              {m.more && visible.length > 0 && (
                <button className="btn-ghost w-full" onClick={moreOffers} data-testid="more-offers">
                  {tr(ui, 'moreOffers')}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-950">
      <MapView
        from={b.pickup?.lat ? [b.pickup.lat, b.pickup.lng!] : null}
        to={b.destination?.lat ? [b.destination.lat, b.destination.lng!] : null}
        markers={markers}
        padding={desk ? [90, 60, 60, 480] : [90, 30, Math.round(window.innerHeight * 0.58) + 20, 30]}
        offlineLabel={tr(ui, 'mapFallback')}
        approxLabel={tr(ui, 'routeApprox')}
      />
      <div className="absolute inset-x-0 top-0 z-[600] flex items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))] lg:start-[460px]">
        <button className="icon-btn glass" onClick={() => go('card')} aria-label={tr(ui, 'backToChat')} data-testid="market-back">
          <ChevronLeft size={22} className="rtl:rotate-180" />
        </button>
        <RouteChip ui={ui} />
      </div>
      {desk ? (
        <div className="glass-strong absolute bottom-4 start-4 top-4 z-[600] w-[440px] overflow-hidden rounded-[28px] shadow-card">{panel}</div>
      ) : (
        <motion.div className="glass-strong absolute inset-x-0 bottom-0 z-[600] overflow-hidden rounded-t-[28px] shadow-card" style={{ height: '58%' }} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" />
          {panel}
        </motion.div>
      )}
      <OfferSheet o={view} onClose={() => setView(null)} onAccept={(o) => (setView(null), setConfirm(o))} />
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm ? tr(ui, 'confirmTitle', { d: confirm.driver.name.split(' ')[0] }) : ''}>
        {confirm && (
          <div className="space-y-4 px-5 pb-6">
            <div className="flex items-center gap-3">
              <DriverAvatar name={confirm.driver.name} hue={confirm.driver.hue} size={52} />
              <div className="flex-1">
                <div className="font-semibold">{confirm.driver.name}</div>
                <div className="text-[13px] text-mist-300">{VEHICLES[confirm.vehicle.type].label[ui]} · {confirm.vehicle.model}</div>
              </div>
              <div className="font-display text-[22px] font-semibold" dir="ltr">
                {confirm.price} <span className="text-[13px] text-mist-300">MAD</span>
              </div>
            </div>
            <p className="text-[14px] text-mist-300">{tr(ui, 'confirmBody', { p: confirm.price })}</p>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setConfirm(null)}>
                {tr(ui, 'cancel')}
              </button>
              <button className="btn-primary flex-[2]" onClick={() => (accept(confirm), setConfirm(null))} data-testid="confirm-booking">
                <Check size={18} /> {tr(ui, 'confirm')}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function OfferFacts({ o, ui }: { o: Offer; ui: UiLang }) {
  const sched = o.pickupInMin === 0;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-mist-200">
      <span className="inline-flex items-center gap-1">
        <Clock size={13} className="text-cyan-300" />
        {sched ? tr(ui, 'pickupAt', { t: slot(o.pickupAt, ui) }) : tr(ui, 'pickupIn', { n: o.pickupInMin })}
      </span>
      <span className="inline-flex items-center gap-1">
        <PackageCheck size={13} className="text-cyan-300" />
        {tr(ui, 'deliveryAt', { t: o.deliveryAt })}
      </span>
      <span className="inline-flex items-center gap-1">
        <Users size={13} className={o.loadingHelp ? 'text-cyan-300' : 'text-mist-500'} />
        {o.loadingHelp ? tr(ui, 'helpYes', { n: o.helpers }) : tr(ui, 'helpNo')}
      </span>
    </div>
  );
}

function KindTag({ o, ui }: { o: Offer; ui: UiLang }) {
  if (o.kind === 'shared') return <span className="tag bg-indigo-500/20 text-indigo-200"><Users size={11} />{tr(ui, 'kindShared', { n: o.sharedWith })}</span>;
  if (o.kind === 'return_trip') return <span className="tag bg-emerald-500/15 text-emerald-200"><Recycle size={11} />{tr(ui, 'kindReturn', { p: o.returnTo ?? '' })}</span>;
  return <span className="tag bg-white/8 text-mist-300">{tr(ui, 'kindSolo')}</span>;
}

function OfferCard({ o, i, tags, onView, onAccept, onReject }: { o: Offer; i: number; tags: ('best' | 'fastest' | 'topRated')[]; onView: () => void; onAccept: () => void; onReject: () => void }) {
  const { ui } = useX();
  return (
    <motion.article layout className="relative overflow-hidden rounded-3xl bg-snow shadow-card p-4 ring-1 ring-[#000]/[.09]" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -60, height: 0, marginTop: 0, padding: 0 }} transition={{ ...spring, delay: i * 0.12 }} data-testid="offer">
      {tags.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="tag bg-[#000] text-snow">
              {t === 'best' ? <Sparkles size={11} /> : t === 'fastest' ? <Zap size={11} /> : '★'} {tr(ui, t)}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-start gap-3">
        <DriverAvatar name={o.driver.name} hue={o.driver.hue} size={46} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{o.driver.name}</div>
          <div className="flex items-center gap-2 text-[12.5px] text-mist-300">
            <Stars value={o.driver.rating} /> <span>· {tr(ui, 'trips', { n: o.driver.trips })}</span>
          </div>
        </div>
        <div className="text-end">
          <div className="font-display text-[24px] font-semibold leading-none" dir="ltr">
            {o.price}
          </div>
          <div className="mt-1 text-[11px] text-mist-400">{tr(ui, 'mad')}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#F6F6F6] p-2.5">
        <img src={VEHICLE_IMG[o.vehicle.type]} alt="" className="h-12 w-20 object-contain" />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium">{VEHICLES[o.vehicle.type].label[ui]}</div>
          <div className="truncate text-[12px] text-mist-400">{o.vehicle.model}</div>
        </div>
        <KindTag o={o} ui={ui} />
      </div>
      <div className="mt-3">
        <OfferFacts o={o} ui={ui} />
      </div>
      <div className="mt-3.5 flex items-center gap-2">
        <button className="btn-ghost px-2 text-rose-300 hover:text-rose-200" onClick={onReject} data-testid="reject">
          {tr(ui, 'reject')}
        </button>
        <div className="flex-1" />
        <button className="btn-glass min-h-[44px] px-4" onClick={onView} data-testid="view">
          {tr(ui, 'view')}
        </button>
        <button className="btn-primary min-h-[44px] px-5" onClick={onAccept} data-testid="accept">
          {tr(ui, 'accept')}
        </button>
      </div>
    </motion.article>
  );
}

function OfferSheet({ o, onClose, onAccept }: { o: Offer | null; onClose: () => void; onAccept: (o: Offer) => void }) {
  const { ui } = useX();
  return (
    <Sheet open={!!o} onClose={onClose} title={o?.driver.name ?? ''} label="offer">
      {o && (
        <div className="space-y-4 px-5 pb-6" data-testid="offer-sheet">
          <div className="flex items-center gap-4">
            <DriverAvatar name={o.driver.name} hue={o.driver.hue} size={64} />
            <div className="flex-1 space-y-1 text-[13.5px]">
              <div className="flex items-center gap-2">
                <Stars value={o.driver.rating} size={14} /> <span className="text-mist-300">· {tr(ui, 'trips', { n: o.driver.trips })}</span>
              </div>
              <div className="text-mist-300">
                {tr(ui, 'speaks')}: {o.driver.languages.join(', ')}
              </div>
              <div className="inline-flex items-center gap-1 text-emerald-300">
                <ShieldCheck size={14} /> {tr(ui, 'verified')}
              </div>
            </div>
          </div>
          <div className="rounded-3xl bg-[#F6F6F6] p-4">
            <img src={VEHICLE_IMG[o.vehicle.type]} alt="" className="mx-auto h-28 object-contain" />
            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="label">{tr(ui, 'vehicle')}</div>
                <div className="font-semibold">{VEHICLES[o.vehicle.type].label[ui]}</div>
                <div className="text-[12.5px] text-mist-400">
                  {o.vehicle.model} · <span dir="ltr">{o.vehicle.plateMasked}</span>
                </div>
              </div>
              <div className="text-[12.5px] text-mist-300">{tr(ui, 'capacity', { n: o.vehicle.capacityKg })}</div>
            </div>
          </div>
          <OfferFacts o={o} ui={ui} />
          <KindTag o={o} ui={ui} />
          <div className="flex items-center justify-between rounded-2xl bg-[#F3F3F3] px-4 py-3">
            <span className="text-mist-200">{tr(ui, 'offerPrice')}</span>
            <span className="font-display text-[24px] font-semibold" dir="ltr">
              {o.price} <span className="text-[13px] text-mist-300">MAD</span>
            </span>
          </div>
          <button className="btn-primary w-full" onClick={() => onAccept(o)} data-testid="sheet-accept">
            {tr(ui, 'accept')}
          </button>
        </div>
      )}
    </Sheet>
  );
}

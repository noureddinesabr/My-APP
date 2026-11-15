import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Bell, Calendar, Camera, ChevronDown, ChevronRight, Globe, Home as HomeIcon, ImagePlus, LayoutGrid, Receipt, RotateCcw, Search, Sparkles, Truck, User, Volume2 } from 'lucide-react';
import mover from '../assets/photos/movers.jpg';
import { useX, type Tab } from '../booking/store';
import { tr } from '../i18n/ui';
import { emptyStop, type VehicleType } from '../models/booking';
import { VEHICLES } from '../models/catalog';
import { placeById, placeName, toPlace } from '../models/places';
import { SAMPLE_PHOTOS, sampleToImage } from '../images/images';
import { MapView, type MapMarker } from '../map/MapView';
import { TRIP_STEPS } from '../ai/providers/demo/brain';
import { say } from '../ai/providers/demo/phrases';
import { sfx, setSound } from '../lib/sfx';
import { CameraSheet, usePhotoInput } from './PhotoInput';
import { PlaceSheet } from './Card';
import { iconOf, langOf, nameOf } from './items';
import { DriverAvatar, Sheet, VEHICLE_IMG, spring } from './ui';
import type { ChatImage } from '../ai/types';

const RIDES: { v: VehicleType; sub: 'pickupSub' | 'vanSub' | 'bigVanSub' | 'truckSub'; badge?: boolean }[] = [
  { v: 'smallVan', sub: 'vanSub', badge: true },
  { v: 'pickup', sub: 'pickupSub', badge: true },
  { v: 'largeVan', sub: 'bigVanSub' },
  { v: 'truck35', sub: 'truckSub', badge: true },
];
const SERVICES = ['home_move', 'sofa', 'fridge', 'boxes', 'cement', 'goods', 'motorbike', 'cold_food'];

/** The app shell, Uber-style: Home · Services · Activity · Account with a floating tab bar. */
export function Home() {
  const { s, d } = useX();
  const tab: Tab = s.tab ?? 'home';
  const setTab = (t: Tab) => {
    sfx.tap();
    d({ t: 'set', patch: { tab: t } });
  };
  return (
    <div className="relative h-full bg-ink-950">
      <div className="scroll-thin h-full overflow-y-auto pb-32">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {tab === 'home' && <HomeTab />}
            {tab === 'services' && <ServicesTab />}
            {tab === 'activity' && <ActivityTab />}
            {tab === 'account' && <AccountTab />}
          </motion.div>
        </AnimatePresence>
      </div>
      <TabBar tab={tab} setTab={setTab} />
    </div>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { ui, s } = useX();
  const items: [Tab, typeof HomeIcon, Parameters<typeof tr>[1]][] = [
    ['home', HomeIcon, 'tabHome'],
    ['services', LayoutGrid, 'tabServices'],
    ['activity', Receipt, 'tabActivity'],
    ['account', User, 'tabAccount'],
  ];
  const live = !!s.trip && s.trip.statusIndex < 6;
  return (
    <nav className="absolute inset-x-0 bottom-0 z-[1000] px-4 pb-[max(14px,env(safe-area-inset-bottom))]" aria-label="tabs">
      <div className="mx-auto grid max-w-md grid-cols-4 rounded-full bg-ink-950 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,.14)] ring-1 ring-[#000]/[.06]">
        {items.map(([t, Icon, label]) => {
          const on = t === tab;
          return (
            <button key={t} onClick={() => setTab(t)} className="relative flex flex-col items-center gap-0.5 rounded-full py-2 text-[12px]" data-testid={`tab-${t}`}>
              {on && <motion.span layoutId="tab-bg" className="absolute inset-0 rounded-full bg-ink-850" transition={spring} />}
              <Icon size={22} className="relative" fill={on ? 'currentColor' : 'none'} strokeWidth={on ? 1.6 : 1.8} />
              <span className={`relative ${on ? 'font-semibold text-mist-100' : 'text-mist-300'}`}>{tr(ui, label)}</span>
              {t === 'activity' && live && <span className="absolute end-5 top-1.5 h-2.5 w-2.5 rounded-full bg-locate ring-2 ring-ink-950" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="px-5 pb-4 pt-[max(18px,env(safe-area-inset-top))] text-[40px] font-bold leading-tight tracking-[-0.02em]">{children}</h1>;
}

// ------------------------------------------------------------------ Home

function HomeTab() {
  const { s, ui, d, go, setBooking } = useX();
  const [placeFor, setPlaceFor] = useState<'pickup' | 'destination' | null>(null);
  const [inbox, setInbox] = useState(false);
  const here = s.booking.pickup ?? { ...emptyStop('Casablanca'), ...toPlace(placeById('maarif')!) };
  const startWithPhotos = (imgs: ChatImage[]) => {
    sfx.select();
    setBooking((b) => (b.pickup ? b : { ...b, pickup: here }));
    d({ t: 'set', patch: { photos: imgs } });
    go('scan');
  };
  const pi = usePhotoInput(startWithPhotos);
  const ensurePickup = () => setBooking((b) => (b.pickup ? b : { ...b, pickup: here }));
  const nextAfterPlace = () => go(s.booking.cargo.items.length ? 'card' : 'scan');
  const cars = useMemo<MapMarker[]>(() => {
    const r = (n: number) => ((Math.sin(n * 91.7) + 1) / 2 - 0.5) * 0.03;
    return [
      { id: 'me', at: [here.lat!, here.lng!], kind: 'me' },
      ...[1, 2, 3, 4].map((i) => ({ id: `c${i}`, at: [here.lat! + r(i), here.lng! + r(i + 7)] as [number, number], kind: 'car' as const, rot: i * 67 })),
    ];
  }, [here.lat, here.lng]);

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center justify-between px-5 pt-[max(14px,env(safe-area-inset-top))]">
        <button className="flex items-center gap-2 text-[16px] text-mist-200" onClick={() => (sfx.tap(), setPlaceFor('pickup'))} data-testid="current-location">
          <span className="h-3.5 w-3.5 rounded-full bg-locate ring-4 ring-locate/20" />
          <span className="max-w-[60vw] truncate">{s.booking.pickup ? placeName(s.booking.pickup, langOf(ui), true) : tr(ui, 'currentLoc')}</span>
          <ChevronDown size={16} />
        </button>
        <button className="flex items-center gap-1.5 text-[16px] text-mist-200" onClick={() => (sfx.tap(), setInbox(true))}>
          <Bell size={18} /> {tr(ui, 'inbox')}
        </button>
      </div>
      <div className="pb-5 pt-3 text-center text-[40px] font-extrabold tracking-[-0.04em]" dir="ltr">
        X
      </div>

      {/* Where to? */}
      <div className="px-5">
        <div className="flex items-center gap-2 rounded-full bg-ink-950 p-2 ps-5 shadow-[0_2px_12px_rgba(0,0,0,.08)] ring-1 ring-[#000]/[.08]">
          <Search size={22} />
          <button className="h-12 flex-1 text-start text-[19px] text-mist-300" onClick={() => (sfx.tap(), ensurePickup(), setPlaceFor('destination'))} data-testid="where-to">
            {s.booking.destination ? placeName(s.booking.destination, langOf(ui), true) : tr(ui, 'whereTo')}
          </button>
          <button
            className="flex h-12 items-center gap-2 rounded-full bg-ink-850 px-4 text-[16px] font-medium"
            onClick={() => {
              const t = new Date(Date.now() + 86400000);
              setBooking((b) => ({ ...b, pickup: b.pickup ?? here, schedule: { ...b.schedule, mode: 'scheduled', date: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`, time: '10:00' } }));
              sfx.tap();
              setPlaceFor('destination');
            }}
          >
            <Calendar size={18} /> {tr(ui, 'later')}
          </button>
        </div>
      </div>

      {/* AI photo card */}
      <section className="mx-5 mt-5 overflow-hidden rounded-[22px] bg-[#000] text-snow" data-testid="photo-card">
        <div className="relative h-[230px]">
          <img src={mover} alt="" className="kenburns absolute inset-0 h-full w-full object-cover" style={{ filter: 'grayscale(1) contrast(1.05) brightness(.8)', objectPosition: '35% 50%' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#000] via-[#000]/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="text-[26px] font-bold leading-tight tracking-[-0.01em]">{tr(ui, 'heroTitle')}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[14px] text-snow/75">
              <Sparkles size={14} /> {tr(ui, 'snapSub')}
            </div>
          </div>
        </div>
        <div className="flex gap-2 p-3 pt-1">
          <button className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-snow text-[16px] font-semibold text-[#000] active:scale-[.98]" onClick={() => (sfx.tap(), pi.openCamera())} data-testid="take-photo">
            <Camera size={19} /> {tr(ui, 'takePhoto')}
          </button>
          <button className="flex h-12 items-center justify-center gap-2 rounded-full bg-snow/15 px-4 text-[15px] font-medium text-snow active:scale-[.98]" onClick={() => (sfx.tap(), pi.openGallery())} data-testid="gallery" aria-label={tr(ui, 'gallery')}>
            <ImagePlus size={19} /> {tr(ui, 'galleryShort')}
          </button>
        </div>
        <button className="w-full border-t border-snow/10 py-3 text-[13px] text-snow/70" onClick={async () => startWithPhotos([await sampleToImage(SAMPLE_PHOTOS[0].id)])} data-testid="sample-photo">
          <Sparkles size={13} className="me-1 inline" /> {tr(ui, 'samplePhotos')}
        </button>
      </section>

      {/* map card */}
      <section className="relative mx-5 mt-5 h-[300px] overflow-hidden rounded-[22px] ring-1 ring-[#000]/[.08]" data-testid="map-card">
        <MapView from={[here.lat!, here.lng!]} to={null} markers={cars} padding={[20, 20, 90, 20]} offlineLabel={tr(ui, 'mapFallback')} approxLabel="" />
        <span className="tag absolute start-3 top-3 z-[500] bg-snow/90 text-mist-300">{tr(ui, 'sampleTag')}</span>
        <div className="absolute inset-x-0 bottom-0 z-[500] flex items-center gap-3 bg-gradient-to-t from-snow via-snow/95 to-transparent p-4 pt-10">
          <div className="flex-1 text-[19px] font-bold leading-tight">{tr(ui, 'truckAway', { n: 4 })}</div>
          <button className="flex h-12 items-center gap-2 rounded-full bg-[#000] px-5 text-[16px] font-semibold text-snow active:scale-[.97]" onClick={() => (sfx.select(), ensurePickup(), go('scan'))} data-testid="request">
            <Truck size={19} /> {tr(ui, 'requestBtn')}
          </button>
        </div>
      </section>

      {/* vehicles */}
      <h2 className="px-5 pb-3 pt-7 text-[24px] font-bold tracking-[-0.01em]">{tr(ui, 'bookFirst')}</h2>
      <div className="flex gap-3 overflow-x-auto px-5 pb-2" data-testid="rides">
        {RIDES.map((r) => (
          <motion.button key={r.v} whileTap={{ scale: 0.97 }} onClick={() => (sfx.select(), setBooking((b) => ({ ...b, pickup: b.pickup ?? here, vehicle: { ...b.vehicle, required: r.v } })), go('scan'))} className="w-[200px] shrink-0 rounded-[18px] bg-ink-900 p-3.5 text-start ring-1 ring-[#000]/[.06]">
            {r.badge ? <span className="rounded-md bg-locate/10 px-1.5 py-0.5 text-[12px] font-medium text-locate">{tr(ui, 'popular')}</span> : <span className="block h-[22px]" />}
            <img src={VEHICLE_IMG[r.v]} alt="" className="mx-auto my-2 h-20 object-contain" />
            <div className="text-[18px] font-bold">{VEHICLES[r.v].label[ui]}</div>
            <div className="text-[14px] text-mist-300">{tr(ui, r.sub)}</div>
          </motion.button>
        ))}
      </div>

      {pi.inputs}
      <CameraSheet open={pi.liveCam} onClose={pi.closeLiveCam} onPhotos={startWithPhotos} onPickFile={pi.pickFile} ui={ui} />
      <PlaceSheet
        ui={ui}
        role={placeFor}
        onClose={() => setPlaceFor(null)}
        onPick={(g) => {
          const role = placeFor!;
          sfx.select();
          setBooking((b) => ({ ...b, [role]: { ...emptyStop(g.city), ...toPlace(g) } }));
          setPlaceFor(null);
          if (role === 'destination') setTimeout(nextAfterPlace, 150);
        }}
      />
      <Sheet open={inbox} onClose={() => setInbox(false)} title={tr(ui, 'inbox')}>
        <p className="px-5 pb-8 text-mist-300">{tr(ui, 'inboxEmpty')}</p>
      </Sheet>
    </div>
  );
}

// ------------------------------------------------------------------ Services

function ServicesTab() {
  const { ui, go, setBooking } = useX();
  return (
    <div className="mx-auto max-w-lg">
      <PageTitle>{tr(ui, 'tabServices')}</PageTitle>
      <p className="-mt-2 px-5 pb-4 text-[16px] text-mist-300">{tr(ui, 'servicesHint')}</p>
      <div className="grid grid-cols-2 gap-3 px-5">
        {SERVICES.map((k, i) => {
          const Icon = iconOf(k);
          return (
            <motion.button key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.96 }} onClick={() => (sfx.select(), setBooking((b) => ({ ...b, pickup: b.pickup ?? { ...emptyStop('Casablanca'), ...toPlace(placeById('maarif')!) }, cargo: { ...b.cargo, items: [{ key: k, qty: 1 }], images: [] } })), go('scan'))} className="flex h-[118px] flex-col justify-between rounded-[18px] bg-ink-900 p-4 text-start ring-1 ring-[#000]/[.06]" data-testid={`service-${k}`}>
              <Icon size={34} strokeWidth={1.5} />
              <span className="text-[16px] font-semibold" dir="auto">{nameOf({ key: k, qty: 1 }, ui)}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Activity

function ActivityTab() {
  const { s, ui, go, d } = useX();
  const trip = s.trip;
  const live = trip && trip.statusIndex < 6;
  const lang = langOf(ui);
  const card = trip && (
    <button onClick={() => (sfx.tap(), go('trip'))} className="flex w-full items-center gap-3 rounded-[18px] p-4 text-start ring-1 ring-[#000]/[.08]" data-testid="activity-trip">
      <DriverAvatar name={trip.offer.driver.name} hue={trip.offer.driver.hue} size={48} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] font-semibold" dir="auto">
          {s.booking.pickup ? placeName(s.booking.pickup, lang, true) : ''} → {s.booking.destination ? placeName(s.booking.destination, lang, true) : ''}
        </div>
        <div className="text-[14px] text-mist-300">
          {say(lang, TRIP_STEPS[trip.statusIndex])} · {trip.offer.price} MAD
        </div>
      </div>
      <ChevronRight size={20} className="text-mist-400 rtl:rotate-180" />
    </button>
  );
  return (
    <div className="mx-auto max-w-lg px-5">
      <h1 className="pb-5 pt-[max(18px,env(safe-area-inset-top))] text-[40px] font-bold tracking-[-0.02em]">{tr(ui, 'tabActivity')}</h1>
      <h2 className="pb-3 text-[24px] font-bold">{tr(ui, 'upcoming')}</h2>
      {live ? (
        card
      ) : (
        <button onClick={() => (sfx.tap(), d({ t: 'set', patch: { tab: 'home' } }))} className="flex w-full items-center gap-3 rounded-[18px] p-5 text-start ring-1 ring-[#000]/[.08]">
          <div className="flex-1">
            <div className="text-[22px] font-bold leading-tight">{tr(ui, 'noUpcoming')}</div>
            <div className="mt-1.5 flex items-center gap-1 text-[16px] text-mist-300">
              {tr(ui, 'bookMove')} <ArrowRight size={16} className="rtl:rotate-180" />
            </div>
          </div>
          <Calendar size={54} strokeWidth={1.2} className="text-mist-400" />
        </button>
      )}
      <h2 className="pb-3 pt-8 text-[24px] font-bold">{tr(ui, 'past')}</h2>
      {trip && !live ? card : <p className="text-[18px] text-mist-200">{tr(ui, 'noPast')}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ Account

function AccountTab() {
  const { s, ui, setPrefs, reset } = useX();
  const sound = s.prefs.sound !== false;
  const langs: ['auto' | 'en' | 'fr' | 'ar', string][] = [['auto', tr(ui, 'auto')], ['en', 'EN'], ['fr', 'FR'], ['ar', 'ع']];
  return (
    <div className="mx-auto max-w-lg px-5">
      <div className="flex items-center justify-between pb-6 pt-[max(18px,env(safe-area-inset-top))]">
        <h1 className="text-[40px] font-bold tracking-[-0.02em]">{tr(ui, 'guest')}</h1>
        <div className="grid h-16 w-16 place-items-center rounded-full bg-ink-850">
          <User size={30} />
        </div>
      </div>
      <div className="divide-y divide-[#000]/[.06] rounded-[18px] ring-1 ring-[#000]/[.08]">
        <div className="flex items-center gap-3 p-4">
          <Globe size={20} />
          <span className="flex-1 text-[16px]">{tr(ui, 'language')}</span>
          <div className="flex gap-1">
            {langs.map(([v, l]) => (
              <button key={v} onClick={() => (sfx.tap(), setPrefs({ ui: v }))} className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${s.prefs.ui === v ? 'bg-[#000] text-snow' : 'bg-ink-850'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <button className="flex w-full items-center gap-3 p-4 text-start" onClick={() => (setSound(!sound), setPrefs({ sound: !sound }))} role="switch" aria-checked={sound}>
          <Volume2 size={20} />
          <span className="flex-1 text-[16px]">{tr(ui, 'sounds')}</span>
          <span className={`relative h-7 w-12 rounded-full transition ${sound ? 'bg-[#000]' : 'bg-ink-700'}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-snow shadow transition-all ${sound ? 'start-[22px]' : 'start-0.5'}`} />
          </span>
        </button>
        <button className="flex w-full items-center gap-3 p-4 text-start" onClick={() => (sfx.tap(), reset())} data-testid="start-over">
          <RotateCcw size={20} />
          <span className="flex-1 text-[16px]">{tr(ui, 'startOver')}</span>
        </button>
      </div>
      <p className="px-1 pt-4 text-[13px] leading-relaxed text-mist-400">{tr(ui, 'aiDemoLong')}</p>
    </div>
  );
}

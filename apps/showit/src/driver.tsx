import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, TextInput, View } from 'react-native';

import { ChatButton } from './tabs';
import { HelpButton } from './help';
import { setPage, setTripOnScreen } from './where';
import { Avatar, PersonSheet, type Person } from './people';
import { autoDir, fieldDir } from './composer';
import { useT, type Key } from './i18n';
import { Confirm, dh, fmtKm, LoadDrawing, loadOf, OngoingCard, PhotoStrip, Steps, VehiclePicker, VehicleRow, vName } from './shared';
import { useBack } from './back';
import { onHome, onOpenTrip, openTab } from './home';
import { play } from './sounds';
import { addOffer, appMessage, companionAt, driverAutoMessage, isLive, notify, patchRequest, setStage, update, useStore, type Request, type TripPlan } from './store';
import { CancelSheet, countdown, Sheet, TripPhotos, useLoadingTimer } from './trip';
import { misfit, onWay, PlanSheet, RulesPage, workDone, WorkSetup } from './work';
import { SignUp, signupDone } from './signup';
import { PriceEditor } from './customer';
import { Btn, Card, LiveDot, Pill, T, tap, useColors, VoicePlayer } from './ui';
import { getPlace } from './lib/places';
import { setMapTrip, setMapVehicle, useMyLocation } from './map/trip';
import { formatWhen } from './wheels';
import { fmtKg } from './scan';

type TFn = ReturnType<typeof useT>['t'];

const ago = (t: TFn, at: number) => {
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  return m < 1 ? t('justNow') : m < 60 ? t('minAgo', { n: m }) : t('hAgo', { n: Math.round(m / 60) });
};

/** The details a driver needs at a glance: goods, weight, when, distance, helpers and notes. */
function Facts({ req, withPrice }: { req: Request; withPrice?: boolean }) {
  const { t, lang } = useT();
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {/* What to carry, in full (wraps inside the card, never past its edge). */}
      <View style={{ width: '100%', backgroundColor: c.raised, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
        <T size={14} weight="semibold" numberOfLines={4}>
          {loadOf(req, t) || (req.goods ? t(`g_${req.goods}` as Key) : '')}
        </T>
      </View>
      {req.weightKg ? <Pill>{t('kgEstimate', { kg: fmtKg(req.weightKg, lang) })}</Pill> : null}
      {req.floor ? <Pill>{t('floorN', { n: req.floor })}</Pill> : null}
      <Pill>{formatWhen(req.when, lang, t)}</Pill>
      {req.km ? <Pill>{`≈ ${fmtKm(req.km, lang)}`}</Pill> : null}
      {withPrice ? <Pill tone="ok">{t('cash', { price: dh(req.price, lang) })}</Pill> : null}
      {req.helpers ? <Pill tone="warn">{req.helpers === 1 ? t('oneHelper') : t('helpersNeeded', { n: req.helpers })}</Pill> : null}
      {/* Shared (he may take other loads on the way) or private: always said (round 7). Long, so full lines that wrap. */}
      <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: req.shared ? c.okSoft : c.raised, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
        <T size={13} weight="bold" color={req.shared ? c.ok : c.fg} style={{ flex: 1 }}>
          {req.shared ? t('drvShared') : t('drvPrivate')}
        </T>
      </View>
      {req.companion ? (
        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: c.raised, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Ionicons name="person-outline" size={15} color={c.accent} style={{ marginTop: 2 }} />
          <T size={13} weight="semibold" style={{ flex: 1 }}>
            {companionLine(req, t)}
          </T>
        </View>
      ) : req.riderOther ? (
        <Pill>{t('ridesOther')}</Pill>
      ) : req.rideAlong ? (
        <Pill>{t('ridesAlong')}</Pill>
      ) : null}
      {(req.noteTags ?? []).map((n) => (
        <Pill key={n} tone="warn">
          {t(`n_${n}` as Key)}
        </Pill>
      ))}
    </View>
  );
}

/**
 * Who the driver meets (round 8): the customer or someone they send, riding along or waiting at the
 * destination, and who pays. The other person's name and phone are never shown to the driver.
 */
export function companionLine(req: Request, t: TFn) {
  const cp = req.companion;
  if (!cp?.who) return '';
  // Round 9: one or more places (at the pickup, riding with you, waiting at the destination), then who pays.
  const pays = cp.pays === 'them' ? (cp.who === 'none' ? t('compDrvSomeonePays2') : t('compDrvSentPays')) : t('compDrvPaysMe');
  if (cp.who === 'none') return `${t('compDrvNone')} · ${pays}`;
  const at = companionAt(cp)
    .map((k) => t(k === 'pickup' ? 'compDrvAtPickup' : k === 'rides' ? 'compDrvAtRides' : 'compDrvAtWaits'))
    .join(' · ');
  const who = cp.who === 'me' ? t('compDrvWhoMe') : t('compDrvWhoSent');
  const head = at ? `${who}: ${at}` : who;
  return cp.who === 'me' ? head : `${head} · ${pays}`;
}

/** How an announced trip reads: when he leaves, and when he comes back. */
function planWhen(p: TripPlan, t: TFn, lang: 'en' | 'fr' | 'ar') {
  const go = p.go ? formatWhen(p.go, lang, t) : t(p.day === 'tomorrow' ? 'dayTomorrow' : p.day === 'after' ? 'dayAfter' : 'dayToday');
  return p.back ? `${go} · ${t('planBackOn', { when: p.backWhen ? formatWhen(p.backWhen, lang, t) : t('planBackSoon') })}` : go;
}

export function DriverSide() {
  const store = useStore();
  const { t, route } = useT();
  const me = store.driver;
  const mine = (r: Request) => !r.driverIsExample && !!me.name && r.driverName === me.name;
  const job = store.requests.find((r) => mine(r) && isLive(r.stage));
  // Opens on the loads page; a job in progress is one tap away, and opens by itself only when new.
  const [jobOpen, setJobOpen] = useState(false);
  const seenJob = useRef(job?.id);
  useEffect(() => {
    if (job?.id && job.id !== seenJob.current) setJobOpen(true);
    seenJob.current = job?.id;
  }, [job?.id]);
  const showingJob = !!job && jobOpen;
  const pageName = showingJob ? `job:${job?.stage}` : !signupDone(me) ? 'signup' : !workDone(me.work) ? 'work' : !me.rulesAt ? 'rules' : 'loads';
  useEffect(() => setPage(`driver · ${pageName}`), [pageName]);
  useEffect(() => setTripOnScreen(showingJob && job ? job.id : ''), [showingJob, job?.id]);
  useBack(showingJob, () => setJobOpen(false));
  // A tapped notification opens the job in progress.
  useEffect(() => onOpenTrip(() => job && setJobOpen(true)));
  // The X logo: back to the loads page.
  useEffect(() => onHome(() => setJobOpen(false)), []);
  // The map behind the screen shows the driver's current job; otherwise his own position (round 8:
  // an announced trip is a plan, not where he is).
  const from = getPlace(showingJob ? job?.fromPlaceId : undefined);
  const to = getPlace(showingJob ? job?.toPlaceId : undefined);
  useEffect(() => {
    setMapTrip({ from: from ? { lat: from.lat, lng: from.lng } : undefined, to: to ? { lat: to.lat, lng: to.lng } : undefined });
  }, [from, to]);

  // First time (rounds 7–8): sign-up (photo, phone, vehicle, papers), the work questions, the rules.
  if (!signupDone(me)) return <SignUp />;
  if (!workDone(me.work)) return <WorkSetup />;
  if (!me.rulesAt) return <RulesPage />;
  if (showingJob && job) return <Job req={job} />;
  return (
    <View style={{ gap: 14 }}>
      <StatusCard />
      {job ? <OngoingCard title={t('jobNow')} line={route(job.from.split(/[,،]/)[0], job.to.split(/[,،]/)[0])} status={t(`st_${job.stage}` as Key)} onOpen={() => setJobOpen(true)} /> : null}
      <PlanTiles />
      <Loads />
    </View>
  );
}

/** Online / offline (round 8): a coloured card with a switch; offline receives no new loads. */
function StatusCard() {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const me = store.driver;
  const on = me.online !== false;
  return (
    <View style={{ marginTop: 6, borderRadius: 22, padding: 14, backgroundColor: on ? '#0F766E' : c.raised, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Avatar name={me.name} uri={me.photoUri} size={46} />
      <View style={{ flex: 1, gap: 2 }}>
        <T size={17} weight="heavy" color={on ? '#FFFFFF' : c.fg}>
          {on ? t('youOnline') : t('youOffline')}
        </T>
        <T size={12} color={on ? 'rgba(255,255,255,0.85)' : c.muted} numberOfLines={2}>
          {on ? `${me.name} · ${vName(t, me.vehicle)}` : t('offlineShort')}
        </T>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel={on ? t('youOnline') : t('youOffline')}
        onPress={() => {
          tap();
          play(on ? 'pop' : 'success');
          update((s) => ({ ...s, driver: { ...s.driver, online: !on } }));
        }}
        style={{ width: 58, height: 34, borderRadius: 17, padding: 3, backgroundColor: on ? 'rgba(255,255,255,0.35)' : c.line, direction: 'ltr', alignItems: on ? 'flex-end' : 'flex-start', justifyContent: 'center' }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF' }} />
      </Pressable>
    </View>
  );
}

/** Announcing a trip, apart from the loads (round 8): a clear coloured tile, and the trips announced. */
function PlanTiles() {
  const { t, lang, route } = useT();
  const store = useStore();
  const plans = store.driver.plans ?? [];
  const [editing, setEditing] = useState<TripPlan | 'new' | null>(null);
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tap();
          setEditing('new');
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 14, backgroundColor: '#1D4ED8', opacity: pressed ? 0.9 : 1 })}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="megaphone" size={22} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <T size={16} weight="heavy" color="#FFFFFF">
            {t('plansTitle')}
          </T>
          <T size={12} color="rgba(255,255,255,0.85)">
            {t('plansSub')}
          </T>
        </View>
        <Ionicons name="add-circle" size={28} color="#FFFFFF" />
      </Pressable>
      {plans.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`${route(p.from.split(/[,،]/)[0], p.to.split(/[,،]/)[0])}. ${t('edit')}`}
          onPress={() => {
            tap();
            setEditing(p);
          }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12, backgroundColor: '#DBEAFE', opacity: pressed ? 0.9 : 1 })}>
          <Ionicons name={p.back ? 'swap-horizontal' : 'arrow-forward'} size={18} color="#1D4ED8" />
          <View style={{ flex: 1 }}>
            <T size={14} weight="heavy" color="#1E3A8A" numberOfLines={2}>
              {route(p.from.split(/[,،]/)[0], p.to.split(/[,،]/)[0])}
            </T>
            <T size={12} color="#1E40AF">
              {planWhen(p, t, lang)}
            </T>
          </View>
          <T size={13} weight="bold" color="#1D4ED8">
            {t('edit')}
          </T>
        </Pressable>
      ))}
      <PlanSheet plan={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function Loads() {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const day = Date.now() - 36 * 3600 * 1000;
  const all = store.requests.filter((r) => r.stage === 'open' && r.createdAt > day);
  // Only loads that fit him (vehicle, helpers, area), loads on his announced trips first (round 7).
  const [showAll, setShowAll] = useState(false);
  const plans = store.driver.plans ?? [];
  const fit = all.filter((r) => !misfit(r, store.driver));
  const hidden = all.length - fit.length;
  const rank = (r: Request) => (onWay(r, plans) ? 0 : 1);
  const open = [...(showAll ? all : fit)].sort((a, b) => rank(a) - rank(b));
  if (store.driver.online === false)
    return (
      <Card style={{ alignItems: 'center', gap: 6 }}>
        <Ionicons name="moon-outline" size={26} color={c.muted} />
        <T weight="heavy">{t('offlineTitle')}</T>
        <T size={13} muted style={{ textAlign: 'center' }}>
          {t('offlineSub')}
        </T>
      </Card>
    );
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <T size={19} weight="heavy" style={{ flex: 1 }}>
          {t('loadsForYou')}
        </T>
        <View style={{ minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 8, backgroundColor: open.length ? '#D97706' : c.raised, alignItems: 'center', justifyContent: 'center' }}>
          <T size={14} weight="heavy" color={open.length ? '#FFFFFF' : c.muted}>
            {String(open.length)}
          </T>
        </View>
      </View>
      {open.map((r) => (
        <LoadCard key={r.id} req={r} />
      ))}
      {hidden ? (
        <Pressable accessibilityRole="button" onPress={() => setShowAll(!showAll)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <T size={14} weight="bold" color={c.accent}>
            {showAll ? t('fitHide') : hidden === 1 ? t('fitShowOne') : t('fitShow', { n: hidden })}
          </T>
        </Pressable>
      ) : null}
      {!open.length ? (
        <Card style={{ alignItems: 'center' }}>
          <T weight="bold">{t('noLoads')}</T>
          <T muted size={14} style={{ textAlign: 'center' }}>
            {t('noLoadsSub')}
          </T>
        </Card>
      ) : null}
    </View>
  );
}

function LoadCard({ req }: { req: Request }) {
  const c = useColors();
  const { t, lang, route } = useT();
  const store = useStore();
  const myOffer = store.offers.find((o) => o.id === `${req.id}_me`);
  // A job with helpers: one check right before the offer goes (round 7), never a repeated rule.
  const [askHelpers, setAskHelpers] = useState<number | null>(null);
  const send = (price: number) => {
    play('send');
    addOffer({ id: `${req.id}_me`, requestId: req.id, driverName: store.driver.name, vehicle: store.driver.vehicle, price, createdAt: Date.now(), example: false });
  };
  const offer = (price: number) => (req.helpers ? setAskHelpers(price) : send(price));
  const way = onWay(req, store.driver.plans ?? []);
  const why = misfit(req, store.driver);
  const work = store.driver.work;
  const helperCost = req.helpers && work?.helpers === 'yes' && work.helperPrice ? req.helpers * work.helperPrice : 0;
  const [pricing, setPricing] = useState<number | null>(null);
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 24, overflow: 'hidden', borderWidth: way ? 2 : 1, borderColor: way ? '#1D4ED8' : c.line }}>
      {/* Round 8: the route and the price first, in a coloured band, then the photo and the details. */}
      <View style={{ backgroundColor: '#13141A', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={17} weight="heavy" color="#FFFFFF" numberOfLines={2}>
            {route(req.from.split(/[,،]/)[0], req.to.split(/[,،]/)[0])}
          </T>
          <T size={12} color="rgba(255,255,255,0.75)" numberOfLines={1}>
            {[formatWhen(req.when, lang, t), req.km ? `≈ ${fmtKm(req.km, lang)}` : ''].filter(Boolean).join(' · ')}
          </T>
        </View>
        <View style={{ backgroundColor: '#16A34A', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' }}>
          <T size={18} weight="heavy" color="#FFFFFF">
            {dh(req.price, lang)}
          </T>
          <T size={10} color="rgba(255,255,255,0.9)">
            {t('cashShort')}
          </T>
        </View>
      </View>
      <View style={{ height: 150, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
        {req.photoUri ? <Image source={{ uri: req.photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <LoadDrawing scale={0.7} />}
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        {way ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: c.liveSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Ionicons name="trail-sign" size={14} color={c.live} />
            <T size={12} weight="heavy" color={c.live}>
              {way === 'go' ? t('onYourWay') : t('onYourWayBack')}
            </T>
          </View>
        ) : null}
        {why ? (
          <T size={12} weight="bold" color={c.warn}>
            {t(why)}
          </T>
        ) : null}
        <CustomerRow />
        <T size={13} muted>
          {route(req.from, req.to)}
        </T>
        {req.voiceUri ? <VoicePlayer uri={req.voiceUri} ms={req.voiceMs} label={t('customerVoice')} /> : null}
        {(req.noteVoices ?? []).map((v, i) => (
          <VoicePlayer key={v.uri + i} uri={v.uri} ms={v.ms} label={t('customerVoice')} />
        ))}
        {req.notePhotos?.length ? <PhotoStrip uris={req.notePhotos} /> : null}
        {(req.noteFiles ?? []).map((f, i) => (
          <Pressable key={f.uri + i} accessibilityRole="button" onPress={() => Linking.openURL(f.uri).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.raised, borderRadius: 14, padding: 10 }}>
            <Ionicons name="document-attach-outline" size={20} color={c.accent} />
            <T size={14} weight="bold" numberOfLines={1} style={{ flex: 1 }}>
              {f.name || t('fileShort')}
            </T>
          </Pressable>
        ))}
        {req.said ? (
          <View style={{ backgroundColor: c.raised, borderRadius: 14, padding: 12 }}>
            <T size={15}>“{req.said}”</T>
          </View>
        ) : null}
        <Facts req={req} />
        <VehicleRow id={req.vehicle} any={req.anyVehicle} note={req.anyVehicle ? t('anyVehicleDriver') : t('customerAsked')} />
        {req.notes ? (
          <T size={14} muted>
            {req.notes}
          </T>
        ) : null}
        <T size={13} muted>
          {t('postedKeep', { ago: ago(t, req.createdAt), keep: dh(Math.round(req.price * 0.9), lang) })}
        </T>
        {myOffer ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <LiveDot />
            <T weight="bold" color={c.live} style={{ flex: 1 }}>
              {t('offerSent', { price: dh(myOffer.price, lang) })}
            </T>
          </View>
        ) : null}
        {helperCost ? (
          <View style={{ flexDirection: 'row', gap: 6, backgroundColor: c.raised, borderRadius: 14, padding: 10 }}>
            <Ionicons name="people-outline" size={16} color={c.warn} />
            <T size={13} style={{ flex: 1 }}>
              {t('helperCostLine', { n: req.helpers, each: dh(work?.helperPrice ?? 0, lang), total: dh(helperCost, lang) })}
            </T>
          </View>
        ) : null}
        {/* Accept the customer's price, or offer another one (− / + / type it), round 8. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('accept', { price: dh(req.price, lang) })}
          onPress={() => {
            tap();
            offer(req.price);
          }}
          style={({ pressed }) => ({ minHeight: 54, borderRadius: 16, backgroundColor: '#16A34A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.88 : 1 })}>
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <T size={16} weight="heavy" color="#FFFFFF">
            {t('accept', { price: dh(req.price, lang) })}
          </T>
        </Pressable>
        <Btn title={t('offerOtherPrice')} kind="ghost" icon="create-outline" onPress={() => setPricing(myOffer?.price ?? req.price)} />
        <Sheet visible={pricing !== null} onClose={() => setPricing(null)} title={t('offerOtherPrice')}>
          {pricing !== null ? (
            <View style={{ gap: 14 }}>
              <T muted>{t('offerOtherBody', { price: dh(req.price, lang) })}</T>
              <PriceEditor price={pricing} onChange={setPricing} />
              {helperCost ? (
                <T size={13} color={c.warn}>
                  {t('helperCostLine', { n: req.helpers, each: dh(work?.helperPrice ?? 0, lang), total: dh(helperCost, lang) })}
                </T>
              ) : null}
              <Btn
                title={t('sendMyOffer', { price: dh(pricing, lang) })}
                icon="paper-plane"
                onPress={() => {
                  const p = pricing;
                  setPricing(null);
                  offer(p);
                }}
              />
            </View>
          ) : null}
        </Sheet>
        <Confirm
          visible={askHelpers !== null}
          title={req.helpers === 1 ? t('helpersAskTitle1') : t('helpersAskTitle', { n: req.helpers })}
          body={req.helpers === 1 ? t('helpersAskBody1') : t('helpersAskBody', { n: req.helpers })}
          yes={t('helpersAskYes')}
          onNo={() => setAskHelpers(null)}
          onYes={() => {
            const p = askHelpers;
            setAskHelpers(null);
            if (p !== null) send(p);
          }}
        />
      </View>
    </View>
  );
}

function Job({ req }: { req: Request }) {
  const c = useColors();
  const { t, lang } = useT();
  const [cancel, setCancel] = useState(false);
  const toDrop = req.stage === 'loaded' || req.stage === 'dropoff';
  const going = toDrop ? req.to : req.from;
  const scheduled = req.stage === 'accepted' && req.when !== 'now';
  const needsTake = req.stage === 'accepted' && !req.takenAt;
  const loading = useLoadingTimer(req);
  // The phone's GPS: the driver's dot on the map, shared with the customer while on the move.
  const me = useMyLocation();
  const lastShared = useRef(0);
  useEffect(() => {
    setMapVehicle(me && req.stage !== 'accepted' ? me : null);
    if (!me || !['enroute', 'arrived', 'loaded', 'dropoff'].includes(req.stage)) return;
    if (Date.now() - lastShared.current < 15000) return;
    lastShared.current = Date.now();
    patchRequest(req.id, { driverPos: { lat: me.lat, lng: me.lng, at: Date.now() } });
  }, [me, req.stage, req.id]);
  useEffect(() => () => setMapVehicle(null), []);
  // Arriving and leaving are noticed from the GPS: near the pickup the arrival is confirmed after a
  // short stay; driving away from it with the load switches to "on the way".
  const pickup = getPlace(req.fromPlaceId);
  const dist = me && pickup ? kmBetween(me, pickup) : null;
  const atPickup = req.stage === 'enroute' && dist !== null && dist < 0.15;
  useEffect(() => {
    if (!atPickup) return;
    const timer = setTimeout(() => setStage(req.id, 'arrived'), 45000);
    return () => clearTimeout(timer);
  }, [atPickup, req.id]);
  useEffect(() => {
    if (req.stage === 'arrived' && dist !== null && dist > 0.4) setStage(req.id, 'loaded');
  }, [req.stage, dist, req.id]);
  // The same at the destination (round 7, no delivery code): a short stay there is "arrived";
  // driving away without tapping "handed over" makes the app ask him once.
  const drop = getPlace(req.toPlaceId);
  const dropDist = me && drop ? kmBetween(me, drop) : null;
  const atDrop = req.stage === 'loaded' && dropDist !== null && dropDist < 0.15;
  useEffect(() => {
    if (!atDrop) return;
    const timer = setTimeout(() => setStage(req.id, 'dropoff'), 45000);
    return () => clearTimeout(timer);
  }, [atDrop, req.id]);
  const asked = useRef(false);
  useEffect(() => {
    if (req.stage === 'dropoff' && dropDist !== null && dropDist > 0.4 && !asked.current) {
      asked.current = true;
      notify('driver', 'nt_handedAsk', 'step', undefined, undefined, req.id);
    }
  }, [req.stage, dropDist, req.id]);
  const handOver = () => {
    play('celebrate');
    setStage(req.id, 'delivered');
  };
  const payer = req.companion?.pays === 'them' ? (req.companion.who === 'none' ? t('someoneAtDropoff') : t('thePersonWithYou')) : t('theCustomer');
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <LiveDot />
        <T weight="bold" color={c.live}>
          {req.stage === 'dropoff' ? t('atDropoff') : toDrop ? t('goingDropoff') : t('goingPickup')}
        </T>
      </View>
      <T size={28} weight="heavy">
        {going}
      </T>
      <Card>
        <CustomerRow />
        {req.photoUri ? <Image source={{ uri: req.photoUri }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }} resizeMode="cover" /> : null}
        {(req.photoUris?.length ?? 0) > 1 ? <PhotoStrip uris={req.photoUris!.slice(1)} /> : null}
        {req.voiceUri ? <VoicePlayer uri={req.voiceUri} ms={req.voiceMs} label={t('customerVoice')} /> : null}
        {(req.noteVoices ?? []).map((v, i) => (
          <VoicePlayer key={v.uri + i} uri={v.uri} ms={v.ms} label={t('customerVoice')} />
        ))}
        {req.notePhotos?.length ? <PhotoStrip uris={req.notePhotos} /> : null}
        {(req.noteFiles ?? []).map((f, i) => (
          <Pressable key={f.uri + i} accessibilityRole="button" onPress={() => Linking.openURL(f.uri).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.raised, borderRadius: 14, padding: 10 }}>
            <Ionicons name="document-attach-outline" size={20} color={c.accent} />
            <T size={14} weight="bold" numberOfLines={1} style={{ flex: 1 }}>
              {f.name || t('fileShort')}
            </T>
          </Pressable>
        ))}
        <Facts req={req} withPrice />
        {req.notes ? (
          <T size={14} muted>
            {req.notes}
          </T>
        ) : null}
        <Steps stage={req.stage} side="driver" />
        <Btn title={t('directions')} kind="ghost" icon="navigate" small onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(going)}`).catch(() => {})} />
      </Card>
      {/* Round 8: the customer accepted; the driver must confirm he takes the trip, first of all. */}
      {needsTake ? (
        <View style={{ borderRadius: 22, padding: 16, gap: 10, backgroundColor: '#FEF3C7', borderWidth: 2, borderColor: '#D97706' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="alert-circle" size={22} color="#B45309" />
            <T size={17} weight="heavy" color="#78350F" style={{ flex: 1 }}>
              {t('takeTitle')}
            </T>
          </View>
          <T size={14} color="#78350F">
            {t('takeBody', { when: formatWhen(req.when, lang, t), price: dh(req.price, lang) })}
          </T>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tap();
              play('success');
              patchRequest(req.id, { takenAt: Date.now() });
              driverAutoMessage(req.id, 'drvAuto_taken');
              notify('customer', 'nt_taken', 'success', { name: req.driverName ?? '' }, undefined, req.id);
            }}
            style={({ pressed }) => ({ minHeight: 54, borderRadius: 16, backgroundColor: '#16A34A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.88 : 1 })}>
            <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
            <T size={16} weight="heavy" color="#FFFFFF">
              {t('takeYes')}
            </T>
          </Pressable>
          <Btn title={t('takeNo')} kind="ghost" small onPress={() => setCancel(true)} />
        </View>
      ) : null}
      {scheduled && !needsTake ? (
        <Card>
          <T weight="heavy">{t('bookedFor', { when: formatWhen(req.when, lang, t) })}</T>
          <T size={13} muted>
            {countdown(req, t)}
          </T>
          {req.driverConfirmedAt ? (
            <T size={14} weight="bold" color={c.ok}>
              {`✓ ${t('youConfirmed')}`}
            </T>
          ) : (
            <Btn
              title={t('confirmComing')}
              icon="checkmark-circle"
              kind="ghost"
              small
              onPress={() => {
                patchRequest(req.id, { driverConfirmedAt: Date.now() });
                appMessage(req.id, 'driverConfirmedMsg', { name: req.driverName ?? '' });
                notify('customer', 'nt_driverConfirmed', 'success', { name: req.driverName ?? '' }, undefined, req.id);
              }}
            />
          )}
        </Card>
      ) : null}
      {req.stage === 'accepted' && !needsTake ? <Btn title={t('onMyWayBtn')} icon="navigate" onPress={() => setStage(req.id, 'enroute')} /> : null}
      {req.stage === 'enroute' ? (
        <>
          {atPickup ? (
            <T size={14} weight="bold" color={c.live} style={{ textAlign: 'center' }}>
              {t('gpsAtPickup')}
            </T>
          ) : null}
          <Btn title={t('arrivedBtn')} icon="location" onPress={() => setStage(req.id, 'arrived')} />
        </>
      ) : null}
      {req.stage === 'arrived' ? (
        <>
          <T size={14} muted style={{ textAlign: 'center' }}>
            {t('loadingFor', { time: loading })}
          </T>
          <Btn title={t('loadedBtn')} icon="cube" onPress={() => setStage(req.id, 'loaded')} />
        </>
      ) : null}
      {req.stage === 'loaded' ? (
        <>
          {atDrop ? (
            <T size={14} weight="bold" color={c.live} style={{ textAlign: 'center' }}>
              {t('gpsAtDropoff')}
            </T>
          ) : null}
          <Btn title={t('arrivedDropBtn')} icon="flag" onPress={() => setStage(req.id, 'dropoff')} />
        </>
      ) : null}
      {req.stage === 'dropoff' ? (
        <Card>
          <T weight="heavy">{t('handOverTitle')}</T>
          <T size={14} muted>
            {t('handOverSub', { price: dh(req.price, lang), who: payer })}
          </T>
          <Btn title={t('handedOverBtn')} icon="checkmark-done" onPress={handOver} />
        </Card>
      ) : null}
      {['arrived', 'loaded', 'dropoff'].includes(req.stage) ? (
        <Card>
          <TripPhotos req={req} side="driver" canAdd />
        </Card>
      ) : null}
      <ChatButton req={req} role="driver" />
      <HelpButton />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {!toDrop ? (
          <View style={{ flex: 1 }}>
            <Btn title={t('cancelJobShort')} kind="ghost" small onPress={() => setCancel(true)} />
          </View>
        ) : null}
      </View>
      <CancelSheet req={req} side="driver" visible={cancel} onClose={() => setCancel(false)} />
    </View>
  );
}

/** Distance in km between two points (short distances). */
function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

/**
 * Earnings (round 9, #102): in the customer side's warm colours, not black and white. A bright card
 * with the cash collected, three small tiles (today, this week, per trip), the week's invoice as a
 * bar (what he keeps / the app's 10 %), and each trip with its coloured route and price.
 */
const EARN = { orange: '#C2410C', orange2: '#EA580C', green: '#15803D', greenSoft: '#DCFCE7', blue: '#1D4ED8', blueSoft: '#DBEAFE', amberSoft: '#FFEDD5', pickup: '#EA580C', drop: '#DC2626' };
export function Earnings({ done }: { done: Request[] }) {
  const c = useColors();
  const { t, lang } = useT();
  const total = done.reduce((s, r) => s + r.price, 0);
  const share = Math.round(total * 0.1);
  const keep = total - share;
  const at = (r: Request) => r.deliveredAt ?? r.phaseAt ?? r.createdAt;
  const dayStart = new Date(new Date().toDateString()).getTime();
  const weekStart = dayStart - ((new Date().getDay() + 6) % 7) * 86400000;
  const today = done.filter((r) => at(r) >= dayStart).reduce((s, r) => s + r.price, 0);
  const week = done.filter((r) => at(r) >= weekStart).reduce((s, r) => s + r.price, 0);
  const avg = done.length ? Math.round(total / done.length) : 0;
  const tile = (icon: keyof typeof Ionicons.glyphMap, label: string, value: string, tint: string, soft: string) => (
    <View style={{ flex: 1, backgroundColor: soft, borderRadius: 18, padding: 10, gap: 4 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color="#FFFFFF" />
      </View>
      <T size={11} weight="bold" color="#1C1917" numberOfLines={1}>
        {label}
      </T>
      <T size={15} weight="heavy" color={tint} numberOfLines={1}>
        {dh(value === '' ? 0 : Number(value), lang)}
      </T>
    </View>
  );
  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: EARN.orange, borderRadius: 26, padding: 18, overflow: 'hidden', gap: 4 }}>
        {/* Two soft circles for depth. */}
        <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: EARN.orange2, top: -70, end: -50, opacity: 0.85 }} />
        <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.10)', bottom: -50, start: -30 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="wallet" size={18} color="#FFFFFF" />
          <T size={13} weight="bold" color="#FFFFFF">
            {t('cashCollected')}
          </T>
        </View>
        <T size={40} weight="heavy" color="#FFFFFF" style={{ lineHeight: 52 }}>
          {dh(total, lang)}
        </T>
        <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
          <T size={12} weight="bold" color="#FFFFFF">
            {done.length === 1 ? t('oneTrip') : t('tripsN', { n: done.length })}
          </T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {tile('sunny', t('earnToday'), String(today), EARN.orange, EARN.amberSoft)}
        {tile('calendar', t('earnWeek'), String(week), EARN.blue, EARN.blueSoft)}
        {tile('trending-up', t('earnAvg'), String(avg), EARN.green, EARN.greenSoft)}
      </View>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T weight="heavy">{t('invoice')}</T>
          <Pill>{t('notIssued')}</Pill>
        </View>
        {/* What he keeps and the app's share, as one bar. */}
        <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: c.raised }}>
          {total ? (
            <>
              <View style={{ flex: keep, backgroundColor: EARN.green }} />
              <View style={{ flex: share, backgroundColor: EARN.orange2 }} />
            </>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: EARN.green }} />
            <T muted>{t('youKeep')}</T>
          </View>
          <T weight="heavy" color={EARN.green}>
            {dh(keep, lang)}
          </T>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: EARN.orange2 }} />
            <T muted>{t('appShare')}</T>
          </View>
          <T weight="heavy" color={EARN.orange2}>
            {dh(share, lang)}
          </T>
        </View>
        <T size={12} muted>
          {t('noWallet')}
        </T>
      </Card>
      {done.length ? (
        <T size={14} weight="heavy">
          {t('earnTrips')}
        </T>
      ) : null}
      {done.map((r) => (
        <Card key={r.id} style={{ gap: 8, borderStartWidth: 5, borderStartColor: EARN.green }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: EARN.pickup }} />
                <T size={14} weight="bold" numberOfLines={1} style={{ flex: 1 }}>
                  {r.from}
                </T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: EARN.drop }} />
                <T size={14} weight="bold" numberOfLines={1} style={{ flex: 1 }}>
                  {r.to}
                </T>
              </View>
            </View>
            <View style={{ backgroundColor: EARN.greenSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <T size={15} weight="heavy" color={EARN.green}>
                {dh(r.price, lang)}
              </T>
            </View>
          </View>
          <T size={12} muted numberOfLines={1}>
            {loadOf(r, t)}
          </T>
        </Card>
      ))}
      {!done.length ? (
        <Card style={{ alignItems: 'center', gap: 6 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: EARN.amberSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="wallet-outline" size={26} color={EARN.orange} />
          </View>
          <T muted style={{ textAlign: 'center' }}>{t('noEarnings')}</T>
        </Card>
      ) : null}
    </View>
  );
}

/** The customer's photo and name (tap for their profile); never their phone number. */
function CustomerRow() {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const me = store.customer;
  const person: Person = { role: 'customer', name: me.name || t('customer'), photo: me.photoUri, city: me.city || undefined };
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={person.name} uri={person.photo} size={40} />
        <View style={{ flex: 1 }}>
          <T weight="heavy">{person.name}</T>
          {/* «Customer» once: under a real name, or alone when there is none. */}
          {me.name || person.city || me.company ? (
            <T size={12} muted>
              {[me.company || (me.name ? t('customer') : ''), person.city ?? ''].filter(Boolean).join(' · ')}
            </T>
          ) : null}
        </View>
        <T size={13} weight="bold" color={c.accent}>
          {t('seeProfile')}
        </T>
      </Pressable>
      <PersonSheet person={open ? person : null} onClose={() => setOpen(false)} />
    </>
  );
}

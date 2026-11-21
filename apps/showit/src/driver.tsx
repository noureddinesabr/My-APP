import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Image, Linking, Pressable, ScrollView, TextInput, View } from 'react-native';

import { ChatButton, customerPhone } from './tabs';
import { tripDay } from './engine';
import { COMMISSION_RATE } from './lib/pricing';
import { takesOffers } from './store';
import { AssignCard } from './company';
import { AtPickupDriver, CallNudge, HelpersClaimDriver, openRateCustomer, TimeAskCard } from './ruleui';
import { HelpButton } from './help';
import { CallButton } from './call';
import { setPage, setTripOnScreen } from './where';
import { Avatar, driverRating, PersonSheet, type Person } from './people';
import { autoDir, fieldDir } from './composer';
import { useT, type Key } from './i18n';
import { Confirm, dh, fmtKm, LoadDrawing, loadOf, OngoingCard, PhotoStrip, Steps, VehiclePicker, VehicleRow, vName } from './shared';
import { useBack } from './back';
import { onHome, onOpenTrip, openTab, setDriverHeader } from './home';
import { MiniTripMap } from './map/MiniTripMap';
import { play } from './sounds';
import { addOffer, appMessage, canAskPrice, companionAt, floorUnknown, driverAutoMessage, getState, isLive, notify, patchRequest, setStage, update, useStore, type Party, type Request, type TripPlan } from './store';
import { floorSummary } from './flow';
import { CancelSheet, countdown, Sheet, TripPhotos, useLoadingTimer } from './trip';
import { PriceAskCard, PriceAskSheet } from './priceask';
import { pauseState, scheduleClash } from './busy';
import { misfit, onWay, PlanSheet, planEnd, RulesPage, workDone, WorkSetup } from './work';
import { canOffer, nameDone, PapersPage, SignUp, youDone } from './signup';
import { PriceEditor } from './customer';
import { Tech } from './stitch';
import { Btn, Card, FadeIn, Glow, LiveDot, Pill, T, Tag, tap, useColors, VoicePlayer } from './ui';
import { getPlace } from './lib/places';
import { setMapShown, setMapTrip, setMapVehicle, useMyLocation } from './map/trip';
import { formatWhen } from './wheels';
import { fmtKg } from './scan';
import { EARN_COLORS, fade, SIGNAL } from './theme';

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
        <T size={14} weight="semibold">
          {loadOf(req, t) || (req.goods ? t(`g_${req.goods}` as Key) : '')}
        </T>
      </View>
      {req.weightKg ? <Pill>{t('kgEstimate', { kg: fmtKg(req.weightKg, lang) })}</Pill> : null}
      {req.floor ? <Pill>{t('floorN', { n: req.floor })}</Pill> : null}
      {/* Round 10: both ends' floors, honestly: «الطابق غير معروف» when the customer didn't know. */}
      {req.floors ? (
        <>
          <Pill tone={floorUnknown(req.floors.pickup) ? 'warn' : undefined}>{t('floorAtPickup', { v: floorSummary(req.floors.pickup, t) })}</Pill>
          <Pill tone={floorUnknown(req.floors.dropoff) ? 'warn' : undefined}>{t('floorAtDropoff', { v: floorSummary(req.floors.dropoff, t) })}</Pill>
        </>
      ) : null}
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
      {req.parties ? (
        // Owner's edit #1: one line per place, never a name or phone (calls go through the app).
        <View style={{ width: '100%', gap: 4, backgroundColor: c.raised, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
          {partiesLines(req, t).map((line) => (
            <View key={line} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <Ionicons name="person-outline" size={14} color={c.accent} style={{ marginTop: 2 }} />
              <T size={13} weight="semibold" style={{ flex: 1 }}>
                {line}
              </T>
            </View>
          ))}
        </View>
      ) : req.companion ? (
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
/** Owner's edit #1: who the driver meets at each place, and who pays, in roles (no names). */
export function partiesLines(req: Request, t: TFn): string[] {
  const p = req.parties;
  if (!p) return [];
  const who = (x: Party) => (x.who === 'me' ? t('dv_customer') : x.who === 'other' ? t('dv_sent') : t('dv_none'));
  const lines = [t('dp_pickup', { v: who(p.pickup) }), t('dp_rides', { v: who(p.rides) }), t('dp_dropoff', { v: who(p.dropoff) })];
  if (p.pays && p.pays !== 'me') lines.push(t('dp_pays', { v: p.pays === 'pickup' ? t('pt_payPickup') : p.pays === 'rides' ? t('pt_payRides') : t('pt_payDropoff') }));
  return lines;
}

/** Who pays the driver, in his words (round 7, then by place). */
export function payerOf(req: Request, t: TFn) {
  const p = req.parties;
  if (p) return !p.pays || p.pays === 'me' ? t('theCustomer') : p.pays === 'pickup' ? t('pt_payPickup') : p.pays === 'rides' ? t('pt_payRides') : t('pt_payDropoff');
  return req.companion?.pays === 'them' ? (req.companion.who === 'none' ? t('someoneAtDropoff') : t('thePersonWithYou')) : t('theCustomer');
}

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
  const { t, lang, route } = useT();
  const me = store.driver;
  const mine = (r: Request) => !r.driverIsExample && !!me.name && r.driverName === me.name;
  const job = store.requests.find((r) => mine(r) && isLive(r.stage));
  // Opens on the loads page; a job in progress is one tap away, and opens by itself only when new.
  const [jobOpen, setJobOpen] = useState(false);
  const seenJob = useRef(job?.id);
  // Report #15: a job he still has to confirm is announced by the "customer accepted" page first.
  const [seenAccept, setSeenAccept] = useState<string | null>(null);
  useEffect(() => {
    if (job?.id && job.id !== seenJob.current && job.takenAt) setJobOpen(true);
    seenJob.current = job?.id;
  }, [job?.id]);
  const showingJob = !!job && jobOpen;
  const pageName = showingJob ? `job:${job?.stage}` : !nameDone(me, store.company?.name) ? 'signup' : !workDone(me.work) ? 'work' : !youDone(me) ? 'signup-you' : !me.rulesAt ? 'rules' : 'loads';
  useEffect(() => setPage(`driver · ${pageName}`), [pageName]);
  // Owner's report #11: on the loads page his status card stays fixed at the top (drawn by App).
  useEffect(() => {
    setDriverHeader(pageName === 'loads');
    return () => setDriverHeader(false);
  }, [pageName]);
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
  // Simple design: no map on the loads page; the map comes only with a trip on the way.
  useEffect(() => {
    setMapShown(showingJob);
    return () => setMapShown(true);
  }, [showingJob]);

  // First time (rounds 7–8): sign-up (photo, phone, vehicle, papers), the work questions, the rules.
  // Rule 9: name and «driver or company?» first, then the work questions, then photo and vehicle; papers last.
  if (!nameDone(me, store.company?.name)) return <SignUp part="name" />;
  if (!workDone(me.work)) return <WorkSetup />;
  if (!youDone(me)) return <SignUp part="you" />;
  if (!me.rulesAt) return <RulesPage />;
  if (showingJob && job)
    return (
      <View style={{ gap: 18 }}>
        <Job req={job} />
        {/* Other loads he can still take (the schedule engine keeps only those that fit his time). */}
        <Loads more />
      </View>
    );
  // Owner's report #15: when a customer accepts his offer, a clear page says he is now committed to
  // this trip, shows the route, and opens the trip (map, steps) in one tap.
  const accepted = job && !job.takenAt && seenAccept !== job.id ? job : null;
  const acceptSheet = accepted ? (
    <Sheet visible onClose={() => setSeenAccept(accepted.id)} title={t('acceptedTitle')}>
      <View style={{ gap: 12 }}>
        <T size={14}>{t('acceptedBody')}</T>
        {getPlace(accepted.fromPlaceId) && getPlace(accepted.toPlaceId) ? (
          <MiniTripMap from={{ lat: getPlace(accepted.fromPlaceId)!.lat, lng: getPlace(accepted.fromPlaceId)!.lng }} to={{ lat: getPlace(accepted.toPlaceId)!.lat, lng: getPlace(accepted.toPlaceId)!.lng }} height={150} />
        ) : null}
        <Glow style={{ borderRadius: 22, padding: 12, gap: 6 }}>
          <T size={16} weight="heavy">
            {route(accepted.from.split(/[,،]/)[0], accepted.to.split(/[,،]/)[0])}
          </T>
          <T size={13} muted>
            {[dh(accepted.price, lang), formatWhen(accepted.when, lang, t), t('payEspeces')].join(' · ')}
          </T>
        </Glow>
        <Btn
          title={t('acceptedOpen')}
          icon="navigate"
          onPress={() => {
            setSeenAccept(accepted.id);
            setJobOpen(true);
          }}
        />
      </View>
    </Sheet>
  ) : null;
  // Owner's reports #11, #12, #23: the profile card is fixed above (App draws it), then the announced
  // trips, the job in progress, the loads in small rows, and the earnings tiles at the bottom.
  return (
    <View style={{ flex: 1, gap: 12 }}>
      {/* Owner's reports #45, #46: the announced trips (top) and the earnings and rating tiles (bottom) stay fixed, drawn by App. */}
      {/* Rule 9: he can look at loads right away; papers open the offers. */}
      {!canOffer(me) ? <PapersBanner /> : null}
      {job ? <OngoingCard title={t('jobNow')} line={route(job.from.split(/[,،]/)[0], job.to.split(/[,،]/)[0])} status={t(`st_${job.stage}` as Key)} onOpen={() => setJobOpen(true)} /> : null}
      <Loads />
      {acceptSheet}
    </View>
  );
}

/**
 * Simple design, driver home header (owner: interactive and simple, like Instagram): his photo with a
 * live ring while online (tap: his profile), the online switch with a sliding knob, and his announced
 * trips as a row of story circles, the first one "+ New trip".
 */
export function DriverHeader({ part }: { part: 'profile' | 'trips' | 'tiles' | 'mini' }) {
  const c = useColors();
  const { t, lang, route } = useT();
  const store = useStore();
  const me = store.driver;
  const on = me.online !== false;
  const plans = me.plans ?? [];
  const [editing, setEditing] = useState<TripPlan | 'new' | null>(null);
  // The ring breathes while online.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [on, pulse]);
  // Owner's report #24: an announced trip glows like a story until it is over (a soft halo breathing).
  const glow = useRef(new Animated.Value(0)).current;
  const hasPlans = plans.length > 0;
  useEffect(() => {
    if (!hasPlans) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 1300, useNativeDriver: true }), Animated.timing(glow, { toValue: 0, duration: 1300, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [hasPlans, glow]);
  // The knob slides; the track changes colour.
  const knob = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(knob, { toValue: on ? 1 : 0, useNativeDriver: false, friction: 7 }).start();
  }, [on, knob]);
  const toggle = () => {
    tap();
    play(on ? 'pop' : 'success');
    update((s) => ({ ...s, driver: { ...s.driver, online: !on } }));
  };
  const ring = on ? c.inverseAccent : c.line;
  // Owner's report #45: the trips sit fixed at the top, smaller.
  const S = 46;
  const story = (key: string, label: string, sub: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void, add?: boolean) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={add ? t('plansTitle') : `${label}. ${t('edit')}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ width: 66, alignItems: 'center', gap: 2, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      {add ? (
        <View style={{ width: S, height: S, borderRadius: S / 2, padding: 2, borderWidth: 2, borderColor: c.line, borderStyle: 'dashed' }}>
          <View style={{ flex: 1, borderRadius: S / 2, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={18} color={c.live} />
          </View>
        </View>
      ) : (
        // A trip still to come glows like a story: a green → yellow → orange ring.
        <View style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', width: S, height: S, borderRadius: S / 2, backgroundColor: c.accent2, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }} />
          <Glow tone="accent" style={{ width: S, height: S, borderRadius: S / 2, padding: 2.5 }}>
            <View style={{ flex: 1, borderRadius: S / 2, borderWidth: 2, borderColor: c.surface, backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={icon} size={18} color={c.inverseAccent} />
            </View>
          </Glow>
        </View>
      )}
      <T size={10} weight="bold" numberOfLines={1} style={{ textAlign: 'center' }}>
        {label}
      </T>
      {sub ? (
        <T size={9} muted numberOfLines={1} style={{ textAlign: 'center', marginTop: -2 }}>
          {sub}
        </T>
      ) : null}
    </Pressable>
  );
  // Xapp Freight (Stitch "driver partner console"): his profile card with the Online pill, today's
  // earnings with the week in small bars, his rating in the sky tile, then his announced trips.
  const mineDone = store.requests.filter((r) => !r.driverIsExample && !!me.name && r.driverName === me.name && r.stage === 'delivered');
  const dayStart = new Date().setHours(0, 0, 0, 0);
  const today = mineDone.filter((r) => (r.deliveredAt ?? 0) >= dayStart).reduce((n, r) => n + r.price, 0);
  const week = Array.from({ length: 7 }, (_, i) => {
    const from = dayStart - (6 - i) * 86400000;
    return mineDone.filter((r) => (r.deliveredAt ?? 0) >= from && (r.deliveredAt ?? 0) < from + 86400000).reduce((n, r) => n + r.price, 0);
  });
  const top = Math.max(1, ...week);
  const rating = driverRating(store.requests, me.name);
  // Owner's reports #11, #23, #24 (18 Nov 2026): the profile card is fixed at the top, the announced
  // trips sit right under it, and the earnings and rating tiles go to the bottom of the page.
  const [viewing, setViewing] = useState<TripPlan | null>(null);
  const [explain, setExplain] = useState(false);
  const now = Date.now();
  const active = plans.filter((p) => planEnd(p) >= now);
  // Trips that are over leave quietly.
  useEffect(() => {
    if (active.length !== plans.length) update((s) => ({ ...s, driver: { ...s.driver, plans: (s.driver.plans ?? []).filter((p) => planEnd(p) >= Date.now()) } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length, plans.length]);
  const profileCard = (
      <Glow tone="glass" style={{ borderRadius: 28, padding: 14, gap: 12, shadowColor: c.shadow, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('tabAccount')} onPress={() => { tap(); openTab('profile'); }} style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
            {on ? (
              <Animated.View
                pointerEvents="none"
                style={{ position: 'absolute', width: 56, height: 56, borderRadius: 20, borderWidth: 2, borderColor: ring, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }] }}
              />
            ) : null}
            <View style={{ width: 56, height: 56, borderRadius: 20, borderWidth: 2.5, borderColor: on ? c.accent2 : c.line, padding: 2, overflow: 'hidden' }}>
              <Avatar name={me.name} uri={me.photoUri} size={47} />
            </View>
            <View style={{ position: 'absolute', bottom: -1, end: -1, width: 16, height: 16, borderRadius: 8, backgroundColor: on ? c.ok : c.muted, borderWidth: 2.5, borderColor: c.surface }} />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <T size={18} weight="heavy">
              {me.name || t('driverLabel')}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="star" size={12} color={c.orange} />
                <T size={12} weight="bold">
                  {rating.count ? rating.avg.toFixed(1) : t('newDriver')}
                </T>
              </View>
              <T size={12} muted style={{ flexShrink: 1 }}>
                {vName(t, me.vehicle)}
              </T>
            </View>
          </View>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={on ? t('youOnline') : t('youOffline')} onPress={toggle} hitSlop={6} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 999, backgroundColor: on ? c.liveSoft : c.raised, borderWidth: 1, borderColor: on ? c.accent2 : c.line, opacity: pressed ? 0.85 : 1 })}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? c.ok : c.muted }} />
            <T size={13} weight="heavy" color={on ? c.live : c.muted}>
              {on ? t('onlinePill') : t('offlinePill')}
            </T>
          </Pressable>
        </View>
        <T size={12} muted>
          {on ? t('onlineSub') : t('offlineShort')}
        </T>
      </Glow>
  );
  const tilesRow = (
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable accessibilityRole="button" onPress={() => { tap(); openTab('earnings'); }} style={{ flex: 1.2, backgroundColor: c.surface, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 12, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T size={12} weight="semibold" muted>
              {t('todayEarnings')}
            </T>
            <Ionicons name="arrow-up-outline" size={14} color={c.muted} style={{ transform: [{ rotate: '45deg' }] }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <T size={24} weight="heavy">
              {String(today)}
            </T>
            <T size={12} weight="bold" muted>
              {lang === 'ar' ? 'درهم' : 'DH'}
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 34, direction: 'ltr' }}>
            {week.map((v, i) => (
              <View key={i} style={{ flex: 1, height: Math.max(4, Math.round((v / top) * 34)), borderRadius: 4, backgroundColor: i === 6 ? c.accent2 : c.raised }} />
            ))}
          </View>
        </Pressable>
        <Glow tone="sky" style={{ flex: 1, borderRadius: 24, padding: 12, gap: 4 }}>
          <T size={12} weight="semibold" color={c.onSky}>
            {t('yourRating')}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <T size={rating.count ? 28 : 18} weight="heavy" color={c.onSky}>
              {rating.count ? rating.avg.toFixed(1) : t('newDriver')}
            </T>
            {rating.count ? <Ionicons name="star" size={16} color={c.onSky} /> : null}
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: fade(c.surface, 0.7), borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.ok }} />
            <T size={11} weight="bold" color={c.onSky}>
              {t('tripsDone', { n: rating.trips })}
            </T>
          </View>
        </Glow>
      </View>
  );
  if (part === 'profile') return <View style={{ gap: 12 }}>{profileCard}</View>;
  if (part === 'tiles') return tilesRow;
  // Owner's report #44: in the top bar, his photo (tap: his profile) and the online switch.
  if (part === 'mini')
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('tabAccount')} onPress={() => { tap(); openTab('profile'); }} hitSlop={4} style={{ width: 36, height: 36 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: on ? c.accent2 : c.line, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <Avatar name={me.name} uri={me.photoUri} size={31} />
          </View>
          <View style={{ position: 'absolute', bottom: -1, end: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: on ? c.ok : c.muted, borderWidth: 2, borderColor: c.surface }} />
        </Pressable>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={on ? t('youOnline') : t('youOffline')} onPress={toggle} hitSlop={6} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34, paddingHorizontal: 10, borderRadius: 999, backgroundColor: on ? c.liveSoft : c.raised, borderWidth: 1, borderColor: on ? c.accent2 : c.line, opacity: pressed ? 0.85 : 1, flexShrink: 1 })}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? c.ok : c.muted }} />
          <T size={12} weight="heavy" color={on ? c.live : c.muted} numberOfLines={1}>
            {on ? t('onlinePill') : t('offlinePill')}
          </T>
        </Pressable>
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      {/* Owner's reports #11 and #24: what announcing a trip means, in plain words, then the trips as
          stories (they glow until the trip is over; tap one to see it on the map, edit or delete it). */}
      <Glow style={{ borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T size={14} weight="heavy" style={{ flex: 1 }}>
            {t('yourTrips')}
          </T>
          {/* The explanation stays one tap away (the card is kept small, report #45). */}
          <Pressable accessibilityRole="button" accessibilityLabel={t('tripsInfoBtn')} accessibilityState={{ expanded: explain }} onPress={() => { tap(); setExplain(!explain); }} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={18} color={c.muted} />
          </Pressable>
        </View>
        {explain ? (
          <T size={11} muted>
            {t('tripsExplain')}
          </T>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 2 }}>
          {story('add', t('storyAdd'), '', 'add', () => setEditing('new'), true)}
          {active.map((p) => story(p.id, route(p.from.split(/[,،]/)[0], p.to.split(/[,،]/)[0]), planWhen(p, t, lang), p.back ? 'swap-horizontal' : 'navigate', () => setViewing(p)))}
        </ScrollView>
      </Glow>
      <PlanSheet plan={editing} onClose={() => setEditing(null)} />
      <StoryViewer plan={viewing} onClose={() => setViewing(null)} onEdit={(p) => { setViewing(null); setEditing(p); }} />
    </View>
  );
}

function Loads({ more }: { more?: boolean }) {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  // Rule 4: open requests stay until the rules close them; Rule 7b: a booked trip reopened because its
  // driver doesn't answer is shown to the others (never to the driver who has it).
  const offering = (r: Request) => takesOffers(r) && r.driverName !== store.driver.name;
  // Round 10: loads that don't fit his booked time are not shown at all (they would only tempt him).
  const all = store.requests.filter((r) => offering(r) && !scheduleClash(r, store.driver, store.requests));
  const clashing = store.requests.filter((r) => offering(r) && !!scheduleClash(r, store.driver, store.requests)).map((r) => r.id).join(',');
  // An offer he made before booking another job that now takes that time is withdrawn quietly.
  useEffect(() => {
    if (!clashing) return;
    const ids = clashing.split(',');
    update((s) => (s.offers.some((o) => o.id.endsWith('_me') && ids.includes(o.requestId)) ? { ...s, offers: s.offers.filter((o) => !(o.id.endsWith('_me') && ids.includes(o.requestId))) } : s));
  }, [clashing]);
  // A short, kind rest for new loads after cancelling twice or more in a week (jobs he has go on).
  const pause = pauseState(store.driver);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!pause.until) return;
    const id = setInterval(() => setTick((n) => n + 1), 20000);
    return () => clearInterval(id);
  }, [pause.until]);
  // Only loads that fit him (vehicle, helpers, area), loads on his announced trips first (round 7).
  const [showAll, setShowAll] = useState(false);
  const plans = store.driver.plans ?? [];
  const fit = all.filter((r) => !misfit(r, store.driver));
  const hidden = all.length - fit.length;
  const rank = (r: Request) => (onWay(r, plans) ? 0 : 1);
  const open = [...(showAll ? all : fit)].sort((a, b) => rank(a) - rank(b));
  if (more && (!open.length || pause.until || store.driver.online === false)) return null;
  if (pause.until && store.driver.online !== false)
    return (
      <Card style={{ alignItems: 'center', gap: 6 }}>
        <Ionicons name="cafe-outline" size={26} color={c.accent} />
        <T weight="heavy">{t('pauseTitle')}</T>
        <T size={13} muted style={{ textAlign: 'center' }}>
          {t('pauseSub', { min: Math.max(1, Math.ceil((pause.until - Date.now()) / 60000)) })}
        </T>
        {pause.call ? (
          <T size={13} muted style={{ textAlign: 'center' }}>
            {t('pauseCall')}
          </T>
        ) : null}
      </Card>
    );
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
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <T size={19} weight="heavy" style={{ flex: 1 }}>
          {more ? t('moreLoads') : t('loadsForYou')}
        </T>
        <View style={{ minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 8, backgroundColor: open.length ? SIGNAL.countBadge : c.raised, alignItems: 'center', justifyContent: 'center' }}>
          <T size={14} weight="heavy" color={open.length ? c.onInverse : c.muted}>
            {String(open.length)}
          </T>
        </View>
      </View>
      {open.map((r) => (
        <LoadRow key={r.id} req={r} />
      ))}
      {/* Owner's report #25: no line about the loads that don't fit — only the loads that fit are shown. */}
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

/**
 * One load in the list (simple design): small photo, from → to, when and distance, and the price.
 * Everything else (what, floors, helpers, notes, voice) is one tap away, in the sheet.
 */
function LoadRow({ req }: { req: Request }) {
  const c = useColors();
  const { t, lang, route } = useT();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const myOffer = store.offers.find((o) => o.id === `${req.id}_me`);
  const way = onWay(req, store.driver.plans ?? []);
  const photos = req.photoUris?.length ? req.photoUris : req.photoUri ? [req.photoUri] : [];
  const title = route(req.from.split(/[,،]/)[0], req.to.split(/[,،]/)[0]);
  // A new load slides in softly, so it's noticed without a word.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  }, [enter]);
  // Owner's report #12: a small row per load so several fit on the page; tapping it opens the
  // whole offer right there (photos, route, customer, accept or another price), tapping again closes it.
  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
      <Glow style={{ borderRadius: 24, borderWidth: way || open ? 2 : 1, borderColor: open ? c.accent2 : way ? c.accent : c.glassEdge, padding: 10, gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${title} · ${dh(req.price, lang)}`}
          onPress={() => {
            tap();
            play(open ? 'tick' : 'pop');
            setOpen(!open);
          }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.85 : 1 })}>
          <View style={{ width: 52, height: 52, borderRadius: 14, overflow: 'hidden', backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
            {photos[0] ? <Image source={{ uri: photos[0] }} style={{ width: 52, height: 52 }} resizeMode="cover" /> : <Ionicons name="cube-outline" size={22} color={c.muted} />}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T size={15} weight="heavy">
              {title}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: myOffer ? c.live : req.when === 'now' ? c.orange : c.muted }} />
              <T size={12} muted>
                {[myOffer ? t('offerSentShort', { price: dh(myOffer.price, lang) }) : way ? (way === 'go' ? t('onYourWay') : t('onYourWayBack')) : formatWhen(req.when, lang, t), req.km ? `≈ ${fmtKm(req.km, lang)}` : ''].filter(Boolean).join(' · ')}
              </T>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T size={20} weight="heavy">
              {String(req.price)}
            </T>
            <T size={11} muted>
              {lang === 'ar' ? 'درهم' : 'DH'}
            </T>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
        </Pressable>
        {open ? (
          <FadeIn>
            <LoadCard req={req} inSheet onDone={() => setOpen(false)} />
          </FadeIn>
        ) : null}
      </Glow>
    </Animated.View>
  );
}


/** Rule 9: a gentle card on the loads page until the papers are sent (a company also adds its logo). */
function PapersBanner() {
  const c = useColors();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ backgroundColor: c.warnSoft, borderRadius: 18, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Ionicons name="document-text-outline" size={18} color={c.warn} />
        <View style={{ flex: 1, gap: 2 }}>
          <T size={14} weight="heavy">
            {t('ppBannerTitle')}
          </T>
          <T size={12} muted>
            {t('ppBannerSub')}
          </T>
        </View>
      </View>
      <Btn title={t('ppBannerBtn')} small icon="camera-outline" onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('ppTitle')}>
        <PapersPage inSheet onDone={() => setOpen(false)} />
      </Sheet>
    </View>
  );
}

function LoadCard({ req, inSheet, onDone }: { req: Request; /** Shown in the load's sheet (the list shows only the row). */ inSheet?: boolean; onDone?: () => void }) {
  const c = useColors();
  const { t, lang, route } = useT();
  const store = useStore();
  const myOffer = store.offers.find((o) => o.id === `${req.id}_me`);
  // A job with helpers: one check right before the offer goes (round 7), never a repeated rule.
  const [askHelpers, setAskHelpers] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const send = (price: number) => {
    // Checked again at the moment he accepts (another job may have been booked meanwhile).
    const st = getState();
    if (scheduleClash(req, st.driver, st.requests) || pauseState(st.driver).until) {
      setBusy(true);
      return;
    }
    play('send');
    // Rule 12: a company's offer carries its name and team, shown with a «Company ✓» badge.
    const co = st.driver.accountType === 'company' ? st.company : undefined;
    addOffer({ id: `${req.id}_me`, requestId: req.id, driverName: store.driver.name, vehicle: store.driver.vehicle, price, createdAt: Date.now(), example: false, ...(co ? { company: co.name, companyLine: t('coTeamLine', { n: co.teamSize ?? co.drivers.length + 1 }) } : {}) });
    // Owner's report #15: say clearly that the offer went and what happens next.
    notify('driver', 'nt_offerSentDriver', 'success', { price: dh(price, lang) }, undefined, req.id);
    onDone?.();
  };
  const [needPapers, setNeedPapers] = useState(false);
  // Rule 9: offers open once the papers are sent.
  const offer = (price: number) => (!canOffer(store.driver) ? setNeedPapers(true) : req.helpers ? setAskHelpers(price) : send(price));
  const way = onWay(req, store.driver.plans ?? []);
  const why = misfit(req, store.driver);
  const work = store.driver.work;
  const helperCost = req.helpers && work?.helpers === 'yes' && work.helperPrice ? req.helpers * work.helperPrice : 0;
  const [pricing, setPricing] = useState<number | null>(null);
  return (
    <View style={inSheet ? { gap: 0 } : { backgroundColor: c.surface, borderRadius: 24, overflow: 'hidden', borderWidth: way ? 2 : 1, borderColor: way ? SIGNAL.loadAccent : c.line }}>
      <Sheet visible={needPapers} onClose={() => setNeedPapers(false)} title={t('ppNeedTitle')}>
        <PapersPage inSheet onDone={() => setNeedPapers(false)} />
      </Sheet>
      {inSheet ? (
        // Owner's report #16: the route big and clear (full pickup and delivery addresses), the price,
        // then the customer with in-app Call and Message.
        <View style={{ gap: 12, paddingBottom: 12 }}>
          <Glow style={{ borderRadius: 24, padding: 14, gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center', paddingTop: 6 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: c.ok }} />
                <View style={{ width: 2, flex: 1, minHeight: 28, backgroundColor: c.line, marginVertical: 4 }} />
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.orange }} />
              </View>
              <View style={{ flex: 1, gap: 14 }}>
                <View style={{ gap: 2 }}>
                  <T size={12} weight="semibold" muted>
                    {t('pickupPlace')}
                  </T>
                  <T size={17} weight="heavy">
                    {req.from}
                  </T>
                </View>
                <View style={{ gap: 2 }}>
                  <T size={12} weight="semibold" muted>
                    {t('dropoffPlace')}
                  </T>
                  <T size={17} weight="heavy">
                    {req.to}
                  </T>
                </View>
              </View>
            </View>
          </Glow>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <T size={34} weight="heavy">
                  {String(req.price)}
                </T>
                <T size={15} weight="bold" muted>
                  {lang === 'ar' ? 'درهم' : 'DH'}
                </T>
              </View>
              <T size={12} muted>
                {[t('customerPrice'), formatWhen(req.when, lang, t), req.km ? `≈ ${fmtKm(req.km, lang)}` : ''].filter(Boolean).join(' · ')}
              </T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.inverse, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Ionicons name="cash-outline" size={14} color={c.inverseAccent} />
              <T size={12} weight="heavy" color={c.onInverse}>
                {t('payEspeces')}
              </T>
            </View>
          </View>
          <CustomerContact req={req} />
        </View>
      ) : null}
      {/* Round 8: the route and the price first, in a coloured band, then the photo and the details. */}
      {inSheet ? null : <View style={{ backgroundColor: c.inverseDeep, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T size={17} weight="heavy" color={c.onInverse}>
            {route(req.from.split(/[,،]/)[0], req.to.split(/[,،]/)[0])}
          </T>
          <T size={12} color={fade(c.onInverse, 0.75)}>
            {[formatWhen(req.when, lang, t), req.km ? `≈ ${fmtKm(req.km, lang)}` : ''].filter(Boolean).join(' · ')}
          </T>
        </View>
        <View style={{ backgroundColor: SIGNAL.loadAccent, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' }}>
          <T size={18} weight="heavy" color={c.onInverse}>
            {dh(req.price, lang)}
          </T>
          <T size={10} color={fade(c.onInverse, 0.9)}>
            {t('cashShort')}
          </T>
        </View>
      </View>}
      <View style={{ height: inSheet ? 180 : 150, borderRadius: inSheet ? 18 : 0, overflow: 'hidden', backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
        {req.photoUri ? <Image source={{ uri: req.photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <LoadDrawing scale={0.7} />}
      </View>
      {inSheet && (req.photoUris?.length ?? 0) > 1 ? (
        <View style={{ paddingTop: 8 }}>
          <PhotoStrip uris={req.photoUris!.slice(1)} />
        </View>
      ) : null}
      <View style={{ padding: inSheet ? 0 : 16, paddingTop: inSheet ? 12 : 16, gap: 10 }}>
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
        {inSheet ? null : (
          <>
            <CustomerRow />
            <T size={13} muted>
              {route(req.from, req.to)}
            </T>
          </>
        )}
        {req.voiceUri ? <VoicePlayer uri={req.voiceUri} ms={req.voiceMs} label={t('customerVoice')} /> : null}
        {(req.noteVoices ?? []).map((v, i) => (
          <VoicePlayer key={v.uri + i} uri={v.uri} ms={v.ms} label={t('customerVoice')} />
        ))}
        {req.notePhotos?.length ? <PhotoStrip uris={req.notePhotos} /> : null}
        {(req.noteFiles ?? []).map((f, i) => (
          <Pressable key={f.uri + i} accessibilityRole="button" onPress={() => Linking.openURL(f.uri).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.raised, borderRadius: 14, padding: 10 }}>
            <Ionicons name="document-attach-outline" size={20} color={c.accent} />
            <T size={14} weight="bold" style={{ flex: 1 }}>
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
          style={({ pressed }) => ({ minHeight: 54, borderRadius: 16, backgroundColor: SIGNAL.loadAccent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.88 : 1 })}>
          <Ionicons name="checkmark-circle" size={20} color={c.onInverse} />
          <T size={16} weight="heavy" color={c.onInverse}>
            {t('accept', { price: dh(req.price, lang) })}
          </T>
        </Pressable>
        <Btn title={t('offerOtherPrice')} kind="ghost" icon="create-outline" onPress={() => setPricing(myOffer?.price ?? req.price)} />
        <Confirm visible={busy} title={t('busyTitle')} body={t('busyBody')} yes={t('okGotIt')} single onYes={() => setBusy(false)} onNo={() => setBusy(false)} />
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

/**
 * Stitch's big step bar ("JE SUIS ARRIVÉ SUR PLACE"): lime to amber, the step in capitals, a dark round
 * arrow at the end. One tap moves the trip on.
 */
function StepAction({ title, icon, onPress }: { title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  const c = useColors();
  const { rtl } = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ minHeight: 60, borderRadius: 999, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 10, paddingStart: 8, paddingEnd: 6, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <LinearGradient pointerEvents="none" colors={[c.accent, c.accent2, c.accent3]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: fade(c.surface, 0.55), alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={c.onAccent} />
      </View>
      <T size={15} weight="heavy" color={c.onAccent} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </T>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={22} color={c.inverseAccent} />
      </View>
    </Pressable>
  );
}

function Job({ req }: { req: Request }) {
  const c = useColors();
  const { t, lang } = useT();
  const [cancel, setCancel] = useState(false);
  const [details, setDetails] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
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
    // Rule 3: right after «Handed over», the driver may rate the customer (optional, only the team sees it).
    openRateCustomer(req.id);
    setStage(req.id, 'delivered');
    // A thank-you after every trip (round 10).
    notify('driver', 'nt_thanksTrip', 'success', { name: req.driverName ?? '' });
  };
  const payer = payerOf(req, t);
  // Simple design: where to go, the price, the one next action; the load's details fold under one line.
  return (
    <View style={{ gap: 12 }}>
      {/* Stitch "Active waybill": a dark box with the waybill, where he goes now and the price. */}
      <Glow tone="dark" style={{ borderRadius: 24, padding: 16, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.inverseAccent }} />
            <Tech color={c.inverseLabel}>{req.stage === 'dropoff' ? t('atDropoff') : toDrop ? t('goingDropoff') : t('goingPickup')}</Tech>
          </View>
          <Tech color={c.onInverseMuted}>{`#XP-${req.id.replace(/[^0-9a-z]/gi, '').slice(-4).toUpperCase()}`}</Tech>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <T size={22} weight="heavy" color={c.onInverse} style={{ flex: 1 }}>
            {going}
          </T>
          <T size={20} weight="heavy" color={c.inverseAccent}>
            {dh(req.price, lang)}
          </T>
        </View>
      </Glow>
      {/* Stitch "accepted mission": the next stop in the sky card, the cash to collect beside it. */}
      {needsTake ? null : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Glow tone="sky" style={{ flex: 1, borderRadius: 22, padding: 12, gap: 2 }}>
            <T size={12} weight="semibold" color={c.onSky}>
              {toDrop || req.stage === 'dropoff' ? t('nextStopDrop') : t('nextStopPickup')}
            </T>
            <T size={16} weight="heavy" color={c.onSky}>
              {going.split(/[,،]/)[0]}
            </T>
            {req.km ? (
              <T size={12} color={c.onSky}>
                {`≈ ${fmtKm(req.km, lang)}`}
              </T>
            ) : null}
          </Glow>
          <Glow tone="glass" style={{ flex: 1, borderRadius: 22, padding: 12, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              <T size={12} weight="semibold" muted>
                {t('toCollect')}
              </T>
              <View style={{ backgroundColor: c.liveSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Tech color={c.live}>{t('payEspeces')}</Tech>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <T size={24} weight="heavy">
                {String(req.price)}
              </T>
              <T size={12} weight="bold" muted>
                {lang === 'ar' ? 'درهم' : 'DH'}
              </T>
            </View>
            <T size={11} muted>
              {payer}
            </T>
          </Glow>
        </View>
      )}
      {/* The price can be updated before loading (owner: make it easy to find), right under where he goes. */}
      {!needsTake && canAskPrice(req) && !req.priceAsk ? (
        <Pressable hitSlop={6}
          accessibilityRole="button"
          onPress={() => {
            tap();
            setAskOpen(true);
          }}
          style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 36, borderRadius: 999, backgroundColor: c.warnSoft, borderWidth: 1, borderColor: c.warn, opacity: pressed ? 0.85 : 1 })}>
          <Ionicons name="pricetag-outline" size={16} color={c.warn} />
          <T size={13} weight="heavy" color={c.warn}>
            {t('pa_btn')}
          </T>
        </Pressable>
      ) : null}
      <PriceAskSheet req={req} visible={askOpen} onClose={() => setAskOpen(false)} />
      <Steps stage={req.stage} side="driver" />
      {/* Round 10: a price being talked over comes first, so it isn't missed. */}
      <PriceAskCard req={req} role="driver" />
      {/* Rules 2 and 11: a new time the customer asks for; the customer says the helpers didn't come. */}
      <TimeAskCard req={req} role="driver" />
      {/* Rule 12: a company chooses who drives and which vehicle. */}
      <AssignCard req={req} />
      <HelpersClaimDriver req={req} />
      {/* Booked: the price, big, and one button (simple design: no long explanation). */}
      {needsTake ? (
        <View style={{ borderRadius: 16, padding: 16, gap: 10, backgroundColor: c.surface, borderWidth: 2, borderColor: c.accent, alignItems: 'center' }}>
          <Tag tone="ok">{t('confirmTrip')}</Tag>
          <T size={16} weight="heavy" style={{ textAlign: 'center' }}>
            {t('takeTitle')}
          </T>
          <T size={36} weight="heavy">
            {dh(req.price, lang)}
          </T>
          <T size={14} weight="semibold" muted>
            {formatWhen(req.when, lang, t)}
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
            style={({ pressed }) => ({ alignSelf: 'stretch', minHeight: 54, borderRadius: 999, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.88 : 1 })}>
            <Ionicons name="checkmark-done" size={20} color={c.onAccent} />
            <T size={16} weight="heavy" color={c.onAccent}>
              {t('takeYes')}
            </T>
          </Pressable>
          <View style={{ alignSelf: 'stretch' }}>
            <Btn title={t('takeNo')} kind="danger" small onPress={() => setCancel(true)} />
          </View>
        </View>
      ) : null}
      {scheduled && !needsTake ? (
        <Card>
          <T weight="heavy">{t('bookedFor', { when: formatWhen(req.when, lang, t) })}</T>
          <T size={13} muted>
            {countdown(req, t)}
          </T>
        </Card>
      ) : null}
      {/* Rule 1: a call to the customer after taking the trip and on the way. */}
      <CallNudge req={req} />
      {req.stage === 'accepted' && !needsTake ? <StepAction title={t('onMyWayBtn')} icon="navigate" onPress={() => setStage(req.id, 'enroute')} /> : null}
      {req.stage === 'enroute' ? (
        <>
          {atPickup ? (
            <T size={14} weight="bold" color={c.live} style={{ textAlign: 'center' }}>
              {t('gpsAtPickup')}
            </T>
          ) : null}
          <StepAction title={t('arrivedBtn')} icon="location" onPress={() => setStage(req.id, 'arrived')} />
        </>
      ) : null}
      {req.stage === 'arrived' ? (
        <>
          <T size={14} muted style={{ textAlign: 'center' }}>
            {t('loadingFor', { time: loading })}
          </T>
          <StepAction title={t('loadedBtn')} icon="cube" onPress={() => setStage(req.id, 'loaded')} />
          {/* Rules 1 and 11: nobody answers here; the team photo when helpers were promised. */}
          <AtPickupDriver req={req} />
        </>
      ) : null}
      {req.stage === 'loaded' ? (
        <>
          {atDrop ? (
            <T size={14} weight="bold" color={c.live} style={{ textAlign: 'center' }}>
              {t('gpsAtDropoff')}
            </T>
          ) : null}
          <StepAction title={t('arrivedDropBtn')} icon="flag" onPress={() => setStage(req.id, 'dropoff')} />
        </>
      ) : null}
      {req.stage === 'dropoff' ? (
        <Card>
          <T weight="heavy">{t('handOverTitle')}</T>
          <T size={14} muted>
            {t('handOverSub', { price: dh(req.price, lang), who: payer })}
          </T>
          <StepAction title={t('handedOverBtn')} icon="checkmark-done" onPress={handOver} />
        </Card>
      ) : null}
      {needsTake ? null : <Btn title={t('directions')} kind="ghost" icon="navigate" small onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(going)}`).catch(() => {})} />}
      <ChatButton req={req} role="driver" />
      {/* The load: one line; tap to see everything (photos, voice, floors, helpers, notes). */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: details }}
        onPress={() => {
          tap();
          setDetails(!details);
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 12, opacity: pressed ? 0.88 : 1 })}>
        <View style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
          {req.photoUri ? <Image source={{ uri: req.photoUri }} style={{ width: 44, height: 44 }} resizeMode="cover" /> : <Ionicons name="cube-outline" size={22} color={c.muted} />}
        </View>
        <View style={{ flex: 1 }}>
          <T size={15} weight="heavy">
            {t('loadDetails')}
          </T>
          <T size={12} muted>
            {loadOf(req, t) || (req.goods ? t(`g_${req.goods}` as Key) : '')}
          </T>
        </View>
        <Ionicons name={details ? 'chevron-up' : 'chevron-down'} size={20} color={c.muted} />
      </Pressable>
      {details ? (
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
            <T size={14} weight="bold" style={{ flex: 1 }}>
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
        </Card>
      ) : null}
      {['arrived', 'loaded', 'dropoff'].includes(req.stage) ? (
        <Card>
          <TripPhotos req={req} side="driver" canAdd />
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {!toDrop && !needsTake ? (
          <View style={{ flex: 1 }}>
            <Btn title={t('cancelJobShort')} kind="danger" small onPress={() => setCancel(true)} />
          </View>
        ) : null}
      </View>
      <HelpButton />
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
// Stitch earnings: a forest-green revenue box, sage tiles, emerald for what he keeps.
export function Earnings({ done }: { done: Request[] }) {
  const [showPast, setShowPast] = useState(false);
  const c = useColors();
  const EARN = EARN_COLORS;
  const { t, lang } = useT();
  const total = done.reduce((s, r) => s + r.price, 0);
  // Rule 5: each trip keeps the app's share it was booked with (the admins can change the rate for new trips).
  const share = Math.round(done.reduce((n, r) => n + r.price * (r.commissionRate ?? COMMISSION_RATE), 0));
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
        <Ionicons name={icon} size={16} color={c.onInverse} />
      </View>
      <T size={11} weight="bold" color={SIGNAL.onBright}>
        {label}
      </T>
      <T size={15} weight="heavy" color={tint}>
        {dh(value === '' ? 0 : Number(value), lang)}
      </T>
    </View>
  );
  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: EARN.orange, borderRadius: 24, padding: 14, overflow: 'hidden', gap: 2 }}>
        {/* Two soft circles for depth. */}
        <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: EARN.orange2, top: -70, end: -50, opacity: 0.85 }} />
        <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: fade(c.onInverse, 0.10), bottom: -50, start: -30 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="wallet" size={18} color={c.onInverse} />
          <T size={13} weight="bold" color={c.onInverse}>
            {t('cashCollected')}
          </T>
        </View>
        <T size={34} weight="heavy" color={c.onInverse}>
          {dh(total, lang)}
        </T>
        <View style={{ alignSelf: 'flex-start', backgroundColor: fade(c.onInverse, 0.2), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
          <T size={12} weight="bold" color={c.onInverse}>
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
      {/* Owner's report #17: everything on one page; the past trips open behind one button. */}
      {done.length ? (
        <Btn title={t('pastTripsShow', { n: done.length })} kind="ghost" icon="receipt-outline" small onPress={() => setShowPast(true)} />
      ) : null}
      {/* Report #47: the past trips open in a sheet, so this page never grows past the screen. */}
      <Sheet visible={showPast} onClose={() => setShowPast(false)} title={t('pastTripsShow', { n: done.length })}>
      {done.map((r) => (
        <Card key={r.id} style={{ gap: 8, borderStartWidth: 5, borderStartColor: EARN.green }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: EARN.pickup }} />
                <T size={14} weight="bold" style={{ flex: 1 }}>
                  {r.from}
                </T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: EARN.drop }} />
                <T size={14} weight="bold" style={{ flex: 1 }}>
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
          <T size={12} muted>
            {loadOf(r, t)}
          </T>
        </Card>
      ))}
      </Sheet>
      {!done.length ? (
        // No trips yet: one short line, so the page still fits on one screen (report #17).
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
          <Ionicons name="wallet-outline" size={18} color={EARN.orange} />
          <T size={13} muted style={{ flex: 1 }}>
            {t('noEarnings')}
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** The customer's photo and name (tap for their profile); never their phone number. */
/**
 * Owner's report #24: an announced trip opened like a story — the way there (and back) on small maps,
 * when, how long it stays shown, and Edit / Delete.
 */
function StoryViewer({ plan, onClose, onEdit }: { plan: TripPlan | null; onClose: () => void; onEdit: (p: TripPlan) => void }) {
  const c = useColors();
  const { t, lang, route } = useT();
  const [del, setDel] = useState(false);
  if (!plan) return null;
  const a = getPlace(plan.fromPlaceId);
  const b = getPlace(plan.toPlaceId);
  const leg = (from: string, to: string, when: string, there: boolean) => (
    <Glow style={{ borderRadius: 22, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Glow tone={there ? 'accent' : 'sky'} style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={there ? 'navigate' : 'return-down-back'} size={16} color={there ? c.onAccent : c.onSky} />
        </Glow>
        <View style={{ flex: 1 }}>
          <T size={12} muted>
            {there ? t('storyGoing') : t('storyBack')}
          </T>
          <T size={15} weight="heavy">
            {route(from.split(/[,،]/)[0], to.split(/[,،]/)[0])}
          </T>
        </View>
        <T size={12} weight="bold" color={c.live}>
          {when}
        </T>
      </View>
      {a && b ? <MiniTripMap from={there ? { lat: a.lat, lng: a.lng } : { lat: b.lat, lng: b.lng }} to={there ? { lat: b.lat, lng: b.lng } : { lat: a.lat, lng: a.lng }} height={130} /> : null}
    </Glow>
  );
  const until = new Date(planEnd(plan));
  return (
    <Sheet visible={!!plan} onClose={onClose} title={t('storyTitle')}>
      <View style={{ gap: 12 }}>
        {leg(plan.from, plan.to, planWhen(plan, t, lang), true)}
        {plan.back ? leg(plan.to, plan.from, formatWhen(plan.backWhen ?? 'now', lang, t), false) : null}
        <T size={12} muted>
          {t('storyUntil', { date: until.toLocaleDateString(lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) })}
        </T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Btn title={t('edit')} kind="ghost" icon="create-outline" onPress={() => onEdit(plan)} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn title={t('delete')} kind="danger" icon="trash-outline" onPress={() => setDel(true)} />
          </View>
        </View>
      </View>
      <Confirm
        visible={del}
        title={t('storyDeleteQ')}
        body={route(plan.from.split(/[,،]/)[0], plan.to.split(/[,،]/)[0])}
        yes={t('delete')}
        onNo={() => setDel(false)}
        onYes={() => {
          setDel(false);
          update((s) => ({ ...s, driver: { ...s.driver, plans: (s.driver.plans ?? []).filter((x) => x.id !== plan.id) } }));
          onClose();
        }}
      />
    </Sheet>
  );
}

/** The customer of a load: photo and name (profile), then in-app Call and Message (owner's report #16). */
function CustomerContact({ req }: { req: Request }) {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const me = store.customer;
  // Rule 8: the customer's own number only on the trip day (offered after 2 unanswered in-app calls).
  const person: Person = { role: 'customer', name: me.name || t('customer'), photo: me.photoUri, city: me.city || undefined, phone: tripDay(req) ? customerPhone(req, store) : undefined };
  return (
    <Glow style={{ borderRadius: 22, padding: 12, gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${person.name}. ${t('seeProfile')}`} onPress={() => setOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={person.name} uri={person.photo} size={44} />
        <View style={{ flex: 1 }}>
          <T size={12} muted>
            {t('customer')}
          </T>
          <T size={16} weight="heavy">
            {person.name}
          </T>
        </View>
        <T size={13} weight="bold" color={c.live}>
          {t('seeProfile')}
        </T>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <CallButton person={person} label={t('callCustomer')} onChat={() => openTab('messages', req.id)} />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            openTab('messages', req.id);
          }}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', gap: 8, minHeight: 48, borderRadius: 999, backgroundColor: c.liveSoft, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={c.live} />
          <T size={15} weight="bold" color={c.live}>
            {t('messageBtn')}
          </T>
        </Pressable>
      </View>
      <PersonSheet person={open ? person : null} onClose={() => setOpen(false)} />
    </Glow>
  );
}

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

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, PanResponder, Pressable, ScrollView, Share, useWindowDimensions, View } from 'react-native';

import { TextInput } from './field';

import { previewAi, type Draft } from './ai';
import type { NoteTag } from './choices';
import { estimateTrip, HelpSection, matchPlace, RouteFields, ShareSection } from './extras';
import { translate, useT, type Key } from './i18n';
import { Overlay } from './overlay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPlace } from './lib/places';
import { Chip, Confirm, dh, Initials, loadOf, PhotoStrip, Section, Steps, VehicleRow, vName } from './shared';
import { useBack } from './back';
import { autoDir, BitBubble, Composer, type Bit } from './composer';
import { CallButton } from './call';
import { bookingWhen, stepText, stepVars, tripPlan } from './engine';
import { HelpButton, HelpSheet } from './help';
import { setPage, setTripOnScreen } from './where';
import { Avatar, driverRating, PersonChip, PersonSheet, Stars, type Person } from './people';
import { onHome, onOpenTrip, onRepeat, openTab } from './home';
import { saveOnRestart, takeRestored } from './resume';
import { play } from './sounds';
import { appMessage, companionAt, companionNext, getState, stairFloors, isLive, newId, notify, sendMessage, patchRequest, unread, runExampleTrip, scheduleExampleOffers, setStage, update, useStore, type Companion, type Offer, type Request } from './store';
import { Btn, Card, ColorsContext, LiveDot, mainScroll, Pill, T, tap, useColors, useHoldRepeat, useKeyboardInset, VoicePlayer } from './ui';
import { formatWhen, WhenPicker } from './wheels';
import { fmtKg } from './scan';
import type { VehicleId } from './vehicles';
import { CARE_TAGS, capture, draftFromChecked, FloorQuestion, floorSummary, suggestedVehicle, MAX_PHOTOS, NO_ANSWERS, okAnswers, NO_MEDIA, NO_ROUTE, SawStep, ScanStep, ShowStep, stepNav, StepsBar, type Answers, type Checked, type Media, type Shot, type TripRoute } from './flow';
import { scanLoad } from './scan';
import { setMapBig, setMapPanel, setMapRadar, setMapShown, setMapTrip, setMapVehicle } from './map/trip';
import { CancelSheet, countdown, Sheet, TripPhotos, useLoadingTimer, useVehicle } from './trip';
import { PriceAskCard } from './priceask';
import { checkTripsNow } from './engine';

/** Which parts of the request the AI filled in (marked "AI" until the customer changes them). */
type AiMarks = Partial<Record<'goods' | 'weight' | 'vehicle' | 'route' | 'when' | 'notes' | 'price', boolean>>;
type CardState = Draft & {
  /** Who will be with the driver (the customer or someone else). */
  companion?: Companion;
  /** Shared (cheaper, other loads on the way) or private (default). */
  shared?: boolean;
  /** A voice note for the driver, recorded on the card. */
  noteVoice?: VoiceNote;
  /** Notes for the driver written, recorded or photographed in the message bar. */
  noteBits?: Bit[];
  /** Notes for the driver picked from the list (i18n keys). */
  quick?: QuickNote[];
  fromPlaceId?: string;
  toPlaceId?: string;
  ai: AiMarks;
  usedAi: boolean;
  aiNote: Key | '';
  vehiclePicked: boolean;
};


function fromDraft(d: Draft, prev?: CardState): CardState {
  const a = d.from && d.from !== prev?.from ? matchPlace(d.from) : undefined;
  const b = d.to && d.to !== prev?.to ? matchPlace(d.to) : undefined;
  return {
    ...d,
    weightKg: d.weightKg,
    fromPlaceId: a?.id ?? (d.from === prev?.from ? prev?.fromPlaceId : undefined),
    toPlaceId: b?.id ?? (d.to === prev?.to ? prev?.toPlaceId : undefined),
    ai: {
      goods: !!d.goods,
      weight: d.weightKg > 0,
      vehicle: true,
      route: !!(d.from || d.to),
      when: d.when !== 'now',
      notes: d.noteTags.length > 0,
      price: true,
    },
    usedAi: true,
    aiNote: '',
    vehiclePicked: false,
  };
}

/** The request in progress is announced only once per opening of the app (not after each switch of side). */
const announced = { done: false };

export function CustomerSide({ openSettings }: { openSettings: () => void }) {
  const store = useStore();
  const { t, lang, route } = useT();
  const active = store.requests.find((r) => r.id === store.activeRequestId);
  // After a language restart (#101): the same page, with everything filled in so far.
  type Snap = { step: 'show' | 'scan' | 'saw' | 'card'; trip: boolean; media: Media; card: CardState | null; checked: Checked; answers: Answers; tripRoute: TripRoute; trail: ('show' | 'scan' | 'saw' | 'card' | 'trip')[] };
  const [snap] = useState(() => takeRestored<Snap>('customer'));
  const [step, setStep] = useState<'show' | 'scan' | 'saw' | 'card'>(snap ? (snap.step === 'scan' ? 'show' : snap.step) : 'show');
  const [media, setMedia] = useState<Media>(snap?.media ?? NO_MEDIA);
  const [card, setCard] = useState<CardState | null>(snap?.card ?? null);
  const [checked, setChecked] = useState<Checked>(snap?.checked ?? emptyChecked());
  const [answers, setAnswers] = useState<Answers>(okAnswers(snap?.answers));
  const [tripRoute, setTripRoute] = useState<TripRoute>(snap?.tripRoute ?? NO_ROUTE);
  const [note, setNote] = useState<Key | ''>('');
  const [error, setError] = useState<Key | ''>('');
  const [scanPhotos, setScanPhotos] = useState<Shot[]>([]);
  const [editingLoad, setEditingLoad] = useState(false);
  // The app opens on the first page; a request in progress is one tap away ("Open").
  // It opens by itself only when it is new (just sent) during this visit.
  const tripActive = !!active && active.stage !== 'cancelled';
  const [tripOpen, setTripOpen] = useState(!!snap?.trip);
  const seenTrip = useRef(active?.id);
  useEffect(() => {
    if (active?.id && active.id !== seenTrip.current) {
      // Just sent: the trip opens, and back from it goes to the first page.
      setTrail(['show']);
      setTripOpen(true);
    }
    seenTrip.current = active?.id;
  }, [active?.id]);
  const showingTrip = tripActive && tripOpen;
  // Where the customer has been, so the back button returns to the page before (not the first page).
  type Page = 'show' | 'scan' | 'saw' | 'card' | 'trip';
  const current: Page = showingTrip ? 'trip' : step;
  const [trail, setTrail] = useState<Page[]>(snap?.trail ?? []);
  const live = useRef<Snap | null>(null);
  live.current = { step, trip: tripOpen, media, card, checked, answers, tripRoute, trail };
  useEffect(() => saveOnRestart('customer', () => live.current), []);
  const [resume, setResume] = useState<Page | null>(null);
  const apply = (page: Page) => {
    if (page === 'trip') setTripOpen(true);
    else {
      setTripOpen(false);
      setStep(page);
    }
  };
  const go = (page: Page) => {
    if (page === current) return;
    setTrail([...trail, current]);
    apply(page);
  };
  // "What we saw" exists once the photos were read or the list was filled by hand.
  const hasLoad = () => checked.scan.items.length > 0 || checked.scan.goods.length > 0 || (checked.others ?? []).length > 0 || !!(checked.otherText ?? '').trim();
  const hasSaw = () => !!card || hasLoad();
  const goBack = () => {
    const next = [...trail];
    let page = next.pop();
    // The reading screen is never gone back to.
    while (page === 'scan' && next.length) page = next.pop();
    // From the details, back is always "What we saw" (to check or change the load), never the camera.
    if (current === 'card' && hasLoad() && page !== 'saw') {
      if (page) next.push(page);
      page = 'saw';
    }
    setTrail(next);
    if (page) apply(page === 'scan' ? 'show' : page);
  };
  useBack(trail.length > 0, goBack);
  // The X logo: to the first page, keeping the progress to continue later.
  useEffect(
    () =>
      onHome(() => {
        if (current !== 'show' && current !== 'trip' && current !== 'scan') setResume(current);
        setTrail([]);
        apply('show');
      }),
  );
  // A tapped notification opens the request in progress.
  useEffect(() => onOpenTrip(() => tripActive && go('trip')));
  // "Repeat this request" from the history (round 7): the same load and route, a fresh card.
  useEffect(() =>
    onRepeat((id) => {
      const r = getState().requests.find((x) => x.id === id);
      if (!r) return;
      const photos = (r.photoUris?.length ? r.photoUris : r.photoUri ? [r.photoUri] : []).map((uri) => ({ uri, base64: '' }));
      setMedia({ ...NO_MEDIA, photos, photoUri: photos[0]?.uri ?? '' });
      setTripRoute({ from: r.from, to: r.to, fromPlaceId: r.fromPlaceId, toPlaceId: r.toPlaceId });
      setCard({
        goods: (r.goods ?? '') as CardState['goods'],
        load: r.load,
        loadKinds: r.loadKinds,
        loadOthers: r.loadOthers,
        floor: r.floor,
        floors: r.floors,
        anyVehicle: r.anyVehicle,
        weightKg: r.weightKg,
        vehicle: r.vehicle,
        from: r.from,
        to: r.to,
        fromPlaceId: r.fromPlaceId,
        toPlaceId: r.toPlaceId,
        when: 'now',
        price: r.price,
        fairMin: r.fairMin,
        fairMax: r.fairMax,
        km: r.km,
        noteTags: r.noteTags as CardState['noteTags'],
        notes: '',
        helpers: r.helpers,
        rideAlong: r.rideAlong,
        companion: r.companion,
        shared: r.shared,
        ai: {},
        usedAi: false,
        aiNote: 'repeatNote',
        vehiclePicked: true,
      });
      setTrail(['show']);
      setTripOpen(false);
      setStep('card');
    }),
  );
  // A request in progress is announced once when the app opens, as a passing notification
  // (the first page itself only shows the question and the camera).
  useEffect(() => {
    if (announced.done) return;
    announced.done = true;
    const timer = setTimeout(() => {
      const r = store.requests.find((q) => q.id === store.activeRequestId);
      if (!r || r.stage === 'cancelled' || (r.stage === 'delivered' && (r.receivedAt || r.rating))) return;
      // A new price the driver suggested waits for an answer: say that first (round 10).
      if (r.priceAsk?.by === 'driver' && isLive(r.stage)) return notify('customer', 'nt_priceAsk', 'offer', { name: r.driverName ?? '', price: r.priceAsk.price }, undefined, r.id);
      const status = r.stage === 'open' ? t('waitingOffers') : r.stage === 'delivered' ? t('stConfirmReceipt') : t(`st_${r.stage}` as Key);
      notify('customer', 'nt_tripNow', 'pop', { route: route(r.from.split(/[,،]/)[0], r.to.split(/[,،]/)[0]), status });
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The step bar can be tapped: Show it, Details (once there is a load), Send (the request in progress).
  stepNav.current = (i: number) => {
    // Step 1 opens its last page: "What we saw" when there is one, otherwise the camera.
    if (i === 0) go(hasSaw() && current !== 'saw' ? 'saw' : 'show');
    else if (i === 1) {
      if (card) go('card');
      else if (hasLoad() && (!tripRoute.from.trim() || !tripRoute.to.trim())) go('saw');
      else if (hasLoad()) {
        const d = draftFromChecked(checked, answers, t);
        setCard({ ...fromDraft(d), ...tripRoute, ai: { goods: checked.scan.goods.length > 0, weight: d.weightKg > 0, vehicle: !checked.vehicle, notes: checked.care.length > 0 }, usedAi: !!checked.scan.summary });
        go('card');
      }
    } else if (i === 2 && tripActive) go('trip');
  };
  const aiOn = !!store.aiKey || previewAi();
  // The map behind the screen shows the trip: the request on its way, or the card being filled.
  // The finished trip stays on the map on the delivered page too.
  const shown = showingTrip ? active : step === 'card' ? card : null;
  const from = getPlace(shown?.fromPlaceId);
  const to = getPlace(shown?.toPlaceId);
  useEffect(() => {
    setMapTrip({
      from: from ? { lat: from.lat, lng: from.lng } : undefined,
      to: to ? { lat: to.lat, lng: to.lng } : undefined,
    });
  }, [from, to]);
  // The first steps use the whole screen; the map comes in once there is a trip to show.
  const busyRequest = showingTrip;
  useEffect(() => {
    // The request card keeps the plain background; the map comes once the request is sent,
    // big while it waits for offers.
    setMapShown(busyRequest);
    // The map fills the screen from the moment the request is sent until it is delivered.
    setMapBig(busyRequest && !!active && (active.stage === 'open' || isLive(active.stage) || active.stage === 'delivered'));
    setMapRadar(busyRequest && active?.stage === 'open');
    return () => {
      setMapShown(true);
      setMapBig(false);
      setMapRadar(false);
    };
  }, [busyRequest, active?.stage]);
  // The phone's back button: one page back at a time.
  // Each new step starts at the top of the screen.
  // Only when the page on screen changes: a trip moving on in the background (another stage) must
  // never move the page the customer is working on.
  const pageKey = showingTrip ? `trip:${active?.stage}` : step;
  useEffect(() => {
    mainScroll.current?.scrollTo({ y: 0, animated: false });
    setPage(`customer · ${pageKey}`);
  }, [pageKey]);
  useEffect(() => setTripOnScreen(showingTrip && active ? active.id : ''), [showingTrip, active?.id]);
  const reset = () => {
    setEditingLoad(false);
    setTrail([]);
    setResume(null);
    setStep('show');
    setMedia(NO_MEDIA);
    setCard(null);
    setChecked(emptyChecked());
    setAnswers(NO_ANSWERS);
    setTripRoute(NO_ROUTE);
    setNote('');
    setError('');
  };

  /** Takes or picks photos. On the first page they pile up until "Analyse"; `more` (from "What we saw") adds and reads them at once. */
  const shoot = async (source: 'camera' | 'library', more = false) => {
    setError('');
    const got = await capture(source, more ? 3 : MAX_PHOTOS - media.photos.length);
    if (!got) return;
    if (typeof got === 'string') {
      setError(got);
      return;
    }
    play('pop');
    const photos = [...media.photos, ...got];
    setMedia({ ...media, photos, photoUri: photos[0].uri, photoBase64: photos[0].base64 });
    if (more) {
      setScanPhotos(got);
      go(aiOn ? 'scan' : 'saw');
    }
  };
  const removePhoto = (index: number) => {
    const photos = media.photos.filter((_, i) => i !== index);
    setMedia({ ...media, photos, photoUri: photos[0]?.uri ?? '', photoBase64: photos[0]?.base64 ?? null });
  };
  const analyse = () => {
    setChecked(emptyChecked());
    setAnswers(NO_ANSWERS);
    setScanPhotos(media.photos);
    setNote(aiOn ? '' : 'scanNoAi');
    setResume(null);
    go(aiOn ? 'scan' : 'saw');
  };


  if (showingTrip && active) {
    if (active.stage === 'open') return <Offers req={active} />;
    if (active.stage === 'delivered')
      return (
        <Done
          req={active}
          onNew={() => {
            update((s) => ({ ...s, activeRequestId: null }));
            setTripOpen(false);
            reset();
          }}
        />
      );
    return <Track req={active} />;
  }
  if (step === 'card' && card)
    return (
      <CardScreen
        media={media}
        card={card}
        setCard={setCard}
        onBack={goBack}
        onSent={reset}
        onEditLoad={() => {
          setEditingLoad(true);
          go('saw');
        }}
        route={tripRoute}
        setRoute={setTripRoute}
        autoVehicle={(km) => (checked.vehicle || checked.anyVehicle ? null : suggestedVehicle({ ...checked, km }))}
      />
    );
  if (step === 'scan')
    return (
      <ScanStep
        media={media}
        photos={scanPhotos}
        run={(onBatch) => scanLoad(store.aiKey, scanPhotos.map((p) => p.base64), lang, checked.scan.items.length ? checked.scan : undefined, onBatch)}
        onDone={(scan, why) => {
          if (scan) {
            const first = !checked.scan.items.length;
            const next: Checked = {
              scan,
              vehicle: checked.vehicle,
              care: first ? scan.care : Array.from(new Set([...checked.care, ...scan.care])),
              helpers: first ? scan.helpers : Math.max(checked.helpers, scan.helpers),
            };
            setChecked(next);
            play('success');
            // Simple design: the photos were read, so straight to the one request page (the load
            // shows there in one line, with Edit). More photos added from Edit go back to the list.
            if (first && scan.items.length && !editingLoad) {
              const d = draftFromChecked(next, answers, t);
              setCard({ ...fromDraft(d), ...tripRoute, ai: { goods: scan.goods.length > 0, weight: d.weightKg > 0, vehicle: !next.vehicle, notes: next.care.length > 0 }, usedAi: !!scan.summary });
              setNote(why);
              setStep('card');
              return;
            }
          }
          setNote(why);
          setStep('saw');
        }}
      />
    );
  if (step === 'saw')
    return (
      <SawStep
        media={media}
        checked={checked}
        setChecked={setChecked}
        answers={answers}
        setAnswers={setAnswers}
        note={note}
        onRetake={reset}
        onMorePhoto={() => shoot('camera', true)}
        route={tripRoute}
        setRoute={setTripRoute}
        onNext={() => {
          if (editingLoad && card) {
            // Back from "Edit": the card keeps its route, time and price and takes the new load.
            const d = draftFromChecked(checked, answers, t);
            const keep = card.noteTags.filter((n) => n === 'narrow');
            // Floors, care, helpers and notes are answered on the request page itself (simple design): kept.
            void keep;
            setCard({ ...card, ...tripRoute, anyVehicle: d.anyVehicle, goods: d.goods, load: d.load, loadKinds: d.loadKinds, loadOthers: d.loadOthers, floor: d.floor, weightKg: d.weightKg, vehicle: d.vehicle, floorText: d.floorText });
            setEditingLoad(false);
            goBack();
            return;
          }
          // Straight to the request: route, time and price are picked there.
          const d = draftFromChecked(checked, answers, t);
          setCard({
            ...fromDraft(d),
            ...tripRoute,
            ai: { goods: checked.scan.goods.length > 0, weight: d.weightKg > 0, vehicle: !checked.vehicle, notes: checked.care.length > 0 },
            usedAi: !!checked.scan.summary,
          });
          go('card');
        }}
      />
    );
  return (
    <>
      {resume && !tripActive ? (
        <Card style={{ gap: 10 }}>
          <T weight="heavy">{t('resumeTitle')}</T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Btn
                title={t('resumeContinue')}
                small
                icon="arrow-forward"
                onPress={() => {
                  const page = resume;
                  setResume(null);
                  go(page);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Btn title={t('resumeOver')} small kind="ghost" onPress={reset} />
            </View>
          </View>
        </Card>
      ) : null}
      <ShowStep
        photos={media.photos}
        onShoot={(source) => shoot(source)}
        onRemove={removePhoto}
        onAnalyse={analyse}
        error={error}
        onSkip={() => {
          setChecked(emptyChecked());
          setNote('');
          go('saw');
        }}
      />
    </>
  );
}

/** A recorded voice note: where it is on the phone and how long it lasts. */
type VoiceNote = { uri: string; ms: number };

const QUICK_NOTES = ['ns_narrow', 'ns_far', 'ns_guard', 'ns_dismantle', 'ns_ready'] as const;
type QuickNote = (typeof QUICK_NOTES)[number];

const emptyChecked = (): Checked => ({
  scan: {
    summary: '',
    goods: [],
    items: [],
    vehicle: 'smallVan',
    care: [],
    helpers: 0,
  },
  vehicle: null,
  care: [],
  helpers: 0,
});

// ---------------- The request card: every answer is a choice the customer can change ----------------

/** In a phone's browser a long press would select text or open a menu and cut the hold short. */
const NO_SELECT = { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation' } as object;

function CardScreen({ media, card, setCard, onBack, onSent, onEditLoad, setRoute, route: tripRoute, autoVehicle }: { media: Media; card: CardState; setCard: (c: CardState) => void; onBack: () => void; onSent: () => void; onEditLoad: () => void; /** The route also lives on the page (kept for Edit). */ setRoute: (r: TripRoute) => void; route: TripRoute; /** The vehicle the app picks for a distance, unless the customer chose one. */ autoVehicle: (km: number) => VehicleId | null }) {
  const c = useColors();
  const store = useStore();
  const { t, lang, route } = useT();
  const [error, setError] = useState<Key | ''>('');
  const [more, setMore] = useState(false);
  const routeNow = useRef(tripRoute);
  routeNow.current = tripRoute;
  const routeY = useRef(0);
  const set = (patch: Partial<CardState>, mark?: keyof AiMarks) =>
    setCard({
      ...card,
      ...patch,
      ai: mark ? { ...card.ai, [mark]: false } : card.ai,
    });

  const est = estimateTrip(card.fromPlaceId, card.toPlaceId, card.vehicle, card.helpers, stairFloors(card.floors));
  const lo = card.fairMin || est?.low || 0;
  const hi = card.fairMax || est?.high || 0;
  const km = est?.km ?? card.km;
  // Without an AI price, the price follows the estimate as the route, vehicle and helpers change.
  const lastEst = useRef(0);
  useEffect(() => {
    if (est && !card.fairMin && est.suggested !== lastEst.current) {
      lastEst.current = est.suggested;
      setCard({ ...card, price: est.suggested });
    }
  });

  // The vehicle follows the distance (a triporteur isn't offered between cities) unless chosen by hand.
  const autoV = useRef(autoVehicle);
  autoV.current = autoVehicle;
  useEffect(() => {
    if (!km) return;
    const now = latestCard.current;
    const v = autoV.current(km);
    if (v && v !== now.vehicle && !now.anyVehicle) setCard({ ...now, vehicle: v });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [km]);
  // Nothing is chosen for the customer (round 8): the question must be answered before sending.
  const comp: Companion = card.companion ?? {};
  const helpY = useRef(0);
  const compYs = useRef<Record<string, number>>({});
  const send = () => {
    const voices = [...(card.noteVoice ? [{ uri: card.noteVoice.uri, ms: card.noteVoice.ms }] : []), ...(card.noteBits ?? []).filter((b) => b.kind === 'voice')];
    if (!card.goods && !card.load.trim()) {
      setError('needGoods');
      return;
    }
    // The exact question left unanswered is named, shown in red, and scrolled to (#81).
    const missing = companionNext(comp);
    if (missing) {
      setError(missing === 'who' ? 'needCompWho' : missing === 'where' ? (comp.who === 'me' ? 'needCompWhereMe' : 'needCompWhereThem') : 'needCompPays');
      mainScroll.current?.scrollTo({ y: Math.max(0, helpY.current + (compYs.current[missing] ?? 0) - 90), animated: true });
      return;
    }
    if (!card.from.trim() || !card.to.trim()) {
      setError('needRoute');
      // Back up to the route so it's clear what is missing.
      mainScroll.current?.scrollTo({ y: Math.max(0, routeY.current - 12), animated: true });
      return;
    }
    const req: Request = {
      id: newId(),
      createdAt: Date.now(),
      goods: card.goods || undefined,
      load: card.load.trim() || (card.goods ? t(`g_${card.goods}` as Key) : ''),
      loadKinds: card.loadKinds,
      anyVehicle: card.anyVehicle,
      loadOthers: card.loadOthers,
      floor: card.floor,
      floors: card.floors,
      weightKg: card.weightKg,
      vehicle: card.vehicle,
      from: card.from.trim(),
      to: card.to.trim(),
      when: card.when,
      price: card.price,
      fairMin: lo,
      fairMax: hi,
      costHint: est?.min,
      km,
      notes: [card.floor ? '' : (card.floorText ?? ''), ...(card.quick ?? []).filter((k) => k !== 'ns_narrow').map((k) => t(k)), card.notes.trim(), ...(card.noteBits ?? []).filter((b) => b.kind === 'text').map((b) => b.text ?? '')].filter(Boolean).join('. '),
      noteTags: card.noteTags,
      said: media.said.trim(),
      photoUri: media.photoUri,
      photoUris: media.photos.map((p) => p.uri),
      voiceUri: voices[0]?.uri ?? media.voiceUri,
      voiceMs: voices[0]?.ms ?? media.voiceMs,
      noteVoices: voices.length > 1 ? voices.slice(1).map((v) => ({ uri: v.uri ?? '', ms: v.ms ?? 0 })) : undefined,
      noteFiles: (card.noteBits ?? []).filter((b) => b.kind === 'file' && b.uri).map((b) => ({ uri: b.uri!, name: b.name ?? '' })),
      stage: 'open',
      // A typed place that wasn't picked from the list is still found, so the map can show it.
      fromPlaceId: card.fromPlaceId ?? matchPlace(card.from)?.id,
      toPlaceId: card.toPlaceId ?? matchPlace(card.to)?.id,
      helpers: card.helpers,
      rideAlong: comp.who !== 'none' && companionAt(comp).includes('rides'),
      companion: comp.who === 'other' ? { ...comp, name: (comp.name ?? '').trim() || undefined, phone: (comp.phone ?? '').trim() || undefined } : comp.who === 'me' ? { who: 'me', at: comp.at, rides: comp.rides, pays: 'me' } : { who: 'none', pays: comp.pays },
      shared: !!card.shared,
      messages: [],
    };
    update((s) => ({
      ...s,
      requests: [req, ...s.requests].slice(0, 60),
      activeRequestId: req.id,
    }));
    scheduleExampleOffers(req);
    play('send');
    notify('driver', 'nt_newLoad', 'offer', {
      from: req.from,
      to: req.to,
      price: req.price,
    });
    onSent();
  };

  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  // What the trip costs a driver (fuel, wear, his time): only a hint (round 7). The customer may
  // ask less: drivers already going that way, or coming back empty, often accept.
  const hint = est?.min ?? 0;
  const below = hint > 0 && card.price < hint;
  const applyTyped = () => {
    const v = parseInt(typed, 10);
    if (v > 0) set({ price: Math.min(200000, Math.max(10, v)) }, 'price');
    setTyping(false);
  };
  const hold = useHoldRepeat((delta) => {
    const now = latestCard.current;
    const next = Math.max(10, now.price + delta);
    setCard({ ...now, price: next, ai: { ...now.ai, price: false } });
  });
  const latestCard = useRef(card);
  latestCard.current = card;

  const min = Math.min(lo * 0.6, card.price);
  const max = Math.max(hi * 1.4, card.price);
  const span = max - min || 1;
  const aiLabel = t('aiPicked');

  // Simple design (one page): the load in one line, where from and to, when, who is there, the
  // price, Send. What is optional (floors, care, shared, notes) waits behind «More details».
  const photos = media.photos.length ? media.photos.map((p) => p.uri) : media.photoUri ? [media.photoUri] : [];
  const sameSpot = !!est?.same;
  const extras = [card.floors && (card.floors.pickup.floor !== undefined || card.floors.dropoff.floor !== undefined), card.noteTags.some((n) => n !== 'narrow'), !!card.shared, (card.noteBits ?? []).length > 0].filter(Boolean).length;
  return (
    <View style={{ gap: 14 }}>
      <StepsBar at={1} />
      <T size={26} weight="heavy">
        {t('yourRequest')}
      </T>

      {/* The load, once: small photos, one line, Edit. */}
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('loadTitle')}: ${loadOf(card, t)}. ${t('editLoad')}`} onPress={onEditLoad} style={({ pressed }) => ({ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 12, gap: 10, opacity: pressed ? 0.9 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {photos.length ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {photos.slice(0, 3).map((uri, i) => (
                <View key={uri + i} style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', backgroundColor: c.raised }}>
                  <Image source={{ uri }} style={{ width: 52, height: 52 }} resizeMode="cover" />
                  {i === 2 && photos.length > 3 ? (
                    <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                      <T size={13} weight="heavy" color="#FFFFFF">{`+${photos.length - 3}`}</T>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="cube-outline" size={24} color={c.accent} />
            </View>
          )}
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="create-outline" size={16} color={c.accent} />
            <T size={14} weight="bold" color={c.accent}>
              {t('editLoad')}
            </T>
          </View>
        </View>
        <T size={15} weight="semibold" numberOfLines={2}>
          {loadOf(card, t)}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {card.weightKg ? <Pill>{t('kgEstimate', { kg: fmtKg(card.weightKg, lang) })}</Pill> : null}
          <Pill>{card.anyVehicle ? t('anyVehicle') : vName(t, card.vehicle)}</Pill>
        </View>
      </Pressable>

      {/* Where from, where to (required). */}
      <View
        onLayout={(e) => {
          routeY.current = e.nativeEvent.layout.y;
        }}>
        <RouteFields
          from={{ text: card.from, id: card.fromPlaceId }}
          to={{ text: card.to, id: card.toPlaceId }}
          onFrom={(v, id) => {
            setCard({ ...latestCard.current, from: v, fromPlaceId: id });
            setRoute({ ...routeNow.current, from: v, fromPlaceId: id });
            if (error === 'needRoute') setError('');
          }}
          onTo={(v, id) => {
            setCard({ ...latestCard.current, to: v, toPlaceId: id });
            setRoute({ ...routeNow.current, to: v, toPlaceId: id });
            if (error === 'needRoute') setError('');
          }}
          km={km || undefined}
          error={error === 'needRoute'}
        />
        {sameSpot ? (
          <T size={13} weight="bold" color={c.danger} style={{ marginTop: 6 }}>
            {t('samePlaces')}
          </T>
        ) : null}
      </View>

      <Section title={t('secWhen')} badge={card.ai.when ? aiLabel : undefined}>
        <WhenPicker value={card.when} onChange={(v) => set({ when: v }, 'when')} />
      </Section>

      <View
        onLayout={(e) => {
          helpY.current = e.nativeEvent.layout.y;
        }}>
        <HelpSection
          helpers={card.helpers}
          companion={comp}
          missing={error.startsWith('needComp') ? companionNext(comp) : null}
          ys={compYs}
          onChange={(helpers, companion) => {
            set({ helpers, companion, rideAlong: companion.rides === true });
            if (error.startsWith('needComp') && !companionNext(companion)) setError('');
          }}
        />
      </View>


      {/* Optional, folded: floors, care, shared, notes for the driver. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: more }}
        onPress={() => {
          tap();
          setMore(!more);
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, paddingHorizontal: 14, minHeight: 56, opacity: pressed ? 0.88 : 1 })}>
        <Ionicons name="options-outline" size={20} color={c.accent} />
        <View style={{ flex: 1 }}>
          <T size={15} weight="heavy">
            {t('moreDetails')}
          </T>
          <T size={12} muted numberOfLines={1}>
            {extras ? t('moreDetailsN', { n: extras }) : t('moreDetailsSub')}
          </T>
        </View>
        <Ionicons name={more ? 'chevron-up' : 'chevron-down'} size={20} color={c.muted} />
      </Pressable>
      {more ? (
        <View style={{ gap: 14 }}>
          <Card style={{ gap: 14 }}>
            <T size={17} weight="heavy">
              {t('floorsTitle')}
            </T>
            <FloorQuestion end="pickup" value={(card.floors ?? NO_ANSWERS).pickup} onChange={(v) => set({ floors: { ...(card.floors ?? NO_ANSWERS), pickup: v } })} />
            <View style={{ height: 1, backgroundColor: c.line }} />
            <FloorQuestion end="dropoff" value={(card.floors ?? NO_ANSWERS).dropoff} onChange={(v) => set({ floors: { ...(card.floors ?? NO_ANSWERS), dropoff: v } })} />
          </Card>
          <View style={{ gap: 8 }}>
            <T size={14} muted weight="semibold">
              {t('careTitle')}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CARE_TAGS.map((tag) => (
                <Chip key={tag} label={t(`n_${tag}` as Key)} on={card.noteTags.includes(tag)} onPress={() => set({ noteTags: card.noteTags.includes(tag) ? card.noteTags.filter((x) => x !== tag) : [...card.noteTags, tag] })} />
              ))}
            </View>
          </View>
          <ShareSection shared={!!card.shared} onChange={(shared) => set({ shared })} />
          {/* Only the box: write or record what matters for the driver (no ready-made notes). */}
          <Section title={t('secHelp')} hint={t('secHelpHint2')} badge={card.ai.notes ? aiLabel : undefined}>
            {/* The customer's own notes: a tinted area with a title and a count. */}
            {(card.noteBits ?? []).length ? (
              <View style={{ gap: 8, backgroundColor: c.raised, borderRadius: 18, padding: 10, marginTop: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={c.accent} />
                  <T size={13} weight="heavy" color={c.accent}>
                    {t('yourNotes', { n: (card.noteBits ?? []).length })}
                  </T>
                </View>
                {(card.noteBits ?? []).map((b) => (
                  <BitBubble key={b.id} bit={b} mine side="right" onRemove={() => set({ noteBits: (card.noteBits ?? []).filter((x) => x.id !== b.id) })} />
                ))}
              </View>
            ) : null}
            {/* The message bar, like WhatsApp: words, a voice note or a file for the driver (no photos here). */}
            <Composer hint={t('noteHint')} onSend={(bit) => set({ noteBits: [...(latestCard.current.noteBits ?? []), bit] })} />
          </Section>

        </View>
      ) : null}

      <Section title={t('secPrice')} hint={t('secPriceHint')} badge={card.ai.price ? aiLabel : undefined}>
        {lo && hi ? (
          <T size={13} muted>
            {t('fair', { low: dh(lo, lang), high: dh(hi, lang) })}
          </T>
        ) : null}
        {/* Always − price + (also in Arabic); holding a button keeps it going. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            direction: 'ltr',
          }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('lower')}
            onPressIn={() => hold.start(-10)}
            onPressOut={hold.stop}
            delayLongPress={60000}
            style={{
              ...NO_SELECT,
              width: 52,
              height: 52,
              borderRadius: 26,
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: c.raised,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="remove" size={26} color={c.fg} />
          </Pressable>
          {/* Tap the price to type your own. */}
          {typing ? (
            <TextInput
              autoFocus
              value={typed}
              onChangeText={(v) => setTyped(v.replace(/[^0-9]/g, '').slice(0, 6))}
              onBlur={applyTyped}
              onSubmitEditing={applyTyped}
              keyboardType="number-pad"
              returnKeyType="done"
              accessibilityLabel={t('secPrice')}
              style={[{ minWidth: 120, maxWidth: 170, fontSize: 32, fontWeight: '800', color: c.fg, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: c.accent, paddingVertical: 4, writingDirection: 'ltr' }, { outlineWidth: 0, outlineStyle: 'none' } as object]}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('secPrice')}: ${dh(card.price, lang)}`}
              onPress={() => {
                setTyped(String(card.price));
                setTyping(true);
              }}
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexShrink: 1, direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
              <T size={36} weight="heavy" style={{ lineHeight: 46 }}>
                {dh(card.price, lang).replace(/\s*(DH|درهم)$/, '')}
              </T>
              <T size={18} weight="bold" muted>
                {lang === 'ar' ? 'درهم' : 'DH'}
              </T>
              <Ionicons name="pencil" size={14} color={c.muted} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('raise')}
            onPressIn={() => hold.start(10)}
            onPressOut={hold.stop}
            delayLongPress={60000}
            style={{
              ...NO_SELECT,
              width: 52,
              height: 52,
              borderRadius: 26,
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: c.raised,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="add" size={26} color={c.fg} />
          </Pressable>
        </View>
        {lo && hi ? (
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: c.raised,
              direction: 'ltr',
            }}>
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                borderRadius: 4,
                backgroundColor: '#86EFAC',
                left: `${((lo - min) / span) * 100}%`,
                right: `${100 - ((hi - min) / span) * 100}%`,
              }}
            />
            <View
              style={{
                position: 'absolute',
                top: -5,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: c.ok,
                borderWidth: 2,
                borderColor: c.surface,
                left: `${((card.price - min) / span) * 100}%`,
                marginLeft: -9,
              }}
            />
          </View>
        ) : null}
        {est ? (
          <View style={{ gap: 4 }}>
            {/* One short line on how the hint is made (round 8), and an honest word when asking less. */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <Ionicons name="information-circle-outline" size={16} color={c.muted} />
              <T size={12} muted style={{ flex: 1 }}>
                {est.learned ? t('priceBasisLearned', { km: est.km, n: est.learned }) : t('priceBasis', { km: est.km })}
              </T>
            </View>
            {below ? (
              <T size={12} weight="bold" color={c.warn}>
                {t('belowHint2')}
              </T>
            ) : null}
          </View>
        ) : null}
      </Section>

      {error ? <T color={c.danger}>{t(error)}</T> : null}
      <Btn title={t('sendDrivers')} icon="paper-plane" disabled={sameSpot} onPress={send} />
    </View>
  );
}

// ---------------- Offers, trip, delivered ----------------

/** A soft light sweeping across a thin bar: the request is out and being looked at. */
function WaitingBar() {
  const c = useColors();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1400, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: c.raised, overflow: 'hidden' }}>
      <Animated.View style={{ width: '40%', height: 4, borderRadius: 2, backgroundColor: c.accent, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-160, 400] }) }] }} />
    </View>
  );
}

/** The first part of a place name ("Maarif" from "Maarif, Casablanca"), for short lines. */
const short = (place: string) => place.split(/[,،]/)[0].trim();


/** − price + (always in that order, also in Arabic), hold to keep going, tap the number to type it. */
export function PriceEditor({ price, onChange, low, high, hint }: { price: number; onChange: (p: number) => void; low?: number; high?: number; /** What the trip costs a driver: a hint, never a limit. */ hint?: number }) {
  const c = useColors();
  const { t, lang } = useT();
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const latest = useRef(price);
  latest.current = price;
  const hold = useHoldRepeat((delta) => onChange(Math.max(10, latest.current + delta)));
  const apply = () => {
    const v = parseInt(typed, 10);
    if (v > 0) onChange(Math.min(200000, Math.max(10, v)));
    setTyping(false);
  };
  const round = (icon: 'remove' | 'add', label: string, delta: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => hold.start(delta)}
      onPressOut={hold.stop}
      delayLongPress={60000}
      style={{ ...NO_SELECT, width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={26} color={c.fg} />
    </Pressable>
  );
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', direction: 'ltr' }}>
        {round('remove', t('lower'), -10)}
        {typing ? (
          <TextInput
            autoFocus
            value={typed}
            onChangeText={(v) => setTyped(v.replace(/[^0-9]/g, '').slice(0, 6))}
            onBlur={apply}
            onSubmitEditing={apply}
            keyboardType="number-pad"
            returnKeyType="done"
            accessibilityLabel={t('secPrice')}
            style={[{ minWidth: 120, maxWidth: 170, fontSize: 34, fontWeight: '800', color: c.fg, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: c.accent, paddingVertical: 4, writingDirection: 'ltr' }, { outlineWidth: 0, outlineStyle: 'none' } as object]}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('secPrice')}: ${dh(price, lang)}`}
            onPress={() => {
              setTyped(String(price));
              setTyping(true);
            }}
            style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexShrink: 1, direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
            <T size={38} weight="heavy" style={{ lineHeight: 48 }}>
              {dh(price, lang).replace(/\s*(DH|درهم)$/, '')}
            </T>
            <T size={18} weight="bold" muted>
              {lang === 'ar' ? 'درهم' : 'DH'}
            </T>
            <Ionicons name="pencil" size={14} color={c.muted} />
          </Pressable>
        )}
        {round('add', t('raise'), 10)}
      </View>
      {low && high ? (
        <T size={13} muted style={{ textAlign: 'center' }}>
          {t('fair', { low: dh(low, lang), high: dh(high, lang) })}
        </T>
      ) : null}
      {hint && price < hint ? (
        <T size={12} color={c.warn} style={{ textAlign: 'center' }}>
          {t('belowHint2')}
        </T>
      ) : null}
    </View>
  );
}

/** Example drivers answer a counter-offer by themselves after a moment (clearly marked as examples). */
function exampleAnswer(reqId: string, offerId: string, price: number) {
  setTimeout(() => {
    const st = getState();
    const r = st.requests.find((x) => x.id === reqId);
    const o = st.offers.find((x) => x.id === offerId);
    if (!r || r.stage !== 'open' || !o || o.status !== 'countered') return;
    update((s) => ({ ...s, offers: s.offers.map((x) => (x.id === offerId ? { ...x, price, status: undefined, counterPrice: undefined, createdAt: Date.now() } : x)) }));
    notify('customer', 'nt_counterYes', 'offer', { name: o.driverName, price });
  }, 4500);
}

function Offers({ req }: { req: Request }) {
  const c = useColors();
  const store = useStore();
  const { t, lang, route } = useT();
  const [cancel, setCancel] = useState(false);
  const [details, setDetails] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [counter, setCounter] = useState<{ id: string; price: number } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  // No offer yet after a while: a friendly hint, no waiting time promised (round 7), and two
  // choices: raise the price, or keep it. The request stays open with no time limit.
  const [quiet, setQuiet] = useState(false);
  const [kept, setKept] = useState(false);
  useEffect(() => {
    const left = 15000 - (Date.now() - req.createdAt);
    if (left <= 0) {
      setQuiet(true);
      return;
    }
    const timer = setTimeout(() => setQuiet(true), left);
    return () => clearTimeout(timer);
  }, [req.createdAt]);
  const driverOf = (o: Offer): Person => ({ role: 'driver', name: o.driverName, vehicle: o.vehicle, example: o.example, photo: o.driverName === store.driver.name ? store.driver.photoUri : undefined });
  const offers = store.offers.filter((o) => o.requestId === req.id && o.status !== 'declined').sort((a, b) => a.price - b.price);
  const byId = (id: string | null) => offers.find((o) => o.id === id);
  const accept = (id: string) => {
    const o = byId(id);
    if (!o) return;
    // Market memory: the price accepted for this kind of trip makes the next hints closer to reality.
    update((s) => ({ ...s, market: [...(s.market ?? []), { vehicle: o.vehicle, km: req.km, price: o.price, helpers: req.helpers, at: Date.now() }].slice(-300) }));
    patchRequest(req.id, {
      price: o.price,
      driverName: o.driverName,
      driverVehicle: o.vehicle,
      driverIsExample: o.example,
      acceptedAt: Date.now(),
    });
    // The driver must confirm he takes the trip (round 8); example drivers confirm by themselves.
    if (o.example) patchRequest(req.id, { takenAt: Date.now() });
    setStage(req.id, 'accepted');
    play('success');
    // An example driver starts at once for a trip "now"; a booking for later waits for its time.
    if (o.example && req.when === 'now') runExampleTrip(req.id);
    checkTripsNow();
  };
  const decline = (id: string) => update((s) => ({ ...s, offers: s.offers.map((x) => (x.id === id ? { ...x, status: 'declined' } : x)) }));
  const sendCounter = (id: string, price: number) => {
    const o = byId(id);
    if (!o) return;
    update((s) => ({ ...s, offers: s.offers.map((x) => (x.id === id ? { ...x, status: 'countered', counterPrice: price } : x)) }));
    play('send');
    notify('driver', 'nt_counter', 'offer', { price });
    if (o.example) exampleAnswer(req.id, id, price);
  };
  const { width } = useWindowDimensions();
  const cardW = width - 24;
  useEffect(() => () => setMapPanel(0), []);
  const open = byId(details);
  const diff = (p: number) => p - req.price;
  const diffLine = (p: number) => (diff(p) > 0 ? t('moreThanAsked', { price: dh(diff(p), lang) }) : diff(p) < 0 ? t('lessThanAsked', { price: dh(-diff(p), lang) }) : t('sameAsAsked'));
  return (
    <View style={{ gap: 10 }} onLayout={(e) => setMapPanel(e.nativeEvent.layout.height)}>
      {/* Offers, side by side: swipe to compare; tap one for its details. */}
      {offers.length ? (
        // One above the other (round 6), cheapest first, all the same design.
        <View style={{ gap: 10 }}>
          {offers.map((o, i) => (
            <View key={o.id} style={{ backgroundColor: c.surface, borderRadius: 22, borderWidth: i === 0 ? 2 : 1, borderColor: i === 0 ? c.live : c.line, padding: 12, gap: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${o.driverName}, ${dh(o.price, lang)}. ${t('seeDetails')}`}
                onPress={() => {
                  tap();
                  setDetails(o.id);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <PersonChip person={driverOf(o)} onOpen={() => setPerson(driverOf(o))} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${o.driverName}. ${t('seeProfile')}`} onPress={() => { tap(); setPerson(driverOf(o)); }} hitSlop={8}>
                      <T weight="heavy">{o.driverName}</T>
                    </Pressable>
                    {offers.length > 1 ? (
                      <T size={12} muted>
                        {`${i + 1}/${offers.length}`}
                      </T>
                    ) : null}
                  </View>
                  <T size={13} muted>
                    {vName(t, o.vehicle)}
                  </T>
                  <RatingLine name={o.driverName} />
                  {o.status === 'countered' ? (
                    <T size={12} weight="bold" color={c.warn}>
                      {t('youProposed', { price: dh(o.counterPrice ?? 0, lang) })}
                    </T>
                  ) : o.example ? (
                    <Pill tone="warn">{t('exampleOffer')}</Pill>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T size={22} weight="heavy">
                    {dh(o.price, lang)}
                  </T>
                  <T size={12} weight="bold" color={c.accent}>
                    {t('seeDetails')}
                  </T>
                </View>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Btn title={t('decline')} kind="ghost" small onPress={() => setDeclining(o.id)} />
                </View>
                <View style={{ flex: 1.4 }}>
                  <Btn title={t('acceptShort')} kind={i === 0 ? 'ink' : 'accent'} icon="checkmark" small disabled={o.status === 'countered'} onPress={() => setAccepting(o.id)} />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {/* The request's status, floating over the map. */}
      <View style={{ backgroundColor: c.surface, borderRadius: 22, padding: 14, gap: offers.length ? 4 : 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="checkmark-circle" size={20} color={c.ok} />
          <T weight="bold" color={c.ok} style={{ flex: 1 }}>
            {t('requestSent')}
          </T>
          <LiveDot />
        </View>
        <T size={offers.length ? 17 : 20} weight="heavy">
          {offers.length ? (offers.length === 1 ? t('oneOffer') : t('offersN', { n: offers.length })) : t('waitingDrivers')}
        </T>
        {!offers.length ? <WaitingBar /> : null}
        {!offers.length && quiet && !kept ? (
          <View style={{ backgroundColor: c.raised, borderRadius: 14, padding: 10, gap: 8, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Ionicons name="bulb-outline" size={16} color={c.accent} />
              <T size={13} style={{ flex: 1 }}>
                {t('waitHint')}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Btn title={t('raisePrice')} icon="trending-up" small onPress={() => setEditing(req.price + 50)} />
              </View>
              <View style={{ flex: 1 }}>
                <Btn title={t('keepPrice')} kind="ghost" small onPress={() => setKept(true)} />
              </View>
            </View>
          </View>
        ) : null}
        <T size={13} muted>
          {[route(short(req.from), short(req.to)), formatWhen(req.when, lang, t), t('youAsked', { price: dh(req.price, lang) })].join(' · ')}
        </T>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <View style={{ flex: 1.3 }}>
            <Btn title={t('editYourOffer')} kind="ghost" icon="create-outline" small onPress={() => setEditing(req.price)} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn title={t('cancel')} kind="ghost" small onPress={() => setCancel(true)} />
          </View>
        </View>
      </View>

      {/* An offer's details: who, which vehicle, the price against yours. */}
      <Sheet visible={!!open} onClose={() => setDetails(null)} title={t('offerDetails')}>
        {open ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <PersonChip person={driverOf(open)} onOpen={() => setPerson(driverOf(open))} size={56} />
              <Pressable accessibilityRole="button" accessibilityLabel={`${open.driverName}. ${t('seeProfile')}`} onPress={() => setPerson(driverOf(open))} style={{ flex: 1, gap: 2 }}>
                <T size={18} weight="heavy">
                  {open.driverName}
                </T>
                <RatingLine name={open.driverName} />
                {open.example ? <Pill tone="warn">{t('exampleOffer')}</Pill> : null}
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setPerson(driverOf(open))} style={{ minHeight: 36, paddingHorizontal: 10, borderRadius: 999, backgroundColor: c.raised, justifyContent: 'center' }}>
                <T size={13} weight="bold" color={c.accent}>
                  {t('seeProfile')}
                </T>
              </Pressable>
            </View>
            <VehicleRowLite id={open.vehicle} />
            <View style={{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <T muted>{t('theirPrice')}</T>
                <T size={26} weight="heavy">
                  {dh(open.price, lang)}
                </T>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T size={13} muted>
                  {t('yourPriceWas')}
                </T>
                <T size={13} weight="bold">
                  {dh(req.price, lang)}
                </T>
              </View>
              <T size={13} weight="bold" color={diff(open.price) > 0 ? c.warn : c.ok}>
                {diffLine(open.price)}
              </T>
            </View>
            <T size={13} muted>
              {[route(short(req.from), short(req.to)), formatWhen(req.when, lang, t), t('payCashShort')].join(' · ')}
            </T>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Btn
                  title={t('decline')}
                  kind="ghost"
                  onPress={() => {
                    const id = open.id;
                    setDetails(null);
                    setDeclining(id);
                  }}
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <Btn
                  title={t('acceptShort')}
                  kind="ink"
                  icon="checkmark"
                  disabled={open.status === 'countered'}
                  onPress={() => {
                    const id = open.id;
                    setDetails(null);
                    setAccepting(id);
                  }}
                />
              </View>
            </View>
          </View>
        ) : null}
      </Sheet>

      {/* Make another offer instead of only declining. */}
      <Sheet visible={!!counter} onClose={() => setCounter(null)} title={t('counterTitle', { name: byId(counter?.id ?? null)?.driverName ?? '' })}>
        {counter ? (
          <View style={{ gap: 14 }}>
            <T muted>{t('counterBody', { price: dh(byId(counter.id)?.price ?? 0, lang) })}</T>
            <PriceEditor price={counter.price} onChange={(p) => setCounter({ ...counter, price: p })} low={req.fairMin || undefined} high={req.fairMax || undefined} hint={req.costHint} />
            <Btn
              title={t('sendMyOffer', { price: dh(counter.price, lang) })}
              icon="paper-plane"
              onPress={() => {
                sendCounter(counter.id, counter.price);
                setCounter(null);
              }}
            />
            <Btn
              title={t('justDecline')}
              kind="ghost"
              onPress={() => {
                decline(counter.id);
                play('pop');
                setCounter(null);
              }}
            />
          </View>
        ) : null}
      </Sheet>

      {/* Edit your offer: a new price for the whole request, to attract more drivers. */}
      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title={t('editYourOffer')}>
        {editing !== null ? (
          <View style={{ gap: 14 }}>
            <T muted>{t('editOfferBody')}</T>
            <PriceEditor price={editing} onChange={setEditing} low={req.fairMin || undefined} high={req.fairMax || undefined} hint={req.costHint} />
            <Btn
              title={t('saveNewPrice')}
              icon="checkmark"
              disabled={editing === req.price}
              onPress={() => {
                patchRequest(req.id, { price: editing });
                play('send');
                notify('driver', 'nt_priceChanged', 'pop', { price: editing });
                setEditing(null);
              }}
            />
          </View>
        ) : null}
      </Sheet>

      <PersonSheet person={person} onClose={() => setPerson(null)} />
      <Confirm
        visible={!!accepting}
        title={t('acceptSureTitle')}
        body={t('acceptSureBody', { name: byId(accepting)?.driverName ?? '', price: dh(byId(accepting)?.price ?? 0, lang) })}
        yes={t('acceptYes')}
        onNo={() => setAccepting(null)}
        onYes={() => {
          const id = accepting;
          setAccepting(null);
          if (id) accept(id);
        }}
      />
      <Confirm
        visible={!!declining}
        title={t('declineSureTitle')}
        body={t('declineSureBody', { name: byId(declining)?.driverName ?? '' })}
        yes={t('declineYes')}
        onNo={() => setDeclining(null)}
        onYes={() => {
          const o = byId(declining);
          setDeclining(null);
          // Before it's gone: offer to answer with another price instead.
          if (o) setTimeout(() => setCounter({ id: o.id, price: o.status === 'countered' && o.counterPrice ? o.counterPrice : Math.max(10, Math.round((o.price * 0.9) / 10) * 10) }), 250);
        }}
      />
      <Confirm
        visible={cancel}
        title={t('cancelTitle')}
        body={t('cancelBody')}
        yes={t('cancelYes')}
        onNo={() => setCancel(false)}
        onYes={() => {
          setCancel(false);
          patchRequest(req.id, { stage: 'cancelled', cancelledBy: 'customer' });
          update((s) => ({ ...s, activeRequestId: null }));
        }}
      />
    </View>
  );
}

/** The vehicle in an offer, as its 3D picture with the name. */
function VehicleRowLite({ id }: { id: Request['vehicle'] }) {
  return <VehicleRow id={id} />;
}

/**
 * The trip, live on the map: the vehicle moves to the pickup, waits there while loading, then
 * drives to the destination. Under the map, everything in one panel that fits the screen:
 * where things are, the steps, the driver, the delivery code, the timeline and cancelling.
 */
function Track({ req }: { req: Request }) {
  const c = useColors();
  const { t, lang } = useT();
  const store = useStore();
  const [person, setPerson] = useState<Person | null>(null);
  const [cancel, setCancel] = useState(false);
  const { pos, etaMin } = useVehicle(req);
  const loading = useLoadingTimer(req);
  useEffect(() => {
    setMapVehicle(pos);
  });
  useEffect(() => () => setMapVehicle(null), []);
  useEffect(() => () => setMapPanel(0), []);
  const trackDriver: Person = { role: 'driver', name: req.driverName ?? '', vehicle: req.driverVehicle, example: req.driverIsExample, photo: req.driverName === store.driver.name ? store.driver.photoUri : undefined, phone: !req.driverIsExample && req.driverName === store.driver.name ? store.driver.phone : undefined };
  const n = unread(req, 'customer');
  const scheduled = req.stage === 'accepted' && req.when !== 'now';
  const title = scheduled ? t('bookedFor', { when: formatWhen(req.when, lang, t) }) : req.stage === 'enroute' ? t('trk_enroute', { name: req.driverName ?? '' }) : req.stage === 'arrived' ? t('trk_arrived') : req.stage === 'loaded' ? t('trk_loaded') : req.stage === 'dropoff' ? t('trk_dropoff', { name: req.driverName ?? '' }) : t('trk_accepted', { name: req.driverName ?? '' });
  const [helpersCancel, setHelpersCancel] = useState(false);
  // Round 9 (#82): the panel slides down to a slim bar (drag its handle down, or tap it) to watch
  // the map, and back up the same way.
  const [folded, setFolded] = useState(false);
  const grab = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 30) setFolded(true);
        else if (g.dy < -30) setFolded(false);
      },
    }),
  ).current;
  const cp = req.companion;
  const otherName = cp?.who === 'other' ? (cp.name ?? '').trim() : '';
  // Who pays, in words the booker understands (#62): «Khalid pays…», «The person you send pays…»,
  // or «Someone else pays…» when no one goes with the driver; otherwise the plain cash line.
  const payLine = cp?.pays === 'them' ? (cp.who === 'other' ? (otherName ? t('paysAtEnd', { name: otherName }) : t('paysAtEndSent')) : t('paysAtEndSomeone')) : t('payCashLine');
  // The next reminder the customer will get (from the trip's plan), shown under the explanation.
  const nextStep = tripPlan(req).find((st) => st.at > Date.now() && st.who !== 'driver');
  const sub = scheduled ? countdown(req, t) : req.stage === 'arrived' ? t('loadingFor', { time: loading }) : etaMin ? t('etaMin', { n: etaMin }) : '';
  return (
    <View style={{ gap: 10 }} onLayout={(e) => setMapPanel(e.nativeEvent.layout.height)}>
      <View style={{ backgroundColor: c.surface, borderRadius: 24, padding: 14, paddingTop: 6, gap: 12, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 }}>
        <Pressable
          {...grab.panHandlers}
          accessibilityRole="button"
          accessibilityLabel={folded ? t('panelShow') : t('panelHide')}
          onPress={() => {
            tap();
            setFolded(!folded);
          }}
          hitSlop={10}
          style={{ alignSelf: 'stretch', alignItems: 'center', paddingVertical: 4 }}>
          <View style={{ width: 48, height: 5, borderRadius: 3, backgroundColor: c.line }} />
          <Ionicons name={folded ? 'chevron-up' : 'chevron-down'} size={16} color={c.muted} />
        </Pressable>
        {/* Where things are, and how long until the next place. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <LiveDot />
          <T size={17} weight="heavy" style={{ flex: 1 }} numberOfLines={2}>
            {title}
          </T>
          {sub ? (
            <View style={{ backgroundColor: c.liveSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <T size={12} weight="heavy" color={c.live}>
                {sub}
              </T>
            </View>
          ) : null}
        </View>
        {/* Round 10: a new price the driver suggests, answered here (shown even when folded). */}
        <PriceAskCard req={req} role="customer" />
        {folded ? null : (
        <>
        <Steps stage={req.stage} />
        {/* The driver: photo, name, stars, vehicle; the chat one tap away. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <PersonChip person={trackDriver} onOpen={() => setPerson(trackDriver)} size={44} />
          <Pressable accessibilityRole="button" accessibilityLabel={`${req.driverName ?? ''}. ${t('seeProfile')}`} onPress={() => { tap(); setPerson(trackDriver); }} style={{ flex: 1 }}>
            <T weight="heavy" numberOfLines={1}>
              {req.driverName}
            </T>
            <T size={12} muted numberOfLines={1}>
              {vName(t, req.driverVehicle)}
            </T>
            <RatingLine name={req.driverName ?? ''} />
          </Pressable>
          <CallButton person={trackDriver} onChat={() => openTab('messages', req.id)} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('openChat', { name: req.driverName ?? '' })}
            onPress={() => {
              tap();
              openTab('messages', req.id);
            }}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chatbubbles" size={22} color={c.onAccent} />
            {n ? (
              <View style={{ position: 'absolute', top: -3, end: -3, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: c.surface }}>
                <T size={10} weight="heavy" color="#FFFFFF" style={{ lineHeight: 13 }}>
                  {String(n)}
                </T>
              </View>
            ) : null}
          </Pressable>
        </View>
        {/* What happened and what comes next, in plain words (round 6). */}
        {req.stage === 'accepted' ? (
          <View style={{ flexDirection: 'row', gap: 8, backgroundColor: c.liveSoft, borderRadius: 14, padding: 10 }}>
            <Ionicons name="information-circle" size={18} color={c.live} />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={13} weight="bold" color={c.live}>
                {!req.takenAt ? t('waitTake', { name: req.driverName ?? '' }) : scheduled ? bookedLine(req, t, lang) : t('nowExplain', { name: req.driverName ?? '' })}
              </T>
            </View>
          </View>
        ) : null}
        {/* On arrival: did the helpers asked for come? (round 7). Fewer: continue, or cancel for free. */}
        {req.helpers && ['arrived', 'loaded', 'dropoff'].includes(req.stage) && !req.helpersCame ? (
          <View style={{ backgroundColor: c.raised, borderRadius: 14, padding: 10, gap: 8 }}>
            <T size={14} weight="heavy">
              {req.helpers === 1 ? t('helpersCameQ1', { name: req.driverName ?? '' }) : t('helpersCameQ', { name: req.driverName ?? '', n: req.helpers })}
            </T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Btn
                  title={t('helpersCameYes')}
                  icon="checkmark"
                  small
                  onPress={() => {
                    patchRequest(req.id, { helpersCame: 'yes' });
                    play('pop');
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Btn
                  title={t('helpersCameNo')}
                  kind="ghost"
                  small
                  onPress={() => {
                    patchRequest(req.id, { helpersCame: 'fewer' });
                    appMessage(req.id, req.helpers === 1 ? 'helpersFewerMsg1' : 'helpersFewerMsg', { n: req.helpers });
                    notify('driver', req.helpers === 1 ? 'helpersFewerMsg1' : 'nt_helpersFewer', 'step', { n: req.helpers }, undefined, req.id);
                  }}
                />
              </View>
            </View>
          </View>
        ) : null}
        {req.helpersCame === 'fewer' && req.stage === 'arrived' ? (
          <View style={{ backgroundColor: c.raised, borderRadius: 14, padding: 10, gap: 8 }}>
            <T size={13}>{t('helpersFewerBody')}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Btn title={t('helpersGoOn')} small kind="ghost" onPress={() => patchRequest(req.id, { helpersCame: 'yes' })} />
              </View>
              <View style={{ flex: 1 }}>
                <Btn title={t('helpersCancelFree')} small kind="ink" onPress={() => setHelpersCancel(true)} />
              </View>
            </View>
          </View>
        ) : null}
        {/* The price and how it is paid (no delivery code: the driver's taps and the GPS end the trip). */}
        <View style={{ backgroundColor: c.ink, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Simple design: the price and how it's paid, in one line. */}
          <T size={13} weight="bold" color={c.onInk} style={{ flex: 1 }}>
            {payLine}
          </T>
          <T size={22} weight="heavy" color={c.onInk}>
            {dh(req.price, lang)}
          </T>
        </View>
        {/* The person with the driver: send them the trip (in the real app it goes by SMS too). */}
        {cp?.who === 'other' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tap();
              Share.share({ message: t('compShareText', { name: otherName, driver: req.driverName ?? '', from: req.from, to: req.to, price: dh(req.price, lang) }) }).catch(() => {});
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.raised, borderRadius: 14, padding: 10 }}>
            <Ionicons name="paper-plane-outline" size={18} color={c.accent} />
            <View style={{ flex: 1 }}>
              <T size={14} weight="bold">
                {otherName ? t('compShareBtn', { name: otherName }) : t('compShareBtnAnon')}
              </T>
              <T size={12} muted>
                {companionAt(cp)
                  .map((k) => t(k === 'pickup' ? 'compAtPickup' : k === 'rides' ? 'compRides' : 'compWaits'))
                  .join(' · ')}
              </T>
            </View>
            <Ionicons name="share-social-outline" size={18} color={c.accent} />
          </Pressable>
        ) : null}
        {req.shared ? (
          <T size={12} muted>
            {t('sharedNote')}
          </T>
        ) : null}
        {/* Photos of the trip only once the driver is there (the load's own photos aren't shown again). */}
        {['arrived', 'loaded', 'dropoff'].includes(req.stage) ? <TripPhotos req={req} side="customer" canAdd /> : null}
        {req.driverIsExample ? (
          <T size={11} color={c.warn} style={{ textAlign: 'center' }}>
            {t('exampleTrip')}
          </T>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Btn title={t('cancel')} kind="ghost" small onPress={() => setCancel(true)} />
          </View>
        </View>
        {/* Test version: a trip booked for later can be watched right away. */}
        {scheduled && req.driverIsExample ? <Btn title={t('tryTripNow')} kind="ghost" icon="play" small onPress={() => runExampleTrip(req.id)} /> : null}
        <HelpButton />
        </>
        )}
      </View>
      <PersonSheet person={person} onClose={() => setPerson(null)} />
      <CancelSheet req={req} side="customer" visible={cancel} onClose={() => setCancel(false)} />
      <CancelSheet req={req} side="customer" visible={helpersCancel} preset="cr_helpers" onClose={() => setHelpersCancel(false)} />
    </View>
  );
}

/** What the booking means, in words that fit its day (today / tomorrow / days ahead). */
function bookedLine(req: Request, t: ReturnType<typeof useT>['t'], lang: ReturnType<typeof useT>['lang']) {
  const w = bookingWhen(req);
  const name = req.driverName ?? '';
  const time = stepVars(req).time;
  if (w === 'today') return t('bookedExplainToday', { name, time });
  if (w === 'tomorrow') return t('bookedExplainTomorrow', { name, time });
  return t('bookedExplain', { name, when: formatWhen(req.when, lang, t) });
}

/** Confetti: a few coloured pieces bursting out and falling, once. */
function Burst() {
  const pieces = useRef(Array.from({ length: 14 }, (_, i) => ({ v: new Animated.Value(0), angle: (i / 14) * Math.PI * 2, dist: 70 + (i % 3) * 22, color: ['#C2410C', '#0F766E', '#D97706', '#16A34A'][i % 4] }))).current;
  useEffect(() => {
    Animated.stagger(
      18,
      pieces.map((p) => Animated.timing(p.v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true })),
    ).start();
  }, [pieces]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, alignItems: 'center', justifyContent: 'center' }}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: i % 2 ? 8 : 6,
            height: i % 2 ? 8 : 12,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: p.v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.dist] }) },
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(p.angle) * p.dist + 30] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 220}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** What went well (4–5 stars) or what could be better (1–3 stars): tap any, if you like (round 8). */
const LIKES: Key[] = ['like_onTime', 'like_careful', 'like_friendly', 'like_helpers', 'like_clean', 'like_fair'];
const DISLIKES: Key[] = ['bad_late', 'bad_rough', 'bad_rude', 'bad_helpers', 'bad_price'];

/**
 * Delivered: a short celebration over the map (which shows the finished trip), the summary in one
 * line, the stars (and, once rated, what went well), and the next step. Everything fits under the
 * map without scrolling.
 */
function Done({ req, onNew }: { req: Request; onNew: () => void }) {
  const store = useStore();
  const now = store.requests.find((r) => r.id === req.id) ?? req;
  // Round 7, no delivery code: the driver said he handed the load over; the customer (or the person
  // with the driver) says "I received it", maybe with a problem, then rates.
  if (!now.receivedAt) return <Received req={now} />;
  return <Rated req={now} onNew={onNew} />;
}

function Received({ req }: { req: Request }) {
  const c = useColors();
  const { t, route } = useT();
  const [problem, setProblem] = useState(false);
  // The problem is told like a note to the driver (round 8): words, voice notes, photos, files.
  const [bits, setBits] = useState<Bit[]>([]);
  useEffect(() => setMapVehicle(null), []);
  useEffect(() => () => setMapPanel(0), []);
  const cp = req.companion;
  const other = cp?.who === 'other' ? cp.name || t('compThem') : '';
  const confirm = (withProblem: boolean) => {
    const at = Date.now();
    const words = bits.filter((b) => b.kind === 'text').map((b) => b.text ?? '').join(' ').trim();
    const photos = bits.filter((b) => b.kind === 'photo' && b.uri).map((b) => b.uri!);
    patchRequest(req.id, withProblem ? { receivedAt: at, problem: { text: words, photo: photos[0], at, bits: bits.map((b) => ({ kind: b.kind, text: b.text, uri: b.uri, ms: b.ms, name: b.name })) } } : { receivedAt: at });
    if (withProblem) {
      appMessage(req.id, 'problemMsg', { text: words || (bits.some((b) => b.kind === 'voice') ? '🎤' : '📷') });
      // The voice notes and photos also go into the trip's conversation, so the driver sees them.
      bits.filter((b) => b.kind !== 'text' && b.uri).forEach((b) => sendMessage(req.id, 'customer', '', { kind: b.kind as 'voice' | 'photo' | 'file', uri: b.uri!, ms: b.ms, name: b.name }));
      if (photos.length) patchRequest(req.id, { tripPhotos: [...(req.tripPhotos ?? []), ...photos.map((uri) => ({ uri, by: 'customer' as const, at, stage: 'delivered' as const }))] });
      notify('driver', 'nt_problem', 'step', undefined, undefined, req.id);
    } else {
      appMessage(req.id, 'receivedMsg');
      notify('driver', 'nt_received', 'success', undefined, undefined, req.id);
    }
    play('success');
  };
  return (
    <View style={{ gap: 10 }} onLayout={(e) => setMapPanel(e.nativeEvent.layout.height)}>
      <View style={{ backgroundColor: c.surface, borderRadius: 24, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.liveSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="cube" size={22} color={c.live} />
          </View>
          <View style={{ flex: 1 }}>
            <T size={18} weight="heavy">
              {t('handedTitle', { name: req.driverName ?? '' })}
            </T>
            <T size={13} muted numberOfLines={1}>
              {route(short(req.from), short(req.to))}
            </T>
          </View>
        </View>
        <T size={15} weight="bold">
          {other ? t('receivedQOther', { name: other }) : t('receivedQ')}
        </T>
        {other ? (
          <T size={12} muted>
            {t('receivedOtherNote', { name: other })}
          </T>
        ) : null}
        <Btn title={t('receivedBtn')} icon="checkmark-done" onPress={() => confirm(false)} />
        <Pressable accessibilityRole="button" onPress={() => setProblem(true)} style={{ minHeight: 40, alignItems: 'center', justifyContent: 'center' }}>
          <T size={14} weight="bold" color={c.accent}>
            {t('problemLink')}
          </T>
        </Pressable>
        <TripPhotos req={req} side="customer" canAdd={false} />
        {req.driverIsExample ? (
          <T size={11} color={c.warn} style={{ textAlign: 'center' }}>
            {t('exampleTrip')}
          </T>
        ) : null}
      </View>
      <Sheet visible={problem} onClose={() => setProblem(false)} title={t('problemTitle')}>
        <View style={{ gap: 12 }}>
          <T size={14} muted>
            {t('problemBody')}
          </T>
          {bits.length ? (
            <View style={{ gap: 8, backgroundColor: c.raised, borderRadius: 16, padding: 10 }}>
              {bits.map((b) => (
                <BitBubble key={b.id} bit={b} mine side="right" onRemove={() => setBits((all) => all.filter((x) => x.id !== b.id))} />
              ))}
            </View>
          ) : null}
          {/* The same message bar as the notes to the driver: words, a voice note, a photo, a file. */}
          <Composer camera hint={t('problemHint')} onSend={(bit) => setBits((all) => [...all, bit])} />
          <Btn
            title={t('problemSend')}
            icon="paper-plane"
            disabled={!bits.length}
            onPress={() => {
              setProblem(false);
              confirm(true);
            }}
          />
          <T size={12} muted>
            {t('problemMarketplace')}
          </T>
        </View>
      </Sheet>
    </View>
  );
}

function Rated({ req, onNew }: { req: Request; onNew: () => void }) {
  const c = useColors();
  const { t, lang, route } = useT();
  const store = useStore();
  const { height: screenH } = useWindowDimensions();
  // Short screens (a phone's browser with its bars) get a tighter card so everything fits.
  const tight = screenH < 720;
  const now = store.requests.find((r) => r.id === req.id) ?? req;
  const rating = now.rating ?? 0;
  const likes = now.ratingTags ?? [];
  const mins = req.deliveredAt ? Math.max(1, Math.round((req.deliveredAt - (req.acceptedAt ?? req.createdAt)) / 60000)) : 0;
  const took = mins >= 60 ? t('tookHours', { h: Math.floor(mins / 60), m: String(mins % 60).padStart(2, '0') }) : t('tookMinutes', { n: mins });
  const pop = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  // Round 8: received with a problem is not a celebration: a calm, caring page instead.
  const sorry = !!now.problem;
  const [helpOpen, setHelpOpen] = useState(false);
  useEffect(() => {
    if (!sorry) play('celebrate');
    Animated.parallel([Animated.spring(pop, { toValue: 1, friction: 4, tension: 70, useNativeDriver: true }), Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true })]).start();
  }, [pop, ring]);
  // The vehicle is put away: the destination flag stays clear on the finished trip.
  useEffect(() => setMapVehicle(null), []);
  useEffect(() => () => setMapPanel(0), []);
  const check = tight ? 50 : 60;
  return (
    <View style={{ gap: 10 }} onLayout={(e) => setMapPanel(e.nativeEvent.layout.height)}>
      <View style={{ backgroundColor: c.surface, borderRadius: 26, paddingHorizontal: 14, paddingTop: check / 2 + 8, paddingBottom: 14, gap: tight ? 8 : 10, alignItems: 'center', marginTop: check / 2, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 }}>
        {/* An X to close and go back to the main page, without having to start a new request (#87). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          hitSlop={8}
          onPress={() => {
            tap();
            onNew();
          }}
          style={{ position: 'absolute', top: 10, end: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
          <Ionicons name="close" size={20} color={c.fg} />
        </Pressable>
        {/* The check pops in with a ring and a little confetti, half over the edge of the card. */}
        <View style={{ position: 'absolute', top: -check / 2, alignItems: 'center', justifyContent: 'center' }}>
          {sorry ? null : <Animated.View style={{ position: 'absolute', width: check * 1.5, height: check * 1.5, borderRadius: check, borderWidth: 3, borderColor: c.ok, opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.5] }) }] }} />}
          {sorry ? null : <Burst />}
          <Animated.View style={{ width: check, height: check, borderRadius: check / 2, backgroundColor: sorry ? c.warn : c.ok, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: c.surface, transform: [{ scale: pop }] }}>
            <Ionicons name={sorry ? 'heart' : 'checkmark'} size={check * 0.5} color="#FFFFFF" />
          </Animated.View>
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T size={tight ? 21 : 23} weight="heavy" style={{ textAlign: 'center' }}>
            {sorry ? t('sorryTitle') : t('delivered')}
          </T>
          <T size={13} muted style={{ textAlign: 'center' }} numberOfLines={1}>
            {`${route(short(req.from), short(req.to))} · ${took}`}
          </T>
        </View>
        {sorry ? (
          <View style={{ alignSelf: 'stretch', gap: 8, backgroundColor: c.warnSoft, borderRadius: 14, padding: 12 }}>
            <T size={14}>{t('sorryBody')}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Btn title={t('helpWrite')} small icon="chatbubbles-outline" onPress={() => setHelpOpen(true)} />
              </View>
              <View style={{ flex: 1 }}>
                <Btn title={t('sorryChat')} small kind="ghost" icon="chatbubble-ellipses-outline" onPress={() => openTab('messages', req.id)} />
              </View>
            </View>
          </View>
        ) : null}
        {/* The driver and what was paid, in one slim row. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', backgroundColor: c.raised, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 }}>
          <Avatar name={req.driverName ?? ''} size={34} />
          <View style={{ flex: 1 }}>
            <T weight="heavy" numberOfLines={1}>
              {req.driverName}
            </T>
            <T size={11} muted>
              {t('paidCash')}
            </T>
          </View>
          <T size={17} weight="heavy">
            {dh(req.price, lang)}
          </T>
        </View>
        <T size={14} weight="bold">
          {rating ? t('thanksRating') : t('howWas')}
        </T>
        {/* Stars follow the reading direction (#94): in Arabic the first star is on the right. */}
        <View style={{ flexDirection: 'row', gap: 4, direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
          {[1, 2, 3, 4, 5].map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityLabel={`${k} ★`}
              onPress={() => {
                tap();
                play('pop');
                patchRequest(req.id, { rating: k });
              }}
              hitSlop={4}>
              <Ionicons name={rating >= k ? 'star' : 'star-outline'} size={tight ? 28 : 32} color="#D97706" />
            </Pressable>
          ))}
        </View>
        {/* Once rated: what went well, or what could be better, to tap if you like. */}
        {rating ? (
          <View style={{ alignSelf: 'stretch', gap: 6 }}>
            <T size={12} muted style={{ textAlign: 'center' }}>
              {rating >= 4 ? t('likesTitle') : t('dislikesTitle')}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {(rating >= 4 ? LIKES : DISLIKES).map((k) => (
                <Chip key={k} label={t(k)} on={likes.includes(k)} onPress={() => patchRequest(req.id, { ratingTags: likes.includes(k) ? likes.filter((x) => x !== k) : [...likes, k] })} />
              ))}
            </View>
          </View>
        ) : null}
        {/* After a problem, no "Move something else" or share: only the X and the help above (#67). */}
        {sorry ? null : (
        <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
          <View style={{ flex: 1 }}>
            <Btn title={t('moveAnother')} icon="add" onPress={onNew} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('share')}
            onPress={() => Share.share({ message: t('shareText', { from: req.from, to: req.to }) }).catch(() => {})}
            style={({ pressed }) => ({ width: 58, minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
            <Ionicons name="share-social" size={22} color={c.fg} />
          </Pressable>
        </View>
        )}
      </View>
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </View>
  );
}

/** The driver's stars (from real ratings in this app), small, under their name. */
function RatingLine({ name }: { name: string }) {
  const store = useStore();
  const r = driverRating(store.requests, name);
  return <Stars avg={r.avg} count={r.count} size={12} />;
}

const clockOf = (at: number) => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

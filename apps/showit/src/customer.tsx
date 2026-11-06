import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, Share, TextInput, useWindowDimensions, View } from 'react-native';

import { previewAi, type Draft } from './ai';
import type { NoteTag } from './choices';
import { Chat, estimateTrip, HelpSection, matchPlace, RouteFields, type Rider } from './extras';
import { translate, useT, type Key } from './i18n';
import { Overlay } from './overlay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPlace } from './lib/places';
import { Chip, Confirm, dh, Initials, PhotoStrip, Section, Steps, VehicleRow, vName } from './shared';
import { useBack } from './back';
import { NoteBox, type VoiceNote } from './notebox';
import { onHome, onOpenTrip } from './home';
import { play } from './sounds';
import { getState, newId, notify, patchRequest, runExampleTrip, scheduleExampleOffers, setStage, update, useStore, type Request } from './store';
import { Btn, Card, ColorsContext, LiveDot, mainScroll, Pill, T, tap, useColors, useKeyboardInset, VoicePlayer } from './ui';
import { formatWhen, WhenPicker } from './wheels';
import { fmtKg } from './scan';
import { capture, draftFromChecked, MAX_PHOTOS, NO_ANSWERS, NO_MEDIA, SawStep, ScanStep, ShowStep, stepNav, StepsBar, type Answers, type Checked, type Media, type Shot } from './flow';
import { scanLoad } from './scan';
import { setMapBig, setMapPanel, setMapRadar, setMapShown, setMapTrip } from './map/trip';

/** Which parts of the request the AI filled in (marked "AI" until the customer changes them). */
type AiMarks = Partial<Record<'goods' | 'weight' | 'vehicle' | 'route' | 'when' | 'notes' | 'price', boolean>>;
type CardState = Draft & {
  rider?: Rider;
  /** A voice note for the driver, recorded on the card. */
  noteVoice?: VoiceNote;
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
  const [step, setStep] = useState<'show' | 'scan' | 'saw' | 'card'>('show');
  const [media, setMedia] = useState<Media>(NO_MEDIA);
  const [card, setCard] = useState<CardState | null>(null);
  const [checked, setChecked] = useState<Checked>(emptyChecked());
  const [answers, setAnswers] = useState<Answers>(NO_ANSWERS);
  const [note, setNote] = useState<Key | ''>('');
  const [error, setError] = useState<Key | ''>('');
  const [scanPhotos, setScanPhotos] = useState<Shot[]>([]);
  const [editingLoad, setEditingLoad] = useState(false);
  // The app opens on the first page; a request in progress is one tap away ("Open").
  // It opens by itself only when it is new (just sent) during this visit.
  const tripActive = !!active && active.stage !== 'cancelled';
  const [tripOpen, setTripOpen] = useState(false);
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
  const [trail, setTrail] = useState<Page[]>([]);
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
  const goBack = () => {
    const next = [...trail];
    let page = next.pop();
    // The reading screen is never gone back to.
    while (page === 'scan' && next.length) page = next.pop();
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
  // A request in progress is announced once when the app opens, as a passing notification
  // (the first page itself only shows the question and the camera).
  useEffect(() => {
    if (announced.done) return;
    announced.done = true;
    const timer = setTimeout(() => {
      const r = store.requests.find((q) => q.id === store.activeRequestId);
      if (!r || r.stage === 'cancelled' || r.stage === 'delivered') return;
      const status = r.stage === 'open' ? t('waitingOffers') : r.stage === 'accepted' ? t('stepAccepted') : r.stage === 'arrived' ? t('stepArrived') : t('stepLoaded');
      notify('customer', 'nt_tripNow', 'pop', { route: route(r.from.split(/[,،]/)[0], r.to.split(/[,،]/)[0]), status });
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The step bar can be tapped: Show it, Details (once there is a load), Send (the request in progress).
  stepNav.current = (i: number) => {
    if (i === 0) go('show');
    else if (i === 1) {
      if (card) go('card');
      else if (checked.scan.items.length) {
        const d = draftFromChecked(checked, answers, t);
        setCard({ ...fromDraft(d), ai: { goods: checked.scan.goods.length > 0, weight: d.weightKg > 0, vehicle: !checked.vehicle, notes: checked.care.length > 0 }, usedAi: !!checked.scan.summary });
        go('card');
      }
    } else if (i === 2 && tripActive) go('trip');
  };
  const aiOn = !!store.aiKey || previewAi();
  // The map behind the screen shows the trip: the request on its way, or the card being filled.
  const shown = showingTrip && active.stage !== 'delivered' ? active : step === 'card' ? card : null;
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
    setMapBig(busyRequest && active?.stage === 'open');
    setMapRadar(busyRequest && active?.stage === 'open');
    return () => {
      setMapShown(true);
      setMapBig(false);
      setMapRadar(false);
    };
  }, [busyRequest, active?.stage]);
  // The phone's back button: one page back at a time.
  // Each new step starts at the top of the screen.
  useEffect(() => {
    mainScroll.current?.scrollTo({ y: 0, animated: false });
  }, [step, active?.stage, showingTrip]);
  const reset = () => {
    setEditingLoad(false);
    setTrail([]);
    setResume(null);
    setStep('show');
    setMedia(NO_MEDIA);
    setCard(null);
    setChecked(emptyChecked());
    setAnswers(NO_ANSWERS);
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
            setChecked({
              scan,
              vehicle: checked.vehicle,
              care: first ? scan.care : Array.from(new Set([...checked.care, ...scan.care])),
              helpers: first ? scan.helpers : Math.max(checked.helpers, scan.helpers),
            });
            play('success');
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
        onNext={() => {
          if (editingLoad && card) {
            // Back from "Edit": the card keeps its route, time and price and takes the new load.
            const d = draftFromChecked(checked, answers, t);
            const keep = card.noteTags.filter((n) => n === 'narrow');
            setCard({ ...card, goods: d.goods, load: d.load, weightKg: d.weightKg, vehicle: d.vehicle, helpers: d.helpers, floorText: d.floorText, noteTags: Array.from(new Set([...d.noteTags, ...keep])) });
            setEditingLoad(false);
            goBack();
            return;
          }
          // Straight to the request: route, time and price are picked there.
          const d = draftFromChecked(checked, answers, t);
          setCard({
            ...fromDraft(d),
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

/** Press = one step; hold = keeps stepping, faster after a moment. */
function useHoldRepeat(step: (delta: number) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(step);
  latest.current = step;
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const start = (delta: number) => {
    stop();
    tap();
    latest.current(delta);
    let count = 0;
    const tick = () => {
      count += 1;
      latest.current(count > 15 ? delta * 5 : delta);
      timer.current = setTimeout(tick, count > 6 ? 70 : 140);
    };
    timer.current = setTimeout(tick, 420);
  };
  useEffect(() => stop, []);
  return { start, stop };
}

function CardScreen({ media, card, setCard, onBack, onSent, onEditLoad }: { media: Media; card: CardState; setCard: (c: CardState) => void; onBack: () => void; onSent: () => void; onEditLoad: () => void }) {
  const c = useColors();
  const store = useStore();
  const { t, lang } = useT();
  const [error, setError] = useState<Key | ''>('');
  const routeY = useRef(0);
  const set = (patch: Partial<CardState>, mark?: keyof AiMarks) =>
    setCard({
      ...card,
      ...patch,
      ai: mark ? { ...card.ai, [mark]: false } : card.ai,
    });

  const est = estimateTrip(card.fromPlaceId, card.toPlaceId, card.vehicle, card.helpers);
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

  const send = () => {
    if (!card.goods && !card.load.trim()) {
      setError('needGoods');
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
      weightKg: card.weightKg,
      vehicle: card.vehicle,
      from: card.from.trim(),
      to: card.to.trim(),
      when: card.when,
      price: card.price,
      fairMin: lo,
      fairMax: hi,
      km,
      notes: [card.floorText ?? '', ...(card.quick ?? []).filter((k) => k !== 'ns_narrow').map((k) => t(k)), card.notes.trim()].filter(Boolean).join('. '),
      noteTags: card.noteTags,
      said: media.said.trim(),
      photoUri: media.photoUri,
      photoUris: media.photos.map((p) => p.uri),
      voiceUri: card.noteVoice?.uri ?? media.voiceUri,
      voiceMs: card.noteVoice?.ms ?? media.voiceMs,
      stage: 'open',
      code: String(1000 + Math.floor(Math.random() * 9000)),
      // A typed place that wasn't picked from the list is still found, so the map can show it.
      fromPlaceId: card.fromPlaceId ?? matchPlace(card.from)?.id,
      toPlaceId: card.toPlaceId ?? matchPlace(card.to)?.id,
      helpers: card.helpers,
      rideAlong: (card.rider?.who ?? (card.rideAlong ? 'me' : 'none')) !== 'none',
      riderName: card.rider?.who === 'other' ? [card.rider.name.trim(), card.rider.phone.trim()].filter(Boolean).join(' · ') : undefined,
      riderPhone: card.rider?.who === 'other' ? card.rider.phone.trim() || undefined : undefined,
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
  const applyTyped = () => {
    const v = parseInt(typed, 10);
    if (v > 0) set({ price: Math.min(200000, v) }, 'price');
    setTyping(false);
  };
  const hold = useHoldRepeat((delta) => {
    const now = latestCard.current;
    setCard({ ...now, price: Math.max(10, now.price + delta), ai: { ...now.ai, price: false } });
  });
  const latestCard = useRef(card);
  latestCard.current = card;

  const min = Math.min(lo * 0.6, card.price);
  const max = Math.max(hi * 1.4, card.price);
  const span = max - min || 1;
  const aiLabel = t('aiPicked');

  return (
    <View style={{ gap: 14 }}>
      <StepsBar at={1} />
      <View style={{ gap: 4 }}>
        <T size={26} weight="heavy">
          {card.usedAi ? t('cardTitleAi') : t('cardTitleManual')}
        </T>
        <T muted>{card.aiNote ? t(card.aiNote) : card.usedAi ? t('cardSubAi') : t('cardSubManual')}</T>
      </View>

      <Card>
        {media.photoUri ? (
          <Image source={{ uri: media.photoUri }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }} resizeMode="cover" />
        ) : null}
        {media.photos.length > 1 ? <PhotoStrip uris={media.photos.slice(1).map((p) => p.uri)} /> : null}
        {/* What was agreed on "What we saw": shown once, changed only through Edit. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T size={18} weight="heavy">
            {t('loadTitle')}
          </T>
          <Pressable accessibilityRole="button" onPress={onEditLoad} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 4 }}>
            <Ionicons name="create-outline" size={16} color={c.accent} />
            <T size={14} weight="bold" color={c.accent}>
              {t('editLoad')}
            </T>
          </Pressable>
        </View>
        {card.load ? <T size={15}>{card.load}</T> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {card.weightKg ? <Pill>{t('kgEstimate', { kg: fmtKg(card.weightKg, lang) })}</Pill> : null}
          <Pill>{vName(t, card.vehicle)}</Pill>
          {card.floorText ? <Pill>{card.floorText}</Pill> : null}
          {card.helpers ? <Pill tone="warn">{t('helpersTag', { n: card.helpers })}</Pill> : null}
          {card.noteTags
            .filter((n) => n !== 'narrow')
            .map((n) => (
              <Pill key={n} tone="warn">
                {t(`n_${n}` as Key)}
              </Pill>
            ))}
        </View>
        {media.voiceUri ? <VoicePlayer uri={media.voiceUri} ms={media.voiceMs} label={t('voiceNoteYours')} /> : null}
        {media.said.trim() ? (
          <View style={{ backgroundColor: c.raised, borderRadius: 14, padding: 12 }}>
            <T size={15}>“{media.said.trim()}”</T>
          </View>
        ) : null}
      </Card>

      {/* Pickup and destination: highlighted, each opens its own map page. */}
      <View
        onLayout={(e) => {
          routeY.current = e.nativeEvent.layout.y;
        }}>
        <RouteFields
          from={{ text: card.from, id: card.fromPlaceId }}
          to={{ text: card.to, id: card.toPlaceId }}
          onFrom={(v, id) => set({ from: v, fromPlaceId: id }, 'route')}
          onTo={(v, id) => set({ to: v, toPlaceId: id }, 'route')}
          km={km}
          error={error === 'needRoute'}
        />
      </View>

      <Section title={t('secWhen')} hint={t('secWhenHint')} badge={card.ai.when ? aiLabel : undefined}>
        <WhenPicker value={card.when} onChange={(v) => set({ when: v }, 'when')} />
      </Section>

      <HelpSection
        helpers={card.helpers}
        rider={card.rider ?? { who: card.rideAlong ? 'me' : 'none', name: '', phone: '' }}
        onChange={(helpers, rider) => set({ helpers, rider, rideAlong: rider.who !== 'none' })}
      />

      <Section title={t('secHelp')} hint={t('secHelpHint')} badge={card.ai.notes ? aiLabel : undefined}>
        {/* Real things drivers ask about: tap to switch on or off. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {QUICK_NOTES.map((k) => {
            const on = (card.quick ?? []).includes(k) || (k === 'ns_narrow' && card.noteTags.includes('narrow'));
            return (
              <Chip
                key={k}
                label={t(k)}
                on={on}
                onPress={() => {
                  const quick = on ? (card.quick ?? []).filter((x) => x !== k) : [...(card.quick ?? []), k];
                  const noteTags = k === 'ns_narrow' ? (on ? card.noteTags.filter((x) => x !== 'narrow') : [...card.noteTags, 'narrow' as NoteTag]) : card.noteTags;
                  set({ quick, noteTags });
                }}
              />
            );
          })}
        </View>
        {/* A big box for a message, with a microphone on its right for a voice note. */}
        <NoteBox text={card.notes} onText={(v) => set({ notes: v })} voice={card.noteVoice ?? null} onVoice={(v) => set({ noteVoice: v ?? undefined })} placeholder={t('noteHint')} />
      </Section>

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
          <T size={12} muted>
            {t('estimateNote')}
          </T>
        ) : null}
      </Section>

      {error ? <T color={c.danger}>{t(error)}</T> : null}
      <Btn title={t('sendDrivers')} icon="paper-plane" onPress={send} />
      <Btn title={t('back')} kind="ghost" onPress={onBack} />
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

/** A panel that rises from the bottom over the screen, above the keyboard when one is open. */
function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      rise.setValue(0);
      Animated.spring(rise, { toValue: 1, useNativeDriver: true, friction: 9 }).start();
    }
  }, [visible, rise]);
  return (
    <Overlay visible={visible} onClose={onClose}>
      <ColorsContext.Provider value={c}>
        <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(19,20,26,0.45)' }} />
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 10, paddingBottom: keyboard ? keyboard + 12 : insets.bottom + 16, gap: 14, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }}>
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.line }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T size={20} weight="heavy" style={{ flex: 1 }}>
              {title}
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel={t_close()} onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={22} color={c.fg} />
            </Pressable>
          </View>
          {children}
        </Animated.View>
      </ColorsContext.Provider>
    </Overlay>
  );
}
const t_close = () => translate(getState().lang, 'close');

/** − price + (always in that order, also in Arabic), hold to keep going, tap the number to type it. */
function PriceEditor({ price, onChange, low, high }: { price: number; onChange: (p: number) => void; low?: number; high?: number }) {
  const c = useColors();
  const { t, lang } = useT();
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const latest = useRef(price);
  latest.current = price;
  const hold = useHoldRepeat((delta) => onChange(Math.max(10, latest.current + delta)));
  const apply = () => {
    const v = parseInt(typed, 10);
    if (v > 0) onChange(Math.min(200000, v));
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
  const offers = store.offers.filter((o) => o.requestId === req.id && o.status !== 'declined').sort((a, b) => a.price - b.price);
  const byId = (id: string | null) => offers.find((o) => o.id === id);
  const accept = (id: string) => {
    const o = byId(id);
    if (!o) return;
    patchRequest(req.id, {
      price: o.price,
      driverName: o.driverName,
      driverVehicle: o.vehicle,
      driverIsExample: o.example,
      acceptedAt: Date.now(),
    });
    setStage(req.id, 'accepted');
    play('success');
    if (o.example) runExampleTrip(req.id);
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
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} snapToInterval={cardW + 10} decelerationRate="fast" contentContainerStyle={{ gap: 10 }} style={{ flexGrow: 0, marginHorizontal: -12, paddingHorizontal: 12 }}>
          {offers.map((o, i) => (
            <View key={o.id} style={{ width: cardW, backgroundColor: c.surface, borderRadius: 22, borderWidth: i === 0 ? 2 : 1, borderColor: i === 0 ? c.live : c.line, padding: 12, gap: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${o.driverName}, ${dh(o.price, lang)}. ${t('seeDetails')}`}
                onPress={() => {
                  tap();
                  setDetails(o.id);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Initials name={o.driverName} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <T weight="heavy">{o.driverName}</T>
                    {offers.length > 1 ? (
                      <T size={12} muted>
                        {`${i + 1}/${offers.length}`}
                      </T>
                    ) : null}
                  </View>
                  <T size={13} muted>
                    {vName(t, o.vehicle)}
                  </T>
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
        </ScrollView>
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
              <Initials name={open.driverName} />
              <View style={{ flex: 1 }}>
                <T size={18} weight="heavy">
                  {open.driverName}
                </T>
                {open.example ? <Pill tone="warn">{t('exampleOffer')}</Pill> : null}
              </View>
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
            <PriceEditor price={counter.price} onChange={(p) => setCounter({ ...counter, price: p })} low={req.fairMin || undefined} high={req.fairMax || undefined} />
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
            <PriceEditor price={editing} onChange={setEditing} low={req.fairMin || undefined} high={req.fairMax || undefined} />
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
          patchRequest(req.id, { stage: 'cancelled' });
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

function Track({ req }: { req: Request }) {
  const c = useColors();
  const { t, lang } = useT();
  const idx = ['accepted', 'arrived', 'loaded', 'delivered'].indexOf(req.stage);
  const dotLeft = ['8%', '36%', '66%', '92%'][Math.max(0, idx)] as `${number}%`;
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <LiveDot />
        <T weight="bold" color={c.live}>
          {t(`st_${req.stage}` as Key)}
        </T>
      </View>
      <Card>
        <View style={{ height: 90, justifyContent: 'center' }}>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: c.raised,
              marginHorizontal: 12,
            }}
          />
          <View
            style={{
              position: 'absolute',
              start: 4,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: c.fg,
            }}
          />
          <View
            style={{
              position: 'absolute',
              end: 4,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: '#C2410C',
            }}
          />
          <View
            style={{
              position: 'absolute',
              start: dotLeft,
              marginStart: -16,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: c.live,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="car" size={18} color="#FFFFFF" />
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 10,
          }}>
          <T size={13} weight="bold" style={{ flex: 1 }}>
            {req.from}
          </T>
          <T size={13} weight="bold" style={{ flex: 1, textAlign: 'right' }}>
            {req.to}
          </T>
        </View>
        <Steps stage={req.stage} />
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Initials name={req.driverName ?? ''} />
          <View style={{ flex: 1 }}>
            <T weight="heavy">{req.driverName}</T>
            <T size={13} muted>
              {vName(t, req.driverVehicle)}
            </T>
          </View>
        </View>
        {req.driverIsExample ? <Pill tone="warn">{t('exampleTrip')}</Pill> : null}
      </Card>
      <View
        style={{
          backgroundColor: c.ink,
          borderRadius: 20,
          padding: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}>
        <View style={{ flex: 1 }}>
          <T weight="bold" color={c.onInk}>
            {t('deliveryCode')}
          </T>
          <T size={13} color={c.onInk} style={{ opacity: 0.8 }}>
            {t('deliveryCodeSub')}
          </T>
        </View>
        <T size={32} weight="heavy" color={c.onInk} style={{ letterSpacing: 6, writingDirection: 'ltr' }}>
          {req.code}
        </T>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T muted>{t('payCash')}</T>
        <T weight="heavy">{dh(req.price, lang)}</T>
      </View>
      <Chat req={req} side="customer" />
    </View>
  );
}

function Done({ req, onNew }: { req: Request; onNew: () => void }) {
  const c = useColors();
  const { t, lang, route } = useT();
  const mins = req.deliveredAt ? Math.max(1, Math.round((req.deliveredAt - req.createdAt) / 60000)) : 0;
  const took = mins >= 60 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')}` : `${mins} min`;
  const rating = getState().requests.find((r) => r.id === req.id)?.rating ?? 0;
  const pop = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    play('celebrate');
    Animated.spring(pop, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  }, [pop]);
  return (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Ionicons name="checkmark-circle" size={72} color={c.ok} />
        </Animated.View>
        <T size={28} weight="heavy">
          {t('delivered')}
        </T>
        <T muted>
          {t('paidTo', {
            price: dh(req.price, lang),
            name: req.driverName ?? '',
          })}
        </T>
      </View>
      <Card style={{ alignItems: 'center' }}>
        <T weight="heavy">{t('howWas')}</T>
        <View style={{ flexDirection: 'row', gap: 4, direction: 'ltr' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${n} ★`}
              onPress={() => {
                tap();
                patchRequest(req.id, { rating: n });
              }}
              style={{ padding: 4 }}>
              <Ionicons name={rating >= n ? 'star' : 'star-outline'} size={36} color="#B45309" />
            </Pressable>
          ))}
        </View>
      </Card>
      <View
        style={{
          backgroundColor: '#C2410C',
          borderRadius: 24,
          padding: 20,
          gap: 6,
        }}>
        <T size={13} weight="bold" color="#FFEDD5" style={{ letterSpacing: 1 }}>
          XAPP
        </T>
        <T size={28} weight="heavy" color="#FFFFFF">
          {t('movedIn', { time: took })}
        </T>
        <T size={15} color="#FFEDD5">
          {route(req.from, req.to)} · {req.load}
        </T>
      </View>
      <Btn
        title={t('share')}
        kind="ink"
        icon="share-social"
        onPress={() =>
          Share.share({
            message: t('shareText', { from: req.from, to: req.to }),
          }).catch(() => {})
        }
      />
      <Btn title={t('moveAnother')} kind="ghost" onPress={onNew} />
    </View>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, Share, TextInput, View } from 'react-native';

import { AiError, fillCard, previewAi, type Draft } from './ai';
import { Chat, estimateTrip, matchPlace, MyTrips, PlaceField } from './extras';
import { useT, type Key } from './i18n';
import { getPlace } from './lib/places';
import { Chip, Confirm, dh, Initials, PhotoStrip, Section, Steps, vName } from './shared';
import { play } from './sounds';
import { getState, newId, notify, patchRequest, runExampleTrip, scheduleExampleOffers, setStage, update, useStore, type Request } from './store';
import { Btn, Card, LiveDot, mainScroll, Pill, T, tap, useColors, VoicePlayer } from './ui';
import { formatWhen, WhenPicker } from './wheels';
import { fmtKg } from './scan';
import { capture, draftFromChecked, MAX_PHOTOS, NO_ANSWERS, NO_MEDIA, SawStep, SayStep, ScanStep, ShowStep, type Answers, type Checked, type Media, type Shot } from './flow';
import { scanLoad } from './scan';
import { setMapBig, setMapShown, setMapTrip } from './map/trip';

/** Which parts of the request the AI filled in (marked "AI" until the customer changes them). */
type AiMarks = Partial<Record<'goods' | 'weight' | 'vehicle' | 'route' | 'when' | 'notes' | 'price', boolean>>;
type CardState = Draft & {
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

export function CustomerSide({ openSettings }: { openSettings: () => void }) {
  const store = useStore();
  const { t, lang } = useT();
  const active = store.requests.find((r) => r.id === store.activeRequestId);
  const [step, setStep] = useState<'show' | 'scan' | 'saw' | 'say' | 'card'>('show');
  const [media, setMedia] = useState<Media>(NO_MEDIA);
  const [card, setCard] = useState<CardState | null>(null);
  const [checked, setChecked] = useState<Checked>(emptyChecked());
  const [answers, setAnswers] = useState<Answers>(NO_ANSWERS);
  const [note, setNote] = useState<Key | ''>('');
  const [error, setError] = useState<Key | ''>('');
  const [busy, setBusy] = useState(false);
  const [trips, setTrips] = useState(false);
  const [scanPhotos, setScanPhotos] = useState<Shot[]>([]);
  const [editingLoad, setEditingLoad] = useState(false);
  const aiOn = !!store.aiKey || previewAi();
  // The map behind the screen shows the trip: the request on its way, or the card being filled.
  const shown = active && active.stage !== 'cancelled' && active.stage !== 'delivered' ? active : step === 'card' ? card : null;
  const from = getPlace(shown?.fromPlaceId);
  const to = getPlace(shown?.toPlaceId);
  useEffect(() => {
    setMapTrip({
      from: from ? { lat: from.lat, lng: from.lng } : undefined,
      to: to ? { lat: to.lat, lng: to.lng } : undefined,
    });
  }, [from, to]);
  // The first steps use the whole screen; the map comes in once there is a trip to show.
  const busyRequest = !!active && active.stage !== 'cancelled';
  useEffect(() => {
    // The request card keeps the plain background; the map comes once the request is sent,
    // big while it waits for offers.
    setMapShown(busyRequest);
    setMapBig(busyRequest && active?.stage === 'open');
    return () => {
      setMapShown(true);
      setMapBig(false);
    };
  }, [busyRequest, active?.stage]);
  // Each new step starts at the top of the screen.
  useEffect(() => {
    mainScroll.current?.scrollTo({ y: 0, animated: false });
  }, [step, active?.stage]);
  const reset = () => {
    setEditingLoad(false);
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
      setStep(aiOn ? 'scan' : 'saw');
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
    setStep(aiOn ? 'scan' : 'saw');
  };

  const toCard = async () => {
    const base = draftFromChecked(checked, answers, t);
    const marks = (d: Draft): CardState => ({
      ...fromDraft(d),
      ai: {
        goods: !!d.goods && checked.scan.goods.length > 0,
        weight: d.weightKg > 0,
        vehicle: !checked.vehicle,
        route: !!(d.from || d.to),
        when: d.when !== 'now',
        notes: checked.care.length > 0,
        price: !!media.said.trim(),
      },
      usedAi: !!checked.scan.summary || !!media.said.trim(),
    });
    if (!media.said.trim() || !aiOn) {
      setCard(marks(base));
      setStep('card');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // "Say it" adds the route, time and price to what the photo showed.
      const d = await fillCard(store.aiKey, media.said, null, lang, base);
      play('success');
      setCard(
        marks({
          ...d,
          load: d.load || base.load,
          weightKg: base.weightKg || d.weightKg,
          vehicle: checked.vehicle ?? d.vehicle,
          helpers: Math.max(d.helpers, base.helpers),
          noteTags: Array.from(new Set([...base.noteTags, ...d.noteTags])),
        }),
      );
      setStep('card');
    } catch (e) {
      const code = e instanceof AiError ? e.code : 'offline';
      setError(code === 'bad_key' ? 'aiBadKey' : code === 'busy' ? 'aiBusy' : code === 'unclear' ? 'aiUnclear' : 'aiOffline');
    } finally {
      setBusy(false);
    }
  };

  if (active && active.stage !== 'cancelled') {
    if (active.stage === 'open') return <Offers req={active} />;
    if (active.stage === 'delivered')
      return (
        <Done
          req={active}
          onNew={() => {
            update((s) => ({ ...s, activeRequestId: null }));
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
        onBack={() => setStep('say')}
        onSent={reset}
        onEditLoad={() => {
          setEditingLoad(true);
          setStep('saw');
        }}
      />
    );
  if (step === 'scan')
    return (
      <ScanStep
        media={media}
        photos={scanPhotos}
        run={() => scanLoad(store.aiKey, scanPhotos.map((p) => p.base64), lang, checked.scan.items.length ? checked.scan : undefined)}
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
            setCard({ ...card, goods: d.goods, load: d.load, weightKg: d.weightKg, vehicle: d.vehicle, helpers: d.helpers, noteTags: Array.from(new Set([...d.noteTags, ...keep])) });
            setEditingLoad(false);
            setStep('card');
            return;
          }
          setStep('say');
        }}
      />
    );
  if (step === 'say')
    return (
      <SayStep
        media={media}
        setMedia={setMedia}
        busy={busy}
        error={error}
        onNext={toCard}
        onSkip={() => {
          setMedia({ ...media, said: '' });
          setCard(null);
          const d = draftFromChecked(checked, answers, t);
          setCard({
            ...fromDraft(d),
            ai: {
              goods: checked.scan.goods.length > 0,
              weight: d.weightKg > 0,
              vehicle: !checked.vehicle,
              notes: checked.care.length > 0,
            },
            usedAi: !!checked.scan.summary,
          });
          setStep('card');
        }}
      />
    );
  return (
    <>
      <ShowStep
        photos={media.photos}
        onShoot={(source) => shoot(source)}
        onRemove={removePhoto}
        onAnalyse={analyse}
        error={error}
        onSkip={() => {
          setChecked(emptyChecked());
          setNote('');
          setStep('saw');
        }}
        trips={store.requests.length}
        onTrips={() => setTrips(true)}
      />
      <MyTrips visible={trips} onClose={() => setTrips(false)} />
    </>
  );
}

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

function CardScreen({ media, card, setCard, onBack, onSent, onEditLoad }: { media: Media; card: CardState; setCard: (c: CardState) => void; onBack: () => void; onSent: () => void; onEditLoad: () => void }) {
  const c = useColors();
  const store = useStore();
  const { t, lang } = useT();
  const [error, setError] = useState<Key | ''>('');
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
      notes: card.notes.trim(),
      noteTags: card.noteTags,
      said: media.said.trim(),
      photoUri: media.photoUri,
      photoUris: media.photos.map((p) => p.uri),
      voiceUri: media.voiceUri,
      voiceMs: media.voiceMs,
      stage: 'open',
      code: String(1000 + Math.floor(Math.random() * 9000)),
      fromPlaceId: card.fromPlaceId,
      toPlaceId: card.toPlaceId,
      helpers: card.helpers,
      rideAlong: card.rideAlong,
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

  const min = Math.min(lo * 0.6, card.price);
  const max = Math.max(hi * 1.4, card.price);
  const span = max - min || 1;
  const aiLabel = t('aiPicked');

  return (
    <View style={{ gap: 14 }}>
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
          {card.weightKg ? <Pill>{`≈ ${fmtKg(card.weightKg, lang)}`}</Pill> : null}
          <Pill>{vName(t, card.vehicle)}</Pill>
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

      <Section title={t('secRoute')} hint={t('secRouteHint')} badge={card.ai.route ? aiLabel : undefined}>
        <PlaceField label={t('from')} icon="cube-outline" value={card.from} placeId={card.fromPlaceId} near={getPlace(card.toPlaceId)} onChange={(v, id) => set({ from: v, fromPlaceId: id }, 'route')} />
        <View style={{ height: 1, backgroundColor: c.line }} />
        <PlaceField label={t('to')} icon="flag-outline" value={card.to} placeId={card.toPlaceId} near={getPlace(card.fromPlaceId)} onChange={(v, id) => set({ to: v, toPlaceId: id }, 'route')} />
        {km ? (
          <T size={13} muted>
            {t('kmByRoad', { km })}
          </T>
        ) : null}
      </Section>

      <Section title={t('secWhen')} hint={t('secWhenHint')} badge={card.ai.when ? aiLabel : undefined}>
        <WhenPicker value={card.when} onChange={(v) => set({ when: v }, 'when')} />
      </Section>

      <Section title={t('secHelp')} hint={t('secHelpHint')} badge={card.ai.notes ? aiLabel : undefined}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip icon="person-outline" label={t('rideAlong')} on={card.rideAlong} onPress={() => set({ rideAlong: !card.rideAlong })} />
          <Chip
            label={t('n_narrow')}
            on={card.noteTags.includes('narrow')}
            onPress={() => set({ noteTags: card.noteTags.includes('narrow') ? card.noteTags.filter((x) => x !== 'narrow') : [...card.noteTags, 'narrow'] }, 'notes')}
          />
        </View>
        <TextInput
          value={card.notes}
          onChangeText={(v) => set({ notes: v })}
          placeholder={t('notePlaceholder')}
          placeholderTextColor={c.muted}
          accessibilityLabel={t('notePlaceholder')}
          style={{
            backgroundColor: c.raised,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 15,
            color: c.fg,
          }}
        />
      </Section>

      <Section title={t('secPrice')} hint={t('secPriceHint')} badge={card.ai.price ? aiLabel : undefined}>
        {lo && hi ? (
          <T size={13} muted>
            {t('fair', { low: dh(lo, lang), high: dh(hi, lang) })}
          </T>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('lower')}
            onPress={() => {
              tap();
              set({ price: Math.max(10, card.price - 10) }, 'price');
            }}
            style={{
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
          <T size={36} weight="heavy" style={{ lineHeight: 46 }}>
            {dh(card.price, lang)}
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('raise')}
            onPress={() => {
              tap();
              set({ price: card.price + 10 }, 'price');
            }}
            style={{
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

function Offers({ req }: { req: Request }) {
  const c = useColors();
  const store = useStore();
  const { t, lang, route } = useT();
  const [cancel, setCancel] = useState(false);
  const offers = store.offers.filter((o) => o.requestId === req.id).sort((a, b) => a.price - b.price);
  const accept = (id: string) => {
    const o = offers.find((x) => x.id === id);
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
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="checkmark-circle" size={20} color={c.ok} />
          <T weight="bold" color={c.ok}>
            {t('requestSent')}
          </T>
        </View>
        <T size={26} weight="heavy">
          {offers.length ? (offers.length === 1 ? t('oneOffer') : t('offersN', { n: offers.length })) : t('waitingDrivers')}
        </T>
        {!offers.length ? <WaitingBar /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <LiveDot />
          <T size={13} muted style={{ flex: 1 }}>
            {[route(req.from, req.to), formatWhen(req.when, lang, t), t('youAsked', { price: dh(req.price, lang) })].join(' · ')}
          </T>
        </View>
      </View>
      {offers.map((o, i) => (
        <Card key={o.id} style={i === 0 ? { borderWidth: 2, borderColor: c.live } : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Initials name={o.driverName} />
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="heavy">{o.driverName}</T>
              <T size={13} muted>
                {vName(t, o.vehicle)}
              </T>
              {o.example ? <Pill tone="warn">{t('exampleOffer')}</Pill> : null}
            </View>
            <T size={22} weight="heavy">
              {dh(o.price, lang)}
            </T>
          </View>
          <Btn title={t('accept', { price: dh(o.price, lang) })} kind={i === 0 ? 'ink' : 'ghost'} onPress={() => accept(o.id)} />
        </Card>
      ))}
      {!offers.length ? (
        <Card style={{ alignItems: 'center' }}>
          <T muted style={{ textAlign: 'center' }}>
            {t('noOffersYet')}
          </T>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Btn title={t('raise50')} kind="ghost" small onPress={() => patchRequest(req.id, { price: req.price + 50 })} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn title={t('cancel')} kind="ghost" small onPress={() => setCancel(true)} />
        </View>
      </View>
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

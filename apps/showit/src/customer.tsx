import { Ionicons } from '@expo/vector-icons';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, Share, TextInput, View } from 'react-native';

import { AiError, fillCard, previewAi, type Draft } from './ai';
import { GOODS, GOODS_ICON, nearestWeight, NOTE_TAGS, WEIGHTS, type Goods, type NoteTag } from './choices';
import { Chat, estimateTrip, HelpRow, matchPlace, MyTrips, PlaceField } from './extras';
import { useT, type Key } from './i18n';
import { getPlace } from './lib/places';
import { Chip, Confirm, dh, Initials, LoadDrawing, Section, Steps, VehiclePicker, VehicleRow, vName } from './shared';
import { play } from './sounds';
import { getState, newId, notify, patchRequest, runExampleTrip, scheduleExampleOffers, setStage, update, useStore, type Request } from './store';
import { Btn, Card, LiveDot, Pill, T, tap, useColors, useVoiceRecorder, VoicePlayer } from './ui';
import { bestFit } from './vehicles';
import { BigMic, SPEECH_LANGS, type SpeechLang } from './voice';
import { formatWhen, WhenPicker } from './wheels';
import { setMapTrip } from './map/trip';

const EXAMPLES = [
  { label: 'Darija', text: 'من المعاريف لحي الرياض فالرباط، غدا فالصباح، ب 600 درهم. تلاجة و صالون، الطابق الثالث و كاين المصعد' },
  { label: 'Français', text: 'Un frigo et un canapé, de Maarif à Hay Riad à Rabat, demain matin, 600 dirhams. 3e étage avec ascenseur.' },
  { label: 'English', text: '20 bags of cement from Derb Omar to Ain Sebaa, today at 4 pm, around 250 dirhams' },
];

type Media = { photoUri: string; photoBase64: string | null; voiceUri: string; voiceMs: number; said: string };
const NO_MEDIA: Media = { photoUri: '', photoBase64: null, voiceUri: '', voiceMs: 0, said: '' };

/** Which parts of the request the AI filled in (marked "AI" until the customer changes them). */
type AiMarks = Partial<Record<'goods' | 'weight' | 'vehicle' | 'route' | 'when' | 'notes' | 'price', boolean>>;
type CardState = Draft & { fromPlaceId?: string; toPlaceId?: string; ai: AiMarks; usedAi: boolean; aiNote: Key | ''; vehiclePicked: boolean };

const speechFor = (lang: string): SpeechLang => (lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : 'ar-MA');

function fromDraft(d: Draft, prev?: CardState): CardState {
  const a = d.from && d.from !== prev?.from ? matchPlace(d.from) : undefined;
  const b = d.to && d.to !== prev?.to ? matchPlace(d.to) : undefined;
  return {
    ...d,
    weightKg: nearestWeight(d.weightKg),
    fromPlaceId: a?.id ?? (d.from === prev?.from ? prev?.fromPlaceId : undefined),
    toPlaceId: b?.id ?? (d.to === prev?.to ? prev?.toPlaceId : undefined),
    ai: { goods: !!d.goods, weight: d.weightKg > 0, vehicle: true, route: !!(d.from || d.to), when: d.when !== 'now', notes: d.noteTags.length > 0, price: true },
    usedAi: true,
    aiNote: '',
    vehiclePicked: false,
  };
}

export function CustomerSide({ openSettings }: { openSettings: () => void }) {
  const store = useStore();
  const active = store.requests.find((r) => r.id === store.activeRequestId);
  const [step, setStep] = useState<'home' | 'card'>('home');
  const [media, setMedia] = useState<Media>(NO_MEDIA);
  const [card, setCard] = useState<CardState | null>(null);
  // The map behind the screen shows the trip: the request on its way, or the card being filled.
  const shown = active && active.stage !== 'cancelled' && active.stage !== 'delivered' ? active : step === 'card' ? card : null;
  const from = getPlace(shown?.fromPlaceId);
  const to = getPlace(shown?.toPlaceId);
  useEffect(() => {
    setMapTrip({ from: from ? { lat: from.lat, lng: from.lng } : undefined, to: to ? { lat: to.lat, lng: to.lng } : undefined });
  }, [from, to]);
  const reset = () => {
    setStep('home');
    setMedia(NO_MEDIA);
    setCard(null);
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
  if (step === 'card' && card) return <CardScreen media={media} card={card} setCard={setCard} onBack={() => setStep('home')} onSent={reset} />;
  return (
    <Home
      media={media}
      setMedia={setMedia}
      openSettings={openSettings}
      onCard={(c) => {
        setCard(c);
        setStep('card');
      }}
    />
  );
}

// ---------------- Home: 1 show it, 2 say it, 3 make the request ----------------

function Home({ media, setMedia, onCard, openSettings }: { media: Media; setMedia: (m: Media) => void; onCard: (c: CardState) => void; openSettings: () => void }) {
  const c = useColors();
  const store = useStore();
  const { t, lang } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Key | ''>('');
  const [trips, setTrips] = useState(false);
  const [speech, setSpeech] = useState<SpeechLang>(speechFor(lang));
  const aiOn = !!store.aiKey || previewAi();
  const latest = useRef(media);
  latest.current = media;
  const voiceOnly = useVoiceRecorder((uri, ms) => setMedia({ ...latest.current, voiceUri: uri, voiceMs: ms }));

  const takePhoto = async (source: 'camera' | 'library') => {
    setError('');
    try {
      if (source === 'camera') {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) {
          setError('cameraNoPermission');
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets[0]) return;
      const small = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
      setMedia({ ...latest.current, photoUri: small.uri, photoBase64: small.base64 ?? null });
      play('pop');
    } catch {
      setError('photoFailed');
    }
  };

  const make = async () => {
    setError('');
    const blank: CardState = {
      goods: '', load: '', weightKg: 0, vehicle: bestFit(300), from: '', to: '', when: 'now', price: 300, fairMin: 0, fairMax: 0, km: 0,
      noteTags: [], notes: '', helpers: 0, rideAlong: false, ai: {}, usedAi: false, aiNote: '', vehiclePicked: false,
    };
    if (!aiOn || (!media.said.trim() && !media.photoBase64)) {
      onCard(blank);
      return;
    }
    setBusy(true);
    try {
      const draft = await fillCard(store.aiKey, media.said, media.photoBase64, lang);
      play('success');
      onCard(fromDraft(draft));
    } catch (e) {
      const code = e instanceof AiError ? e.code : 'offline';
      if (code === 'bad_key') setError('aiBadKey');
      else if (code === 'busy') setError('aiBusy');
      else if (code === 'unclear') setError('aiUnclear');
      else if (code === 'no_key') onCard({ ...blank, aiNote: 'aiUnavailable' });
      else if (code === 'declined') onCard({ ...blank, aiNote: 'aiDeclined' });
      else setError('aiOffline');
    } finally {
      setBusy(false);
    }
  };

  const ready = !!media.photoUri || !!media.voiceUri || !!media.said.trim();

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <T size={30} weight="heavy" style={{ letterSpacing: lang === 'ar' ? 0 : -0.8 }}>
          {t('homeTitle')}
        </T>
        <T muted>{t('homeSub')}</T>
      </View>

      <Section title={t('step1Title')} hint={t('step1Hint')}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={media.photoUri ? t('retakePhoto') : t('takePhoto')}
          onPress={() => {
            tap();
            takePhoto('camera');
          }}
          style={{ height: 250, borderRadius: 22, backgroundColor: '#1B1D24', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {media.photoUri ? <Image source={{ uri: media.photoUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" /> : <LoadDrawing scale={0.85} />}
          {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
            <View
              key={k}
              style={{
                position: 'absolute',
                width: 28,
                height: 28,
                borderColor: '#FFFFFF',
                ...(k[0] === 't' ? { top: 16, borderTopWidth: 4 } : { bottom: 16, borderBottomWidth: 4 }),
                ...(k[1] === 'l' ? { left: 16, borderLeftWidth: 4 } : { right: 16, borderRightWidth: 4 }),
                ...(k === 'tl' ? { borderTopLeftRadius: 12 } : k === 'tr' ? { borderTopRightRadius: 12 } : k === 'bl' ? { borderBottomLeftRadius: 12 } : { borderBottomRightRadius: 12 }),
              }}
            />
          ))}
          <View style={{ position: 'absolute', bottom: 16, left: 56, right: 56, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
              <Ionicons name="camera" size={18} color="#FFFFFF" />
              <T size={14} weight="bold" color="#FFFFFF">
                {media.photoUri ? t('retakePhoto') : t('takePhoto')}
              </T>
            </View>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => takePhoto('library')} style={{ alignSelf: 'center', minHeight: 36, justifyContent: 'center' }}>
          <T size={14} weight="bold" color={c.accent}>
            {t('fromGallery')}
          </T>
        </Pressable>
      </Section>

      <Section title={t('step2Title')} hint={t('step2Hint')}>
        <BigMic
          speechLang={speech}
          text={media.said}
          onText={(s) => setMedia({ ...latest.current, said: s })}
          onVoiceNote={(uri, ms) => setMedia({ ...latest.current, voiceUri: uri, voiceMs: ms })}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <T size={13} muted weight="semibold">
            {t('speakIn')}
          </T>
          {SPEECH_LANGS.map((l) => (
            <Chip key={l.id} label={l.label} on={speech === l.id} onPress={() => setSpeech(l.id)} />
          ))}
        </View>
        {media.voiceUri ? (
          <View style={{ gap: 6 }}>
            <VoicePlayer uri={media.voiceUri} ms={media.voiceMs} label={t('voiceNoteYours')} />
            <Pressable accessibilityRole="button" onPress={() => setMedia({ ...latest.current, voiceUri: '', voiceMs: 0 })} style={{ minHeight: 34, justifyContent: 'center' }}>
              <T size={13} weight="bold" color={c.danger}>
                {t('deleteVoice')}
              </T>
            </Pressable>
          </View>
        ) : null}
        <T size={13} weight="semibold" muted>
          {t('orType')}
        </T>
        <TextInput
          value={media.said}
          onChangeText={(s) => setMedia({ ...latest.current, said: s })}
          multiline
          placeholder={t('typePlaceholder')}
          placeholderTextColor={c.muted}
          accessibilityLabel={t('orType')}
          style={{ minHeight: 84, borderRadius: 16, backgroundColor: c.raised, padding: 14, fontSize: 16, color: c.fg, textAlignVertical: 'top' }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <T size={13} muted weight="semibold">
            {t('tryExample')}
          </T>
          {EXAMPLES.map((e) => (
            <Chip key={e.label} label={e.label} on={media.said === e.text} onPress={() => setMedia({ ...latest.current, said: e.text })} />
          ))}
        </View>
        {!media.voiceUri ? (
          voiceOnly.recording ? (
            <Btn title={t('micStop')} kind="ghost" small icon="stop" onPress={() => voiceOnly.stop(true)} />
          ) : (
            <Pressable accessibilityRole="button" onPress={() => voiceOnly.start()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 }}>
              <Ionicons name="mic-outline" size={16} color={c.accent} />
              <T size={13} weight="bold" color={c.accent}>
                {t('voiceOnly')}
              </T>
            </Pressable>
          )
        ) : null}
        {voiceOnly.error ? (
          <T size={13} color={c.danger}>
            {voiceOnly.error}
          </T>
        ) : null}
      </Section>

      <View style={{ gap: 8 }}>
        <T size={18} weight="heavy">
          {t('step3Title')}
        </T>
        {error ? <T color={c.danger}>{t(error)}</T> : null}
        <Btn title={busy ? t('reading') : t('makeCard')} icon="sparkles" busy={busy} disabled={!ready} onPress={make} />
        {!aiOn ? (
          <Pressable accessibilityRole="button" onPress={openSettings} style={{ alignSelf: 'center', minHeight: 36, justifyContent: 'center' }}>
            <T size={13} muted style={{ textAlign: 'center' }}>
              {t('aiOff')}
            </T>
          </Pressable>
        ) : null}
      </View>
      {store.requests.length ? <Btn title={`${t('myTrips')} (${store.requests.length})`} kind="ghost" icon="time-outline" small onPress={() => setTrips(true)} /> : null}
      <MyTrips visible={trips} onClose={() => setTrips(false)} />
    </View>
  );
}

// ---------------- The request card: every answer is a choice the customer can change ----------------

function CardScreen({ media, card, setCard, onBack, onSent }: { media: Media; card: CardState; setCard: (c: CardState) => void; onBack: () => void; onSent: () => void }) {
  const c = useColors();
  const store = useStore();
  const { t, lang } = useT();
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<Key | ''>('');
  const [fix, setFix] = useState('');
  const [fixing, setFixing] = useState(false);
  const aiOn = !!store.aiKey || previewAi();
  const set = (patch: Partial<CardState>, mark?: keyof AiMarks) => setCard({ ...card, ...patch, ai: mark ? { ...card.ai, [mark]: false } : card.ai });

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

  const applyFix = async () => {
    if (!fix.trim()) return;
    setFixing(true);
    setError('');
    try {
      const { ai, usedAi, aiNote, vehiclePicked, fromPlaceId, toPlaceId, ...current } = card;
      void ai;
      void usedAi;
      void aiNote;
      void vehiclePicked;
      void fromPlaceId;
      void toPlaceId;
      const draft = await fillCard(store.aiKey, fix, null, lang, current);
      play('success');
      setCard(fromDraft(draft, card));
      setFix('');
    } catch (e) {
      const code = e instanceof AiError ? e.code : 'offline';
      setError(code === 'bad_key' ? 'aiBadKey' : code === 'busy' ? 'aiBusy' : code === 'unclear' ? 'aiUnclear' : 'aiOffline');
    } finally {
      setFixing(false);
    }
  };

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
    update((s) => ({ ...s, requests: [req, ...s.requests].slice(0, 60), activeRequestId: req.id }));
    scheduleExampleOffers(req);
    play('send');
    notify('driver', 'nt_newLoad', 'offer', { from: req.from, to: req.to, price: req.price });
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

      {media.photoUri || media.voiceUri || media.said.trim() ? (
        <Card>
          {media.photoUri ? <Image source={{ uri: media.photoUri }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }} resizeMode="cover" /> : null}
          {media.voiceUri ? <VoicePlayer uri={media.voiceUri} ms={media.voiceMs} label={t('voiceNoteYours')} /> : null}
          {media.said.trim() ? (
            <View style={{ backgroundColor: c.raised, borderRadius: 14, padding: 12 }}>
              <T size={15}>“{media.said.trim()}”</T>
            </View>
          ) : null}
        </Card>
      ) : null}

      {card.usedAi && aiOn ? (
        <Section title={t('fixTitle')} hint={t('fixHint')}>
          <BigMic small speechLang={speechFor(lang)} text={fix} onText={setFix} title={t('micTalk')} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              value={fix}
              onChangeText={setFix}
              placeholder={t('fixPlaceholder')}
              placeholderTextColor={c.muted}
              accessibilityLabel={t('fixPlaceholder')}
              style={{ flex: 1, backgroundColor: c.raised, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.fg }}
            />
            <View style={{ width: 110 }}>
              <Btn title={fixing ? t('fixing') : t('fixApply')} small busy={fixing} disabled={!fix.trim()} onPress={applyFix} />
            </View>
          </View>
        </Section>
      ) : null}

      <Section title={t('secGoods')} hint={t('secGoodsHint')} badge={card.ai.goods ? aiLabel : undefined}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GOODS.map((g) => (
            <Chip
              key={g}
              label={t(`g_${g}` as Key)}
              icon={GOODS_ICON[g] as keyof typeof Ionicons.glyphMap}
              on={card.goods === g}
              ai={card.ai.goods}
              onPress={() => set({ goods: card.goods === g ? '' : (g as Goods) }, 'goods')}
            />
          ))}
        </View>
        <TextInput
          value={card.load}
          onChangeText={(v) => set({ load: v })}
          placeholder={t('describePlaceholder')}
          placeholderTextColor={c.muted}
          accessibilityLabel={t('describePlaceholder')}
          style={{ backgroundColor: c.raised, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.fg }}
        />
      </Section>

      <Section title={t('secWeight')} hint={t('secWeightHint')} badge={card.ai.weight ? aiLabel : undefined}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {WEIGHTS.map((w) => (
            <Chip
              key={w.kg}
              label={w.label}
              on={card.weightKg === w.kg}
              ai={card.ai.weight}
              onPress={() => set({ weightKg: w.kg, ...(card.vehiclePicked ? {} : { vehicle: bestFit(w.kg) }) }, 'weight')}
            />
          ))}
        </View>
      </Section>

      <Section title={t('secVehicle')} hint={t('secVehicleHint')} badge={card.ai.vehicle ? aiLabel : undefined}>
        <VehicleRow id={card.vehicle} onChange={() => setPicker(true)} />
      </Section>

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
        <HelpRow helpers={card.helpers} rideAlong={card.rideAlong} onChange={(helpers, rideAlong) => set({ helpers, rideAlong })} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {NOTE_TAGS.map((n) => {
            const on = card.noteTags.includes(n);
            return (
              <Chip
                key={n}
                label={t(`n_${n}` as Key)}
                on={on}
                ai={card.ai.notes}
                onPress={() => set({ noteTags: on ? card.noteTags.filter((x) => x !== n) : [...card.noteTags, n as NoteTag] }, 'notes')}
              />
            );
          })}
        </View>
        <TextInput
          value={card.notes}
          onChangeText={(v) => set({ notes: v })}
          placeholder={t('notePlaceholder')}
          placeholderTextColor={c.muted}
          accessibilityLabel={t('notePlaceholder')}
          style={{ backgroundColor: c.raised, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.fg }}
        />
      </Section>

      <Section title={t('secPrice')} hint={t('secPriceHint')} badge={card.ai.price ? aiLabel : undefined}>
        {lo && hi ? (
          <T size={13} muted>
            {t('fair', { low: dh(lo, lang), high: dh(hi, lang) })}
          </T>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('lower')} onPress={() => { tap(); set({ price: Math.max(10, card.price - 10) }, 'price'); }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: c.line, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="remove" size={26} color={c.fg} />
          </Pressable>
          <T size={36} weight="heavy" style={{ lineHeight: 46 }}>
            {dh(card.price, lang)}
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel={t('raise')} onPress={() => { tap(); set({ price: card.price + 10 }, 'price'); }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: c.line, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={26} color={c.fg} />
          </Pressable>
        </View>
        {lo && hi ? (
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.raised, direction: 'ltr' }}>
            <View style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 4, backgroundColor: '#86EFAC', left: `${((lo - min) / span) * 100}%`, right: `${100 - ((hi - min) / span) * 100}%` }} />
            <View style={{ position: 'absolute', top: -5, width: 18, height: 18, borderRadius: 9, backgroundColor: c.ok, borderWidth: 2, borderColor: c.surface, left: `${((card.price - min) / span) * 100}%`, marginLeft: -9 }} />
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
      <VehiclePicker
        visible={picker}
        value={card.vehicle}
        weightKg={card.weightKg}
        onClose={() => setPicker(false)}
        onPick={(id) => {
          set({ vehicle: id, vehiclePicked: true }, 'vehicle');
          setPicker(false);
        }}
      />
    </View>
  );
}

// ---------------- Offers, trip, delivered ----------------

function Offers({ req }: { req: Request }) {
  const c = useColors();
  const store = useStore();
  const { t, lang, route } = useT();
  const [cancel, setCancel] = useState(false);
  const offers = store.offers.filter((o) => o.requestId === req.id).sort((a, b) => a.price - b.price);
  const accept = (id: string) => {
    const o = offers.find((x) => x.id === id);
    if (!o) return;
    patchRequest(req.id, { price: o.price, driverName: o.driverName, driverVehicle: o.vehicle, driverIsExample: o.example, acceptedAt: Date.now() });
    setStage(req.id, 'accepted');
    play('success');
    if (o.example) runExampleTrip(req.id);
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <LiveDot />
          <T weight="bold" color={c.live}>
            {t('live')}
          </T>
        </View>
        <T size={28} weight="heavy">
          {offers.length ? (offers.length === 1 ? t('oneOffer') : t('offersN', { n: offers.length })) : t('waitingOffers')}
        </T>
        <T muted>{[route(req.from, req.to), formatWhen(req.when, lang, t), t('youAsked', { price: dh(req.price, lang) })].join(' · ')}</T>
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
          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.raised, marginHorizontal: 12 }} />
          <View style={{ position: 'absolute', start: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: c.fg }} />
          <View style={{ position: 'absolute', end: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#C2410C' }} />
          <View style={{ position: 'absolute', start: dotLeft, marginStart: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: c.live, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="car" size={18} color="#FFFFFF" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
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
      <View style={{ backgroundColor: c.ink, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
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
    Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
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
        <T muted>{t('paidTo', { price: dh(req.price, lang), name: req.driverName ?? '' })}</T>
      </View>
      <Card style={{ alignItems: 'center' }}>
        <T weight="heavy">{t('howWas')}</T>
        <View style={{ flexDirection: 'row', gap: 4, direction: 'ltr' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} ★`} onPress={() => { tap(); patchRequest(req.id, { rating: n }); }} style={{ padding: 4 }}>
              <Ionicons name={rating >= n ? 'star' : 'star-outline'} size={36} color="#B45309" />
            </Pressable>
          ))}
        </View>
      </Card>
      <View style={{ backgroundColor: '#C2410C', borderRadius: 24, padding: 20, gap: 6 }}>
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
      <Btn title={t('share')} kind="ink" icon="share-social" onPress={() => Share.share({ message: t('shareText', { from: req.from, to: req.to }) }).catch(() => {})} />
      <Btn title={t('moveAnother')} kind="ghost" onPress={onNew} />
    </View>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, Share, TextInput, View } from 'react-native';

import { AiError, fillCard, type Draft } from './ai';
import { Confirm, dh, Initials, LoadDrawing, Steps, VehiclePicker, VehicleRow } from './shared';
import { getState, newId, patchRequest, runExampleTrip, scheduleExampleOffers, update, useStore, type Request } from './store';
import { Btn, Card, formatDuration, LiveDot, Pill, T, tap, useColors, useVoiceRecorder, VoicePlayer } from './ui';
import { bestFit, vehicleById } from './vehicles';

const EXAMPLES = [
  { label: 'Darija', text: 'من المعاريف لحي الرياض فالرباط، غدا فالصباح، ب 600 درهم. تلاجة و صالون، الطابق الثالث و كاين المصعد' },
  { label: 'Français', text: 'Un frigo et un canapé, de Maarif à Hay Riad à Rabat, demain matin, 600 dirhams. 3e étage avec ascenseur.' },
  { label: 'English', text: '20 bags of cement from Derb Omar to Ain Sebaa, today at 4 pm, around 250 dirhams' },
];

type Media = { photoUri: string; photoBase64: string | null; voiceUri: string; voiceMs: number; said: string };
type CardState = Draft & { aiNote: string };

export function CustomerSide({ openSettings }: { openSettings: () => void }) {
  const store = useStore();
  const active = store.requests.find((r) => r.id === store.activeRequestId);
  const [step, setStep] = useState<'home' | 'card'>('home');
  const [media, setMedia] = useState<Media>({ photoUri: '', photoBase64: null, voiceUri: '', voiceMs: 0, said: '' });
  const [card, setCard] = useState<CardState | null>(null);

  if (active && active.stage !== 'cancelled') {
    if (active.stage === 'open') return <Offers req={active} />;
    if (active.stage === 'delivered') return <Done req={active} onNew={() => { update((s) => ({ ...s, activeRequestId: null })); setStep('home'); setMedia({ photoUri: '', photoBase64: null, voiceUri: '', voiceMs: 0, said: '' }); setCard(null); }} />;
    return <Track req={active} />;
  }
  if (step === 'card' && card) {
    return (
      <CardScreen
        media={media}
        card={card}
        setCard={setCard}
        onBack={() => setStep('home')}
        onSent={() => {
          setStep('home');
          setCard(null);
          setMedia({ photoUri: '', photoBase64: null, voiceUri: '', voiceMs: 0, said: '' });
        }}
      />
    );
  }
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

function Home({ media, setMedia, onCard, openSettings }: { media: Media; setMedia: (m: Media) => void; onCard: (c: CardState) => void; openSettings: () => void }) {
  const c = useColors();
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const voice = useVoiceRecorder((uri, ms) => setMedia({ ...media, voiceUri: uri, voiceMs: ms }));

  const takePhoto = async (source: 'camera' | 'library') => {
    setError('');
    try {
      if (source === 'camera') {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) {
          setError('Allow the camera in your phone settings to take a photo.');
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets[0]) return;
      const small = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
      setMedia({ ...media, photoUri: small.uri, photoBase64: small.base64 ?? null });
    } catch {
      setError('The photo could not be opened. Try again.');
    }
  };

  const make = async () => {
    setError('');
    const blank: CardState = {
      load: '', weightKg: 0, vehicle: bestFit(300), from: '', to: '', when: 'Now', price: 300, fairMin: 0, fairMax: 0, km: 0, notes: '',
      aiNote: store.aiKey ? '' : 'Fill in your card. To let the AI fill it for you, add an AI key in Settings.',
    };
    if (!store.aiKey || (!media.said.trim() && !media.photoBase64)) {
      onCard(blank);
      return;
    }
    setBusy(true);
    try {
      const draft = await fillCard(store.aiKey, media.said, media.photoBase64);
      onCard({ ...draft, aiNote: '' });
    } catch (e) {
      const code = e instanceof AiError ? e.code : 'offline';
      if (code === 'bad_key') setError('The AI key was not accepted. Check it in Settings.');
      else if (code === 'busy') setError('The AI is busy. Wait a moment and try again.');
      else if (code === 'unclear') setError('The AI answer was unclear. Tap "Make my card" again.');
      else if (code === 'declined') onCard({ ...blank, aiNote: 'The AI could not read this one. Fill in your card.' });
      else setError('No connection to the AI. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  const ready = !!media.photoUri || !!media.voiceUri || !!media.said.trim();

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <T size={30} weight="heavy" style={{ letterSpacing: -0.8, lineHeight: 34 }}>
          What are you moving?
        </T>
        <T muted>Show it, say where and your price. Drivers send offers.</T>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={media.photoUri ? 'Take another photo of your load' : 'Take a photo of your load'}
        onPress={() => {
          tap();
          takePhoto('camera');
        }}
        style={{ height: 290, borderRadius: 26, backgroundColor: '#1B1D24', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {media.photoUri ? <Image source={{ uri: media.photoUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" /> : <LoadDrawing />}
        {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
          <View
            key={k}
            style={{
              position: 'absolute',
              width: 30,
              height: 30,
              borderColor: '#FFFFFF',
              ...(k[0] === 't' ? { top: 18, borderTopWidth: 4 } : { bottom: 18, borderBottomWidth: 4 }),
              ...(k[1] === 'l' ? { left: 18, borderLeftWidth: 4 } : { right: 18, borderRightWidth: 4 }),
              ...(k === 'tl' ? { borderTopLeftRadius: 12 } : k === 'tr' ? { borderTopRightRadius: 12 } : k === 'bl' ? { borderBottomLeftRadius: 12 } : { borderBottomRightRadius: 12 }),
            }}
          />
        ))}
        <View style={{ position: 'absolute', bottom: 18, left: 60, right: 60, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
            <Ionicons name="camera" size={18} color="#FFFFFF" />
            <T size={14} weight="bold" color="#FFFFFF">
              {media.photoUri ? 'Take another photo' : 'Show it: take a photo'}
            </T>
          </View>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => takePhoto('library')} style={{ alignSelf: 'center', minHeight: 36, justifyContent: 'center' }}>
        <T size={14} weight="bold" color={c.accent}>
          or choose a photo from your gallery
        </T>
      </Pressable>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T weight="heavy">Voice note for the driver</T>
          <Pill>optional</Pill>
        </View>
        {voice.recording ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#DC2626' }} />
              <T weight="bold">Recording {formatDuration(voice.ms)}</T>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Btn title="Cancel" kind="ghost" small onPress={() => voice.stop(false)} />
              </View>
              <View style={{ flex: 1.4 }}>
                <Btn title="Stop and keep" icon="checkmark" small onPress={() => voice.stop(true)} />
              </View>
            </View>
          </View>
        ) : media.voiceUri ? (
          <View style={{ gap: 8 }}>
            <VoicePlayer uri={media.voiceUri} ms={media.voiceMs} label="Your voice note" />
            <Pressable accessibilityRole="button" onPress={() => setMedia({ ...media, voiceUri: '', voiceMs: 0 })} style={{ minHeight: 36, justifyContent: 'center' }}>
              <T size={14} weight="bold" color={c.danger}>
                Delete and record again
              </T>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Record a voice note"
            onPress={() => voice.start()}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.accent, borderRadius: 18, padding: 14, opacity: pressed ? 0.85 : 1 })}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="mic" size={26} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <T weight="heavy" color="#FFFFFF">
                Record a voice note
              </T>
              <T size={13} color="#FFEDD5">
                Tap, speak as long as you like, then tap Stop
              </T>
            </View>
          </Pressable>
        )}
        {voice.error ? (
          <T size={14} color={c.danger}>
            {voice.error}
          </T>
        ) : null}
      </Card>

      <Card>
        <T weight="heavy">Say it for the AI to write</T>
        <TextInput
          value={media.said}
          onChangeText={(t) => setMedia({ ...media, said: t })}
          multiline
          placeholder="From where, to where, when, your price"
          placeholderTextColor={c.muted}
          accessibilityLabel="Your trip in words"
          style={{ minHeight: 90, borderRadius: 16, backgroundColor: c.raised, padding: 14, fontSize: 16, color: c.fg, textAlignVertical: 'top' }}
        />
        <T size={13} muted>
          To speak instead of typing, tap the microphone on your phone keyboard: Darija, العربية, Français or English.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {EXAMPLES.map((e) => (
            <Pressable
              key={e.label}
              accessibilityRole="button"
              onPress={() => setMedia({ ...media, said: e.text })}
              style={{ borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
              <T size={14} weight="semibold">
                Try {e.label}
              </T>
            </Pressable>
          ))}
        </View>
      </Card>

      {error ? <T color={c.danger}>{error}</T> : null}
      <Btn title={busy ? 'Reading your load' : 'Make my card'} icon="sparkles" busy={busy} disabled={!ready} onPress={make} />
      {!store.aiKey ? (
        <Pressable accessibilityRole="button" onPress={openSettings} style={{ alignSelf: 'center', minHeight: 36, justifyContent: 'center' }}>
          <T size={13} muted style={{ textAlign: 'center' }}>
            AI is off: you will fill the card yourself. Tap to add an AI key.
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <T size={14} muted weight="semibold" style={{ width: 84 }}>
        {label}
      </T>
      <TextInput
        value={value}
        onChangeText={onChange}
        accessibilityLabel={label}
        placeholder="Add"
        placeholderTextColor={c.muted}
        style={{ flex: 1, backgroundColor: c.raised, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: '700', color: c.fg }}
      />
    </View>
  );
}

function CardScreen({ media, card, setCard, onBack, onSent }: { media: Media; card: CardState; setCard: (c: CardState) => void; onBack: () => void; onSent: () => void }) {
  const c = useColors();
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<CardState>) => setCard({ ...card, ...patch });
  const lo = card.fairMin;
  const hi = card.fairMax;
  const min = Math.min(lo * 0.6, card.price);
  const max = Math.max(hi * 1.4, card.price);
  const span = max - min || 1;

  const send = () => {
    if (!card.from.trim() || !card.to.trim()) {
      setError('Add where to pick up and where to deliver.');
      return;
    }
    const req: Request = {
      id: newId(),
      createdAt: Date.now(),
      load: card.load.trim() || 'Goods',
      weightKg: card.weightKg,
      vehicle: card.vehicle,
      from: card.from.trim(),
      to: card.to.trim(),
      when: card.when.trim() || 'Now',
      price: card.price,
      fairMin: card.fairMin,
      fairMax: card.fairMax,
      km: card.km,
      notes: card.notes.trim(),
      said: media.said.trim(),
      photoUri: media.photoUri,
      voiceUri: media.voiceUri,
      voiceMs: media.voiceMs,
      stage: 'open',
      code: String(1000 + Math.floor(Math.random() * 9000)),
    };
    update((s) => ({ ...s, requests: [req, ...s.requests].slice(0, 60), activeRequestId: req.id }));
    scheduleExampleOffers(req);
    onSent();
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={card.aiNote ? 'create-outline' : 'checkmark-circle'} size={22} color={c.ok} />
        <T weight="bold" color={c.ok} style={{ flex: 1 }}>
          {card.aiNote || 'Got it. Check your card and send.'}
        </T>
      </View>
      <Card>
        {media.photoUri ? <Image source={{ uri: media.photoUri }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }} resizeMode="cover" /> : null}
        {media.voiceUri ? <VoicePlayer uri={media.voiceUri} ms={media.voiceMs} label="Your voice note" /> : null}
        {media.said.trim() ? (
          <View style={{ backgroundColor: c.raised, borderRadius: 14, padding: 12 }}>
            <T size={15}>“{media.said.trim()}”</T>
          </View>
        ) : null}
        <VehicleRow id={card.vehicle} onChange={() => setPicker(true)} note={`${vehicleById(card.vehicle).carries} · tap to change`} />
        <View>
          <Field label="Load" value={card.load} onChange={(v) => set({ load: v })} />
          <Field label="From" value={card.from} onChange={(v) => set({ from: v })} />
          <Field label="To" value={card.to} onChange={(v) => set({ to: v })} />
          <Field label="When" value={card.when} onChange={(v) => set({ when: v })} />
          <Field label="For driver" value={card.notes} onChange={(v) => set({ notes: v })} />
        </View>
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <T muted weight="semibold">
            Your price, cash on delivery
          </T>
          {lo && hi ? (
            <T size={13} muted>
              Fair: {dh(lo)}–{dh(hi)}
            </T>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Lower price by 10 dirhams" onPress={() => { tap(); set({ price: Math.max(10, card.price - 10) }); }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: c.line, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="remove" size={26} color={c.fg} />
          </Pressable>
          <T size={38} weight="heavy" style={{ letterSpacing: -1, lineHeight: 46 }}>
            {dh(card.price)}
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel="Raise price by 10 dirhams" onPress={() => { tap(); set({ price: card.price + 10 }); }} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: c.line, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={26} color={c.fg} />
          </Pressable>
        </View>
        {lo && hi ? (
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.raised }}>
            <View style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 4, backgroundColor: '#86EFAC', left: `${((lo - min) / span) * 100}%`, right: `${100 - ((hi - min) / span) * 100}%` }} />
            <View style={{ position: 'absolute', top: -5, width: 18, height: 18, borderRadius: 9, backgroundColor: c.ok, borderWidth: 2, borderColor: c.surface, left: `${((card.price - min) / span) * 100}%`, marginLeft: -9 }} />
          </View>
        ) : null}
        {card.weightKg || card.km ? (
          <T size={13} muted>
            {[card.weightKg ? `≈ ${card.weightKg} kg` : '', card.km ? `≈ ${card.km} km` : ''].filter(Boolean).join(' · ')} · AI estimate, check it
          </T>
        ) : null}
      </Card>
      {error ? <T color={c.danger}>{error}</T> : null}
      <Btn title="Send to drivers" icon="paper-plane" onPress={send} />
      <Btn title="Back" kind="ghost" onPress={onBack} />
      <VehiclePicker
        visible={picker}
        value={card.vehicle}
        weightKg={card.weightKg}
        onClose={() => setPicker(false)}
        onPick={(id) => {
          set({ vehicle: id });
          setPicker(false);
        }}
      />
    </View>
  );
}

function Offers({ req }: { req: Request }) {
  const c = useColors();
  const store = useStore();
  const [cancel, setCancel] = useState(false);
  const offers = store.offers.filter((o) => o.requestId === req.id).sort((a, b) => a.price - b.price);
  const accept = (id: string) => {
    const o = offers.find((x) => x.id === id);
    if (!o) return;
    patchRequest(req.id, { stage: 'accepted', price: o.price, driverName: o.driverName, driverVehicle: o.vehicle, driverIsExample: o.example, acceptedAt: Date.now() });
    if (o.example) runExampleTrip(req.id);
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <LiveDot />
          <T weight="bold" color={c.live}>
            Live · drivers can see your load
          </T>
        </View>
        <T size={28} weight="heavy" style={{ letterSpacing: -0.6 }}>
          {offers.length ? `${offers.length} ${offers.length === 1 ? 'offer' : 'offers'}` : 'Waiting for offers'}
        </T>
        <T muted>
          {req.from} → {req.to} · {req.when} · you asked {dh(req.price)}
        </T>
      </View>
      {offers.map((o, i) => (
        <Card key={o.id} style={i === 0 ? { borderWidth: 2, borderColor: c.live } : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Initials name={o.driverName} />
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="heavy">{o.driverName}</T>
              <T size={13} muted>
                {vehicleById(o.vehicle).name}
              </T>
              {o.example ? <Pill tone="warn">Example offer for testing</Pill> : null}
            </View>
            <T size={22} weight="heavy">
              {dh(o.price)}
            </T>
          </View>
          <Btn title={`Accept · ${dh(o.price)}`} kind={i === 0 ? 'ink' : 'ghost'} onPress={() => accept(o.id)} />
        </Card>
      ))}
      {!offers.length ? (
        <Card style={{ alignItems: 'center' }}>
          <T muted style={{ textAlign: 'center' }}>
            Offers appear here as drivers answer. Switch to Driver at the top to send your own test offer.
          </T>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Btn title="Raise +50" kind="ghost" small onPress={() => patchRequest(req.id, { price: req.price + 50 })} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn title="Cancel" kind="ghost" small onPress={() => setCancel(true)} />
        </View>
      </View>
      <Confirm
        visible={cancel}
        title="Cancel this request?"
        body="Drivers will stop seeing it."
        yes="Cancel request"
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

const STAGE_TEXT: Record<string, string> = {
  accepted: 'Driver accepted, coming to pickup',
  arrived: 'Driver arrived at pickup',
  loaded: 'Loaded and on the road',
};

function Track({ req }: { req: Request }) {
  const c = useColors();
  const idx = ['accepted', 'arrived', 'loaded', 'delivered'].indexOf(req.stage);
  const dotLeft = ['8%', '36%', '66%', '92%'][Math.max(0, idx)] as `${number}%`;
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <LiveDot />
        <T weight="bold" color={c.live}>
          {STAGE_TEXT[req.stage] ?? 'On the way'}
        </T>
      </View>
      <Card>
        <View style={{ height: 90, justifyContent: 'center' }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.raised, marginHorizontal: 12 }} />
          <View style={{ position: 'absolute', left: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: c.fg }} />
          <View style={{ position: 'absolute', right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#C2410C' }} />
          <View style={{ position: 'absolute', left: dotLeft, marginLeft: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: c.live, alignItems: 'center', justifyContent: 'center' }}>
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
              {vehicleById(req.driverVehicle).name}
            </T>
          </View>
        </View>
        {req.driverIsExample ? <Pill tone="warn">Example trip: it moves on by itself every few seconds</Pill> : null}
      </Card>
      <View style={{ backgroundColor: c.ink, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <T weight="bold" color={c.onInk}>
            Delivery code
          </T>
          <T size={13} color={c.onInk} style={{ opacity: 0.8 }}>
            Give it to the driver at the door
          </T>
        </View>
        <T size={32} weight="heavy" color={c.onInk} style={{ letterSpacing: 6 }}>
          {req.code}
        </T>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T muted>Pay in cash at delivery</T>
        <T weight="heavy">{dh(req.price)}</T>
      </View>
    </View>
  );
}

function Done({ req, onNew }: { req: Request; onNew: () => void }) {
  const c = useColors();
  const mins = req.deliveredAt ? Math.max(1, Math.round((req.deliveredAt - req.createdAt) / 60000)) : 0;
  const took = mins >= 60 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')}` : `${mins} min`;
  const rating = getState().requests.find((r) => r.id === req.id)?.rating ?? 0;
  return (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 8 }}>
        <Ionicons name="checkmark-circle" size={64} color={c.ok} />
        <T size={28} weight="heavy">
          Delivered
        </T>
        <T muted>
          Paid {dh(req.price)} in cash to {req.driverName}
        </T>
      </View>
      <Card style={{ alignItems: 'center' }}>
        <T weight="heavy">How was the driver?</T>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} stars`} onPress={() => { tap(); patchRequest(req.id, { rating: n }); }} style={{ padding: 4 }}>
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
          Moved in {took}
        </T>
        <T size={15} color="#FFEDD5">
          {req.from} → {req.to} · {req.load}
        </T>
      </View>
      <Btn
        title="Share on WhatsApp or Instagram"
        kind="ink"
        icon="share-social"
        onPress={() => Share.share({ message: `I moved ${req.load} from ${req.from} to ${req.to} with Xapp: one photo, one sentence, offers in minutes.` }).catch(() => {})}
      />
      <Btn title="Move something else" kind="ghost" onPress={onNew} />
    </View>
  );
}

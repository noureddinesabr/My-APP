import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, TextInput, View } from 'react-native';

import { Chat } from './extras';
import { useT, type Key } from './i18n';
import { dh, LoadDrawing, OngoingCard, PhotoStrip, Steps, VehiclePicker, VehicleRow, vName } from './shared';
import { useBack } from './back';
import { onHome, onOpenTrip } from './home';
import { play } from './sounds';
import { addOffer, setStage, update, useStore, type Request } from './store';
import { Btn, Card, LiveDot, Pill, T, tap, useColors, VoicePlayer } from './ui';
import { getPlace } from './lib/places';
import { setMapTrip } from './map/trip';
import { formatWhen } from './wheels';

type TFn = ReturnType<typeof useT>['t'];

const ago = (t: TFn, at: number) => {
  const m = Math.max(0, Math.round((Date.now() - at) / 60000));
  return m < 1 ? t('justNow') : m < 60 ? t('minAgo', { n: m }) : t('hAgo', { n: Math.round(m / 60) });
};

/** The details a driver needs at a glance: goods, weight, when, distance, helpers and notes. */
function Facts({ req, withPrice }: { req: Request; withPrice?: boolean }) {
  const { t, lang } = useT();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      <Pill>{[req.goods ? t(`g_${req.goods}` as Key) : '', req.load !== (req.goods ? t(`g_${req.goods}` as Key) : '') ? req.load : '', req.weightKg ? `≈ ${req.weightKg >= 1000 ? `${req.weightKg / 1000} t` : `${req.weightKg} kg`}` : ''].filter(Boolean).join(' · ') || req.load}</Pill>
      <Pill>{formatWhen(req.when, lang, t)}</Pill>
      {req.km ? <Pill>{`≈ ${req.km} km`}</Pill> : null}
      {withPrice ? <Pill tone="ok">{t('cash', { price: dh(req.price, lang) })}</Pill> : null}
      {req.helpers ? <Pill tone="warn">{req.helpers === 1 ? t('oneHelper') : t('helpersNeeded', { n: req.helpers })}</Pill> : null}
      {req.riderName ? <Pill>{t('ridesWith', { name: req.riderName })}</Pill> : req.rideAlong ? <Pill>{t('ridesAlong')}</Pill> : null}
      {(req.noteTags ?? []).map((n) => (
        <Pill key={n} tone="warn">
          {t(`n_${n}` as Key)}
        </Pill>
      ))}
    </View>
  );
}

export function DriverSide() {
  const store = useStore();
  const { t, route } = useT();
  const me = store.driver;
  const [tab, setTab] = useState<'loads' | 'earn'>('loads');
  const [editing, setEditing] = useState(false);
  const mine = (r: Request) => !r.driverIsExample && !!me.name && r.driverName === me.name;
  const job = store.requests.find((r) => mine(r) && (r.stage === 'accepted' || r.stage === 'arrived' || r.stage === 'loaded'));
  // Opens on the loads page; a job in progress is one tap away, and opens by itself only when new.
  const [jobOpen, setJobOpen] = useState(false);
  const seenJob = useRef(job?.id);
  useEffect(() => {
    if (job?.id && job.id !== seenJob.current) setJobOpen(true);
    seenJob.current = job?.id;
  }, [job?.id]);
  const showingJob = !!job && jobOpen;
  useBack(showingJob, () => setJobOpen(false));
  // A tapped notification opens the job in progress.
  useEffect(() => onOpenTrip(() => job && setJobOpen(true)));
  // The X logo: back to the loads page.
  useEffect(
    () =>
      onHome(() => {
        setJobOpen(false);
        setEditing(false);
        setTab('loads');
      }),
    [],
  );
  useBack(!showingJob && editing, () => setEditing(false));
  useBack(!showingJob && !editing && tab === 'earn', () => setTab('loads'));
  // The map behind the screen shows the driver's current job.
  const from = getPlace(showingJob ? job?.fromPlaceId : undefined);
  const to = getPlace(showingJob ? job?.toPlaceId : undefined);
  useEffect(() => {
    setMapTrip({ from: from ? { lat: from.lat, lng: from.lng } : undefined, to: to ? { lat: to.lat, lng: to.lng } : undefined });
  }, [from, to]);

  if (!me.name.trim() || editing) return <Profile onDone={() => setEditing(false)} />;
  if (showingJob && job) return <Job req={job} />;
  return (
    <View style={{ gap: 14 }}>
      {job ? <OngoingCard title={t('jobNow')} line={route(job.from.split(/[,،]/)[0], job.to.split(/[,،]/)[0])} status={job.stage === 'accepted' ? t('stepAccepted') : job.stage === 'arrived' ? t('stepArrived') : t('stepLoaded')} onOpen={() => setJobOpen(true)} /> : null}
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'earn' ? <Earnings done={store.requests.filter((r) => mine(r) && r.stage === 'delivered')} /> : <Loads onEdit={() => setEditing(true)} />}
    </View>
  );
}

function Tabs({ tab, setTab }: { tab: 'loads' | 'earn'; setTab: (t: 'loads' | 'earn') => void }) {
  const c = useColors();
  const { t } = useT();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {(
        [
          ['loads', t('tabLoads')],
          ['earn', t('tabEarnings')],
        ] as const
      ).map(([id, label]) => (
        <Pressable
          key={id}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === id }}
          onPress={() => {
            tap();
            setTab(id);
          }}
          style={{ flex: 1, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: tab === id ? c.surface : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          <T weight="bold" color={tab === id ? c.fg : c.muted}>
            {label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

function Profile({ onDone }: { onDone: () => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const store = useStore();
  const [name, setName] = useState(store.driver.name);
  const [vehicle, setVehicle] = useState(store.driver.vehicle);
  const [picker, setPicker] = useState(false);
  return (
    <View style={{ gap: 14 }}>
      <T size={28} weight="heavy">
        {t('profileTitle')}
      </T>
      <T muted>{t('profileSub')}</T>
      <Card>
        <T weight="bold">{t('yourName')}</T>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('namePlaceholder')}
          placeholderTextColor={c.muted}
          accessibilityLabel={t('yourName')}
          style={{ backgroundColor: c.raised, borderRadius: 14, padding: 14, fontSize: 16, color: c.fg }}
        />
        <T weight="bold">{t('yourVehicle')}</T>
        <VehicleRow id={vehicle} onChange={() => setPicker(true)} />
      </Card>
      <Btn
        title={t('saveProfile')}
        disabled={!name.trim()}
        onPress={() => {
          update((s) => ({ ...s, driver: { name: name.trim(), vehicle } }));
          onDone();
        }}
      />
      <VehiclePicker
        visible={picker}
        value={vehicle}
        weightKg={0}
        onClose={() => setPicker(false)}
        onPick={(id) => {
          setVehicle(id);
          setPicker(false);
        }}
      />
    </View>
  );
}

function Loads({ onEdit }: { onEdit: () => void }) {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const day = Date.now() - 36 * 3600 * 1000;
  const open = store.requests.filter((r) => r.stage === 'open' && r.createdAt > day);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.liveSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexShrink: 1 }}>
          <LiveDot />
          <T size={13} weight="bold" color={c.live}>
            {t('online', { name: store.driver.name, vehicle: vName(t, store.driver.vehicle) })}
          </T>
        </View>
        <Pressable accessibilityRole="button" onPress={onEdit} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: c.line, justifyContent: 'center' }}>
          <T size={14} weight="bold">
            {t('edit')}
          </T>
        </Pressable>
      </View>
      {open.map((r) => (
        <LoadCard key={r.id} req={r} />
      ))}
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
  const offer = (price: number) => {
    play('send');
    addOffer({ id: `${req.id}_me`, requestId: req.id, driverName: store.driver.name, vehicle: store.driver.vehicle, price, createdAt: Date.now(), example: false });
  };
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 24, overflow: 'hidden' }}>
      <View style={{ height: 200, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
        {req.photoUri ? <Image source={{ uri: req.photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <LoadDrawing scale={0.9} />}
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        <T size={19} weight="heavy">
          {route(req.from, req.to)}
        </T>
        {req.voiceUri ? <VoicePlayer uri={req.voiceUri} ms={req.voiceMs} label={t('customerVoice')} /> : null}
        {req.said ? (
          <View style={{ backgroundColor: c.raised, borderRadius: 14, padding: 12 }}>
            <T size={15}>“{req.said}”</T>
          </View>
        ) : null}
        <Facts req={req} />
        <VehicleRow id={req.vehicle} note={t('customerAsked')} />
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
        <Btn title={t('accept', { price: dh(req.price, lang) })} onPress={() => offer(req.price)} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[50, 100, 200].map((n) => (
            <View key={n} style={{ flex: 1 }}>
              <Btn title={`+${n}`} kind="ghost" small onPress={() => offer(req.price + n)} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function Job({ req }: { req: Request }) {
  const c = useColors();
  const { t, lang } = useT();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const going = req.stage === 'loaded' ? req.to : req.from;
  const deliver = () => {
    if (code.trim() !== req.code) {
      setError(t('codeWrong'));
      return;
    }
    play('celebrate');
    setStage(req.id, 'delivered');
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <LiveDot />
        <T weight="bold" color={c.live}>
          {req.stage === 'loaded' ? t('goingDropoff') : t('goingPickup')}
        </T>
      </View>
      <T size={28} weight="heavy">
        {going}
      </T>
      <Card>
        {req.photoUri ? <Image source={{ uri: req.photoUri }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }} resizeMode="cover" /> : null}
        {(req.photoUris?.length ?? 0) > 1 ? <PhotoStrip uris={req.photoUris!.slice(1)} /> : null}
        {req.voiceUri ? <VoicePlayer uri={req.voiceUri} ms={req.voiceMs} label={t('customerVoice')} /> : null}
        <Facts req={req} withPrice />
        {req.notes ? (
          <T size={14} muted>
            {req.notes}
          </T>
        ) : null}
        <Steps stage={req.stage} />
        <Btn title={t('directions')} kind="ghost" icon="navigate" small onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(going)}`).catch(() => {})} />
      </Card>
      {req.stage === 'accepted' ? <Btn title={t('arrivedBtn')} icon="location" onPress={() => setStage(req.id, 'arrived')} /> : null}
      {req.stage === 'arrived' ? <Btn title={t('loadedBtn')} icon="cube" onPress={() => setStage(req.id, 'loaded')} /> : null}
      {req.stage === 'loaded' ? (
        <Card>
          <T weight="heavy">{t('finish')}</T>
          <T size={14} muted>
            {t('finishSub', { price: dh(req.price, lang) })}
          </T>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, '').slice(0, 4));
              setError('');
            }}
            keyboardType="number-pad"
            maxLength={4}
            accessibilityLabel={t('codeLabel')}
            style={{ backgroundColor: c.raised, borderRadius: 16, borderWidth: 2, borderColor: c.line, minHeight: 64, fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: 10, color: c.fg }}
          />
          {error ? <T color={c.danger}>{error}</T> : null}
          <Btn title={t('complete')} icon="checkmark-done" disabled={code.length !== 4} onPress={deliver} />
        </Card>
      ) : null}
      <Chat req={req} side="driver" />
    </View>
  );
}

function Earnings({ done }: { done: Request[] }) {
  const c = useColors();
  const { t, lang, route } = useT();
  const total = done.reduce((s, r) => s + r.price, 0);
  const share = Math.round(total * 0.1);
  return (
    <View style={{ gap: 14 }}>
      <View>
        <T size={13} weight="bold" muted style={{ letterSpacing: lang === 'ar' ? 0 : 0.6 }}>
          {t('cashCollected')}
        </T>
        <T size={40} weight="heavy" style={{ lineHeight: 52 }}>
          {dh(total, lang)}
        </T>
        <T muted>{done.length === 1 ? t('oneTrip') : t('tripsN', { n: done.length })}</T>
      </View>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T weight="heavy">{t('invoice')}</T>
          <Pill>{t('notIssued')}</Pill>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T muted>{t('appShare')}</T>
          <T weight="heavy">{dh(share, lang)}</T>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T muted>{t('youKeep')}</T>
          <T weight="heavy">{dh(total - share, lang)}</T>
        </View>
        <T size={13} muted>
          {t('noWallet')}
        </T>
      </Card>
      {done.map((r) => (
        <Card key={r.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <T weight="heavy" style={{ flex: 1 }}>
              {route(r.from, r.to)}
            </T>
            <T weight="heavy">{dh(r.price, lang)}</T>
          </View>
          <T size={13} muted>
            {r.load}
          </T>
        </Card>
      ))}
      {!done.length ? (
        <Card style={{ alignItems: 'center' }}>
          <Ionicons name="wallet-outline" size={28} color={c.muted} />
          <T muted>{t('noEarnings')}</T>
        </Card>
      ) : null}
    </View>
  );
}

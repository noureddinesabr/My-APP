import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Linking, Pressable, TextInput, View } from 'react-native';

import { dh, LoadDrawing, Steps, VehiclePicker, VehicleRow } from './shared';
import { Chat } from './extras';
import { play } from './sounds';
import { addOffer, setStage, update, useStore, type Request } from './store';
import { Btn, Card, LiveDot, Pill, T, tap, useColors, VoicePlayer } from './ui';
import { vehicleById } from './vehicles';

const ago = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export function DriverSide() {
  const store = useStore();
  const me = store.driver;
  const [tab, setTab] = useState<'loads' | 'earn'>('loads');
  const [editing, setEditing] = useState(false);
  const mine = (r: Request) => !r.driverIsExample && !!me.name && r.driverName === me.name;
  const job = store.requests.find((r) => mine(r) && (r.stage === 'accepted' || r.stage === 'arrived' || r.stage === 'loaded'));

  if (!me.name.trim() || editing) return <Profile onDone={() => setEditing(false)} />;
  if (job) return <Job req={job} />;
  return (
    <View style={{ gap: 14 }}>
      <Tabs tab={tab} setTab={setTab} />
      {tab === 'earn' ? (
        <Earnings done={store.requests.filter((r) => mine(r) && r.stage === 'delivered')} />
      ) : (
        <Loads onEdit={() => setEditing(true)} />
      )}
    </View>
  );
}

function Tabs({ tab, setTab }: { tab: 'loads' | 'earn'; setTab: (t: 'loads' | 'earn') => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {(
        [
          ['loads', 'Loads near you'],
          ['earn', 'Earnings'],
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
  const store = useStore();
  const [name, setName] = useState(store.driver.name);
  const [vehicle, setVehicle] = useState(store.driver.vehicle);
  const [picker, setPicker] = useState(false);
  return (
    <View style={{ gap: 14 }}>
      <T size={28} weight="heavy">
        Driver profile
      </T>
      <T muted>Customers see your name and vehicle with your offers.</T>
      <Card>
        <T weight="bold">Your name</T>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Youssef A."
          placeholderTextColor={c.muted}
          accessibilityLabel="Your name"
          style={{ backgroundColor: c.raised, borderRadius: 14, padding: 14, fontSize: 16, color: c.fg }}
        />
        <T weight="bold">Your vehicle</T>
        <VehicleRow id={vehicle} onChange={() => setPicker(true)} />
      </Card>
      <Btn
        title="Save and see loads"
        disabled={!name.trim()}
        onPress={() => {
          update((s) => ({ ...s, driver: { name: name.trim(), vehicle } }));
          onDone();
        }}
      />
      <VehiclePicker visible={picker} value={vehicle} weightKg={0} onClose={() => setPicker(false)} onPick={(id) => { setVehicle(id); setPicker(false); }} />
    </View>
  );
}

function Loads({ onEdit }: { onEdit: () => void }) {
  const c = useColors();
  const store = useStore();
  const day = Date.now() - 36 * 3600 * 1000;
  const open = store.requests.filter((r) => r.stage === 'open' && r.createdAt > day);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.liveSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexShrink: 1 }}>
          <LiveDot />
          <T size={13} weight="bold" color={c.live}>
            Online · {store.driver.name} · {vehicleById(store.driver.vehicle).name}
          </T>
        </View>
        <Pressable accessibilityRole="button" onPress={onEdit} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: c.line, justifyContent: 'center' }}>
          <T size={14} weight="bold">
            Edit
          </T>
        </Pressable>
      </View>
      {open.map((r) => (
        <LoadCard key={r.id} req={r} />
      ))}
      {!open.length ? (
        <Card style={{ alignItems: 'center' }}>
          <T weight="bold">No open loads right now</T>
          <T muted size={14} style={{ textAlign: 'center' }}>
            New requests appear here the moment a customer sends one. To test, switch to Customer at the top and send a request.
          </T>
        </Card>
      ) : null}
    </View>
  );
}

function LoadCard({ req }: { req: Request }) {
  const c = useColors();
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
          {req.from} → {req.to}
        </T>
        {req.voiceUri ? <VoicePlayer uri={req.voiceUri} ms={req.voiceMs} label="Customer's voice note" /> : null}
        {req.said ? (
          <View style={{ backgroundColor: c.raised, borderRadius: 14, padding: 12 }}>
            <T size={15}>“{req.said}”</T>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Pill>{req.load + (req.weightKg ? ` · ≈ ${req.weightKg} kg` : '')}</Pill>
          <Pill>{req.when}</Pill>
          {req.km ? <Pill>{`≈ ${req.km} km`}</Pill> : null}
          {req.helpers ? <Pill tone="warn">{`${req.helpers} ${req.helpers === 1 ? 'helper' : 'helpers'} needed`}</Pill> : null}
          {req.rideAlong ? <Pill>Customer rides along</Pill> : null}
        </View>
        <VehicleRow id={req.vehicle} note="Vehicle the customer asked for" />
        {req.notes ? (
          <T size={14} muted>
            {req.notes}
          </T>
        ) : null}
        <T size={13} muted>
          Posted {ago(req.createdAt)} · you keep {dh(Math.round(req.price * 0.9))} after the 10% app share
        </T>
        {myOffer ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <LiveDot />
            <T weight="bold" color={c.live} style={{ flex: 1 }}>
              Your offer {dh(myOffer.price)} is sent. Waiting for the customer.
            </T>
          </View>
        ) : null}
        <Btn title={`Accept · ${dh(req.price)}`} onPress={() => offer(req.price)} />
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
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const going = req.stage === 'loaded' ? req.to : req.from;
  const deliver = () => {
    if (code.trim() !== req.code) {
      setError('That code does not match. Ask the customer to read it again.');
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
          {req.stage === 'loaded' ? 'Going to drop-off' : 'Going to pickup'}
        </T>
      </View>
      <T size={28} weight="heavy">
        {going}
      </T>
      <Card>
        {req.photoUri ? <Image source={{ uri: req.photoUri }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16 }} resizeMode="cover" /> : null}
        {req.voiceUri ? <VoicePlayer uri={req.voiceUri} ms={req.voiceMs} label="Customer's voice note" /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Pill>{req.load}</Pill>
          <Pill>{req.when}</Pill>
          <Pill tone="ok">{`${dh(req.price)} cash`}</Pill>
          {req.helpers ? <Pill tone="warn">{`${req.helpers} ${req.helpers === 1 ? 'helper' : 'helpers'}`}</Pill> : null}
          {req.rideAlong ? <Pill>Customer rides along</Pill> : null}
        </View>
        {req.notes ? (
          <T size={14} muted>
            {req.notes}
          </T>
        ) : null}
        <Steps stage={req.stage} />
        <Btn
          title="Open directions in Google Maps"
          kind="ghost"
          icon="navigate"
          small
          onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(going)}`).catch(() => {})}
        />
      </Card>
      {req.stage === 'accepted' ? <Btn title="I arrived at the pickup" icon="location" onPress={() => setStage(req.id, 'arrived')} /> : null}
      {req.stage === 'arrived' ? <Btn title="Loaded, start the trip" icon="cube" onPress={() => setStage(req.id, 'loaded')} /> : null}
      {req.stage === 'loaded' ? (
        <Card>
          <T weight="heavy">Finish the delivery</T>
          <T size={14} muted>
            Ask the customer for their 4-digit code, then collect {dh(req.price)} in cash.
          </T>
          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(t.replace(/\D/g, '').slice(0, 4));
              setError('');
            }}
            keyboardType="number-pad"
            maxLength={4}
            accessibilityLabel="Customer's delivery code"
            style={{ backgroundColor: c.raised, borderRadius: 16, borderWidth: 2, borderColor: c.line, minHeight: 64, fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: 10, color: c.fg }}
          />
          {error ? <T color={c.danger}>{error}</T> : null}
          <Btn title="Complete delivery" icon="checkmark-done" disabled={code.length !== 4} onPress={deliver} />
        </Card>
      ) : null}
      <Chat req={req} side="driver" />
    </View>
  );
}

function Earnings({ done }: { done: Request[] }) {
  const c = useColors();
  const total = done.reduce((s, r) => s + r.price, 0);
  const share = Math.round(total * 0.1);
  return (
    <View style={{ gap: 14 }}>
      <View>
        <T size={13} weight="bold" muted style={{ letterSpacing: 0.6 }}>
          CASH YOU COLLECTED IN THIS TEST
        </T>
        <T size={42} weight="heavy" style={{ letterSpacing: -1, lineHeight: 50 }}>
          {dh(total)}
        </T>
        <T muted>
          {done.length} {done.length === 1 ? 'trip' : 'trips'}
        </T>
      </View>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T weight="heavy">Monday&apos;s invoice</T>
          <Pill>Not issued yet</Pill>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T muted>App share (10%)</T>
          <T weight="heavy">{dh(share)}</T>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T muted>You keep</T>
          <T weight="heavy">{dh(total - share)}</T>
        </View>
        <T size={13} muted>
          No wallet and nothing to prepay. The app share is paid once a week.
        </T>
      </Card>
      {done.map((r) => (
        <Card key={r.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <T weight="heavy" style={{ flex: 1 }}>
              {r.from} → {r.to}
            </T>
            <T weight="heavy">{dh(r.price)}</T>
          </View>
          <T size={13} muted>
            {r.load}
          </T>
        </Card>
      ))}
      {!done.length ? (
        <Card style={{ alignItems: 'center' }}>
          <Ionicons name="wallet-outline" size={28} color={c.muted} />
          <T muted>Delivered trips appear here.</T>
        </Card>
      ) : null}
    </View>
  );
}

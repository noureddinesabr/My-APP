import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Pressable, ScrollView, View } from 'react-native';

import { TextInput } from './field';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBack } from './back';
import { setChatOnScreen, setLayer } from './where';
import { capture } from './flow';
import { openTab, openTrip, repeatRequest, type TabId } from './home';
import { Sheet, TripPhotos } from './trip';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { PriceAskButton, PriceAskCard, PriceAskSheet } from './priceask';
import { useT, type Key } from './i18n';
import { CallButton } from './call';
import { SupportChat } from './help';
import { WorkCard } from './work';
import { Earnings } from './driver';
import { autoDir, BitBubble, Composer, fieldDir } from './composer';
import { driverRating, PersonSheet, Stars, type Person } from './people';
import { KeyboardScroll, useKeyboardInset } from './keyboard';
import { dh, Initials, loadOf, PhotoStrip, VehiclePicker, VehicleRow, vName } from './shared';
import { play } from './sounds';
import { tripDay } from './engine';
import { ClosedRequests } from './ruleui';
import { TeamCard } from './company';
import { addOffer, canAskPrice, partyNow, floorUnknown, isLive, markSeen, messagesFor, messageText, sendMessage, unread, update, useStore, type Offer, type PaperId, type Request, type Role } from './store';
import { Tech } from './stitch';
import { fade, PERSON_COLORS, SIGNAL, STAGE_COLORS } from './theme';
import { Backdrop, Btn, Card, FadeIn, LiveDot, Pill, T, Tag, tap, useColors, Glow } from './ui';
import { PIN } from './map/pins';
import { PickMap } from './map/PickMap';
import { DEFAULT_CENTER, useMyLocation } from './map/trip';
import { committedDriver } from './busy';
import { CommittedBadge } from './people';
import { formatWhen } from './wheels';

/** A request older than this that never got a driver counts as "not continued". */
const LIVE = ['open', 'accepted', 'enroute', 'arrived', 'loaded', 'dropoff'];
const shortPlace = (p: string) => p.split(/[,،]/)[0].trim();

// ---------- Which conversations and offers each side has ----------

/** Customer: trips with a driver. Driver: jobs this driver won (the example drivers are the customer's test). */
export function threadsFor(role: Role, requests: Request[], me: string): Request[] {
  // Owner's report #16: a driver can ask about an open load before taking it; that conversation
  // shows on both sides too.
  const asked = (r: Request) => r.stage === 'open' && (r.messages ?? []).some((m) => m.from === 'driver');
  const list = role === 'customer' ? requests.filter((r) => (!!r.driverName && r.stage !== 'open') || asked(r)) : requests.filter((r) => (!!me && r.driverName === me && !r.driverIsExample) || (!!me && asked(r)));
  const last = (r: Request) => r.messages?.[r.messages.length - 1]?.at ?? r.acceptedAt ?? r.createdAt;
  return [...list].sort((a, b) => last(b) - last(a));
}

/** Handed over by the driver but not yet confirmed "received" by the customer (round 7): still current. */
export const awaitsReceipt = (r: Request) => r.stage === 'delivered' && !r.receivedAt && !r.rating && Date.now() - (r.deliveredAt ?? 0) < 3 * 24 * 3600 * 1000;
// Rule 4: an open request stays current until the rules close it (no other time limit).
const isCurrentRequest = (r: Request) => LIVE.includes(r.stage) || awaitsReceipt(r);

// ---------- The bottom bar ----------

// Xapp Freight (Stitch): Scan IA · Carte · Courses · Compte for customers; Missions · Carte · Courses ·
// Revenus · Compte for drivers. Messages open from the chat button in the top bar.
const TABS: { id: TabId; icon: keyof typeof Ionicons.glyphMap; on: keyof typeof Ionicons.glyphMap; label: Key }[] = [
  { id: 'map', icon: 'map-outline', on: 'map', label: 'tabMap' },
  { id: 'offers', icon: 'cube-outline', on: 'cube', label: 'tabRides' },
  { id: 'earnings', icon: 'wallet-outline', on: 'wallet', label: 'tabEarnings' },
  { id: 'profile', icon: 'person-outline', on: 'person', label: 'tabAccount' },
];

/** A tab's name for this side. */
export const tabLabel = (id: TabId, role: Role, fallback: Key): Key => (id === 'offers' ? (role === 'driver' ? 'tabMyTrips' : 'tabMyRequests') : id === 'messages' && role === 'driver' ? 'tabChat' : fallback);

/** Height of the floating bottom bar plus its margin above the phone's own bottom edge. */
export const BAR_H = 78;

/** Unread messages for this side (the chat button in the top bar). */
export function useUnread(role: Role) {
  const store = useStore();
  return threadsFor(role, store.requests, store.driver.name).reduce((n, r) => n + unread(r, role), 0) + supportUnread(store);
}

/**
 * The bottom bar (Stitch): a floating deep-moss pill; the open tab is a lime pill with its icon and
 * word, the others an icon over a small word. Home is Scan IA (the camera) for customers and
 * Missions for drivers, and closes any open tab.
 */
export function TabBar({ tab, onTab, onHome, role }: { tab: TabId | null; onTab: (t: TabId) => void; onHome: () => void; role: Role }) {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const insets = useSafeAreaInsets();
  const current = role === 'customer' ? store.requests.filter(isCurrentRequest).length : store.offers.filter((o) => o.id.endsWith('_me') && store.requests.some((r) => r.id === o.requestId && r.stage === 'open')).length;
  const badge = (id: TabId) => (id === 'offers' ? current : 0);
  const item = (key: string, label: string, icon: keyof typeof Ionicons.glyphMap, on: boolean, n: number, press: () => void) => (
    <Pressable
      key={key}
      testID={`tab-${key}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={n ? `${label} (${n})` : label}
      onPress={() => {
        tap();
        play('tick');
        press();
      }}
      style={({ pressed }) => ({ flex: 1, minHeight: 52, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <View style={{ alignItems: 'center', gap: 2, borderRadius: 18, paddingHorizontal: 6, paddingVertical: 4, maxWidth: '100%', overflow: 'hidden' }}>
        {on ? <LinearGradient pointerEvents="none" colors={[c.accent, c.accent2, c.accent3]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
        <Ionicons name={icon} size={20} color={on ? c.onAccent : c.muted} />
        {n ? (
          <View style={{ position: 'absolute', top: -2, end: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.warn, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.surface }}>
            <T size={10} weight="heavy" color={c.onInverse} style={{ lineHeight: 12 }}>
              {String(Math.min(9, n))}
            </T>
          </View>
        ) : null}
        <T size={11} weight={on ? 'heavy' : 'semibold'} color={on ? c.onAccent : c.muted} style={{ lineHeight: 14, textAlign: 'center' }}>
          {label}
        </T>
      </View>
    </Pressable>
  );
  const home = role === 'customer' ? { label: t('tabScan'), icon: 'scan-outline' as const } : { label: t('tabMissions'), icon: 'flash-outline' as const };
  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: insets.bottom + 10,
        height: BAR_H - 14,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        borderRadius: 32,
        backgroundColor: fade(c.surface, 0.94),
        borderWidth: 1,
        borderColor: c.glassEdge,
        shadowColor: c.shadow,
        shadowOpacity: 0.16,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      }}>
      {item('home', home.label, home.icon, tab === null, 0, onHome)}
      {TABS.filter((x) => x.id !== 'earnings' || role === 'driver').map((x) => {
        const on = tab === x.id;
        return item(x.id, t(x.id === 'offers' ? 'tabRides' : x.label), on ? x.on : x.icon, on, badge(x.id), () => onTab(x.id));
      })}
    </View>
  );
}

// ---------- The page under the top bar ----------

/** A tab's page covers the screen under the top buttons; back or the X logo closes it (the request in progress is kept). */
export function TabPage({ tab, role, chat, setChat, onClose }: { tab: TabId; role: Role; chat: string | null; setChat: (id: string | null) => void; onClose: () => void }) {
  const c = useColors();
  useBack(true, onClose);
  useEffect(() => {
    setLayer(`tab:${tab}${tab === 'messages' && chat ? ' › chat' : ''}`);
    return () => setLayer('');
  }, [tab, chat]);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Backdrop />
      {/* Simple design: each page rises in softly when it opens (a new key per page and chat). */}
      <FadeIn key={`${tab}:${chat ?? ''}`} style={{ flex: 1 }}>
        {tab === 'messages' ? chat ? <ChatThread reqId={chat} role={role} onBack={() => setChat(null)} /> : <Messages role={role} onOpen={setChat} /> : null}
        {tab === 'offers' ? <OffersPage role={role} onClose={onClose} /> : null}
        {tab === 'profile' ? role === 'customer' ? <CustomerProfile /> : <DriverProfile /> : null}
        {tab === 'earnings' ? <EarningsPage /> : null}
        {tab === 'map' ? <MapPage role={role} onClose={onClose} /> : null}
      </FadeIn>
    </View>
  );
}

/**
 * Carte with no trip in progress (Stitch "live map"): the map around you, a "GPS LIVE" chip, and one
 * card: customers start with a scan, drivers see how many loads are waiting near them.
 */
function MapPage({ role, onClose }: { role: Role; onClose: () => void }) {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const me = useMyLocation();
  const [start] = useState(() => me ?? DEFAULT_CENTER);
  const waiting = store.requests.filter((r) => r.stage === 'open').length;
  return (
    <View style={{ flex: 1, padding: 12, paddingBottom: 12, gap: 12 }}>
      <View style={{ flex: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: c.mapBg, borderWidth: 1, borderColor: c.line }}>
        <PickMap start={start} target={me ? { point: me, seq: 1 } : null} me={me} onMove={() => {}} />
        <View pointerEvents="none" style={{ position: 'absolute', top: 12, start: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.inverse, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
          <LiveDot />
          <Tech color={c.onInverse}>{t('gpsLive')}</Tech>
        </View>
      </View>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.liveSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={role === 'customer' ? 'navigate-outline' : 'flash-outline'} size={22} color={c.live} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T size={17} weight="heavy">
              {role === 'customer' ? t('mapNoTrip') : t('mapLoadsNear', { n: waiting })}
            </T>
            <T size={13} muted>
              {role === 'customer' ? t('mapNoTripSub') : t('mapLoadsNearSub')}
            </T>
          </View>
        </View>
        <Btn title={role === 'customer' ? t('tabScan') : t('tabMissions')} icon={role === 'customer' ? 'scan-outline' : 'flash-outline'} onPress={onClose} />
      </Card>
    </View>
  );
}

/** The driver's earnings, as its own top tab (round 8). */
function EarningsPage() {
  const store = useStore();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const me = store.driver;
  const done = store.requests.filter((r) => !r.driverIsExample && !!me.name && r.driverName === me.name && r.stage === 'delivered');
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}>
      <PageTitle tag={t('tagEarnings')} title={t('tabEarnings')} sub={t('earningsSub')} />
      <Earnings done={done} />
    </ScrollView>
  );
}

function PageTitle({ title, sub, tag }: { title: string; sub?: string; tag?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Tag>{tag ?? 'Xapp'}</Tag>
      <T size={24} weight="heavy">
        {title}
      </T>
      {sub ? (
        <T size={13} muted>
          {sub}
        </T>
      ) : null}
    </View>
  );
}

function Empty({ icon, title, sub }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }) {
  const c = useColors();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={30} color={c.muted} />
      </View>
      <T weight="heavy" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T size={14} muted style={{ textAlign: 'center' }}>
        {sub}
      </T>
    </Card>
  );
}

const clock = (at: number) => {
  const d = new Date(at);
  const today = new Date();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === today.toDateString()) return time;
  return `${d.getDate()}/${d.getMonth() + 1} ${time}`;
};

// ---------- Messages: one box per conversation ----------

/** A person's colour (the same name always gets the same one), so each conversation stands out. */

const personColor = (name: string) => PERSON_COLORS[[...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % PERSON_COLORS.length];
/** The trip's step in a short coloured pill. */
const STAGE_PILL: Partial<Record<Request['stage'], { key: Key; color: string }>> = {
  accepted: { key: 'stepAccepted', color: SIGNAL.loadAccent },
  enroute: { key: 'stepEnroute', color: STAGE_COLORS.enroute },
  arrived: { key: 'stepArrived', color: STAGE_COLORS.arrived },
  loaded: { key: 'stepLoaded', color: SIGNAL.committed },
  dropoff: { key: 'stepLoaded', color: SIGNAL.committed },
  delivered: { key: 'stepDelivered', color: STAGE_COLORS.delivered },
  cancelled: { key: 'grpCancelledShort', color: STAGE_COLORS.cancelled },
};

/** Unread answers from Xapp support. */
export const supportUnread = (st: { support?: { from: string; at: number }[]; supportSeenAt?: number }) => (st.support ?? []).filter((m) => m.from === 'xapp' && m.at > (st.supportSeenAt ?? 0)).length;

function Messages({ role, onOpen }: { role: Role; onOpen: (id: string) => void }) {
  const c = useColors();
  const { t, lang, route } = useT();
  const store = useStore();
  const insets = useSafeAreaInsets();
  const threads = threadsFor(role, store.requests, store.driver.name);
  const [support, setSupport] = useState(false);
  const sup = store.support ?? [];
  const supLast = sup[sup.length - 1];
  const supN = supportUnread(store);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}>
      <PageTitle tag={t('tagMessages')} title={t('tabMessages')} sub={role === 'customer' ? t('msgSubCustomer') : t('msgSubDriver')} />
      {/* The conversation with Xapp support stays here, to follow its answers (#65). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('xappSupport')}${supN ? `, ${t('unreadN', { n: supN })}` : ''}`}
        onPress={() => {
          tap();
          setSupport(true);
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.accent, borderRadius: 20, padding: 12, opacity: pressed ? 0.88 : 1 })}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: fade(c.onInverse, 0.22), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="help-buoy" size={24} color={c.onAccent} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <T weight="heavy" color={c.onAccent}>
            {t('xappSupport')}
          </T>
          <T size={13} color={c.onAccent} style={{ opacity: 0.92 }}>
            {supLast ? `${supLast.from === 'me' ? `${t('you')}: ` : ''}${supLast.kind === 'voice' ? `🎤 ${t('voiceNote')}` : supLast.kind === 'photo' ? `📷 ${t('photoShort')}` : supLast.kind === 'file' ? `📎 ${supLast.name ?? ''}` : (supLast.text ?? '')}` : t('supportRowSub')}
          </T>
        </View>
        {supN ? (
          <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.onInverse, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
            <T size={12} weight="heavy" color={c.accent} style={{ lineHeight: 15 }}>
              {String(supN)}
            </T>
          </View>
        ) : (
          <Ionicons name={lang === 'ar' ? 'chevron-back' : 'chevron-forward'} size={20} color={c.onAccent} />
        )}
      </Pressable>
      <SupportChat visible={support} onClose={() => setSupport(false)} />
      {threads.map((r) => {
        const other = role === 'customer' ? r.driverName || store.driver.name || t('driverLabel') : store.customer.name || t('customer');
        const seen = messagesFor(r, role);
        const last = seen[seen.length - 1];
        const n = unread(r, role);
        const tint = personColor(other || r.id);
        const pill = STAGE_PILL[r.stage];
        return (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityLabel={`${other}, ${route(shortPlace(r.from), shortPlace(r.to))}${n ? `, ${t('unreadN', { n })}` : ''}`}
            onPress={() => {
              tap();
              onOpen(r.id);
            }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: 20, borderWidth: n ? 1.5 : 1, borderColor: n ? c.accent : c.line, borderStartWidth: 5, borderStartColor: tint, padding: 12, opacity: pressed ? 0.85 : 1 })}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
              <T size={18} weight="heavy" color={c.onInverse}>
                {(other.trim()[0] ?? '?').toUpperCase()}
              </T>
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T weight="heavy" style={{ flex: 1 }}>
                  {other}
                </T>
                {last ? (
                  <T size={12} muted style={{ writingDirection: 'ltr' }}>
                    {clock(last.at)}
                  </T>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {pill ? (
                  <View style={{ backgroundColor: pill.color, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
                    <T size={11} weight="bold" color={c.onInverse}>
                      {t(pill.key)}
                    </T>
                  </View>
                ) : null}
                <T size={12} weight="semibold" color={tint} style={{ flex: 1 }}>
                  {route(shortPlace(r.from), shortPlace(r.to))}
                </T>
              </View>
              <T size={14} weight={n ? 'bold' : 'regular'} color={n ? c.fg : c.muted}>
                {last ? `${last.from === role ? `${t('you')}: ` : ''}${last.kind === 'voice' ? `🎤 ${t('voiceNote')}` : last.kind === 'photo' ? `📷 ${t('photoShort')}` : last.kind === 'file' ? `📎 ${last.name ?? ''}` : messageText(last, lang)}` : t('chatStart')}
              </T>
            </View>
            {n ? (
              <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                <T size={12} weight="heavy" color={c.onAccent} style={{ lineHeight: 15 }}>
                  {String(n)}
                </T>
              </View>
            ) : null}
          </Pressable>
        );
      })}
      {!threads.length ? <Empty icon="chatbubbles-outline" title={t('msgEmpty')} sub={role === 'customer' ? t('msgEmptyCustomer') : t('msgEmptyDriver')} /> : null}
    </ScrollView>
  );
}

/**
 * Ready-made replies that fit who is writing and where the trip is (round 9, #83 / #64): nothing a
 * customer wouldn't say (no "I'm at the door"), and none once the trip is over or cancelled, when
 * the conversation is about what happened.
 */
const quickFor = (role: Role, stage: Request['stage']): Key[] => {
  if (role === 'customer') {
    if (stage === 'accepted') return ['q_cReady', 'q_cWhen', 'q_cCallArrive'];
    if (stage === 'enroute') return ['q_cReady', 'q_cHowLong', 'q_cCallArrive'];
    if (stage === 'arrived') return ['q_cComing', 'q_cTwoMin', 'q_cCallMe'];
    if (stage === 'loaded') return ['q_cCareful', 'q_cTellArrive'];
    if (stage === 'dropoff') return ['q_cComing', 'q_cTwoMin', 'q_cCallMe'];
    return [];
  }
  if (stage === 'accepted') return ['q_dOnTime', 'q_dReady'];
  if (stage === 'enroute') return ['q_dOnWay', 'q_dLate', 'q_dReady'];
  if (stage === 'arrived') return ['q_dOutside', 'q_dComeDown', 'q_dFloor'];
  if (stage === 'loaded') return ['q_dLeaving', 'q_dLate'];
  if (stage === 'dropoff') return ['q_dAtDest', 'q_dComeReceive'];
  return [];
};

/** The other side of a trip, as a person (photo, name; for a driver, the vehicle). */
/** Rule 6: a conversation stays open 7 days after its trip ended (delivered or cancelled), then it is kept read-only. */
export const chatClosed = (r: Request) => {
  const end = r.stage === 'delivered' ? (r.receivedAt ?? r.deliveredAt) : r.stage === 'cancelled' ? (r.phaseAt ?? r.createdAt) : undefined;
  return !!end && Date.now() - end > 7 * 24 * 3600 * 1000;
};

function personOf(req: Request, role: Role, store: ReturnType<typeof useStore>, customerWord: string): Person {
  // Rule 8: only the driver can get the customer's own number, only on the trip day (after 2 unanswered in-app calls).
  // The customer never gets the driver's number.
  const day = tripDay(req);
  return role === 'customer'
    ? { role: 'driver', name: req.driverName ?? '', vehicle: req.driverVehicle, example: req.driverIsExample, photo: req.driverName === store.driver.name ? store.driver.photoUri : undefined }
    : { role: 'customer', name: store.customer.name || customerWord, photo: store.customer.photoUri, city: store.customer.city || undefined, phone: day ? customerPhone(req, store) : undefined };
}

/** The number of the person the driver deals with now (the pickup person, then the receiver), or the customer's. */
export function customerPhone(req: Request, store: { customer: { phone: string } }) {
  const now = partyNow(req);
  const cp = req.companion;
  return now?.who === 'other' && now.phone ? now.phone : !req.parties && cp?.who === 'other' && cp.phone ? cp.phone : store.customer.phone || undefined;
}

/** One conversation: the messages, quick replies, and a box that always sits right above the keyboard. */
/** The trip's step in words (chat header). */
const STEP_KEY: Record<string, Key> = { accepted: 'stepAccepted', enroute: 'stepEnroute', arrived: 'stepArrived', loaded: 'stepLoaded', dropoff: 'stepLoaded', delivered: 'stepDelivered' };

export function ChatThread({ reqId, role, onBack }: { reqId: string; role: Role; onBack: () => void }) {
  const c = useColors();
  const { t, lang, route, rtl } = useT();
  const store = useStore();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const req = store.requests.find((r) => r.id === reqId);
  const [text, setText] = useState('');
  const [profile, setProfile] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const list = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);
  useBack(true, onBack);
  const count = req?.messages?.length ?? 0;
  useEffect(() => {
    markSeen(reqId, role);
  }, [reqId, role, count]);
  useEffect(() => {
    setChatOnScreen(reqId);
    return () => setChatOnScreen('');
  }, [reqId]);
  useEffect(() => {
    const id = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [count, keyboard]);
  if (!req) return null;
  const other = role === 'customer' ? req.driverName || store.driver.name || t('driverLabel') : store.customer.name || t('customer');
  const person = personOf(req, role, store, t('customer'));
  const send = (m: string) => {
    if (!m.trim()) return;
    play('send');
    sendMessage(req.id, role, m);
    setText('');
  };
  const live = LIVE.includes(req.stage) && req.stage !== 'open';
  return (
    <View style={{ flex: 1, paddingBottom: keyboard ? keyboard + 8 : insets.bottom + 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('back')} onPress={onBack} hitSlop={6} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.raised }}>
          <Ionicons name={rtl ? 'arrow-forward' : 'arrow-back'} size={20} color={c.fg} />
        </Pressable>
        {/* Their photo and name open their profile. */}
        <Pressable accessibilityRole="button" accessibilityLabel={`${other}. ${t('seeProfile')}`} onPress={() => { tap(); setProfile(true); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Initials name={other} />
          <View style={{ flex: 1 }}>
            {live ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.live }} />
                <Tech color={c.live}>{t('liveMission')}</Tech>
              </View>
            ) : null}
            <T weight="heavy">
              {other}
            </T>
            <T size={12} muted>
              {[route(shortPlace(req.from), shortPlace(req.to)), req.driverVehicle && role === 'customer' ? vName(t, req.driverVehicle) : ''].filter(Boolean).join(' · ')}
            </T>
          </View>
        </Pressable>
        {req.driverName ? <CallButton person={person} size={40} /> : null}
        {live ? (
          <Pressable hitSlop={7}
            accessibilityRole="button"
            onPress={() => {
              tap();
              if (role === 'customer') update((s) => ({ ...s, activeRequestId: req.id }));
              openTrip();
            }}
            style={{ paddingHorizontal: 12, minHeight: 34, borderRadius: 999, backgroundColor: c.liveSoft, justifyContent: 'center' }}>
            <T size={13} weight="bold" color={c.live}>
              {t('seeTrip')}
            </T>
          </Pressable>
        ) : null}
      </View>
      {/* Stitch chat: during a live trip, the trip's step beside the mission card (price and route). */}
      {live ? (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10 }}>
          <Glow tone="sky" style={{ flex: 1, borderRadius: 18, padding: 10, gap: 2 }}>
            <Tech color={c.onSky}>{t('tripStep')}</Tech>
            <T size={14} weight="heavy" color={c.onSky}>
              {t(STEP_KEY[req.stage] ?? 'stepAccepted')}
            </T>
          </Glow>
          <Glow tone="dark" style={{ flex: 1, borderRadius: 18, padding: 10, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              <Tech color={c.onInverseMuted}>{t('agreedPrice')}</Tech>
            </View>
            <T size={18} weight="heavy" color={c.inverseAccent}>
              {dh(req.price, lang)}
            </T>
            <T size={11} color={c.onInverseMuted}>
              {route(shortPlace(req.from), shortPlace(req.to))}
            </T>
          </Glow>
        </View>
      ) : null}
      <ScrollView
        ref={(r) => {
          list.current = r;
        }}
        style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 8, flexGrow: 1, justifyContent: 'flex-end' }} keyboardShouldPersistTaps="handled">
        {req.driverIsExample ? (
          <View style={{ alignSelf: 'center', backgroundColor: c.warnSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 6 }}>
            <T size={12} color={c.warn}>
              {t('exampleChat')}
            </T>
          </View>
        ) : null}
        {messagesFor(req, role).map((m) =>
          m.from === 'app' ? (
            // A line from the app (booking, reminder, cancellation): centred, for both sides.
            <View key={m.id} style={{ alignSelf: 'center', maxWidth: '90%', backgroundColor: c.raised, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, gap: 2 }}>
              <T size={13} style={{ textAlign: 'center' }}>
                {messageText(m, lang)}
              </T>
              <T size={10} muted style={{ textAlign: 'center', writingDirection: 'ltr' }}>
                {clock(m.at)}
              </T>
            </View>
          ) : (
            <BitBubble key={m.id} bit={{ id: m.id, kind: m.kind ?? 'text', text: messageText(m, lang), uri: m.uri, ms: m.ms, name: m.name, at: m.at, auto: m.auto }} mine={m.from === role} side={m.from === role ? 'right' : 'left'} />
          ),
        )}
        {!count ? (
          <T size={14} muted style={{ textAlign: 'center', paddingVertical: 12 }}>
            {t('chatEmpty')}
          </T>
        ) : null}
        {/* Round 10: a new price being talked over, answered right here. */}
        <PriceAskCard req={req} role={role} />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }} keyboardShouldPersistTaps="handled">
        {role === 'driver' && canAskPrice(req) && !req.priceAsk && req.takenAt ? (
          <Pressable hitSlop={6} accessibilityRole="button" onPress={() => { tap(); setAskOpen(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: c.warn, backgroundColor: c.warnSoft, borderRadius: 999, paddingHorizontal: 12, minHeight: 36 }}>
            <Ionicons name="pricetag-outline" size={15} color={c.warn} />
            <T size={13} weight="bold">
              {t('pa_btn')}
            </T>
          </Pressable>
        ) : null}
        {[...(role === 'driver' && ['accepted', 'enroute'].includes(req.stage) && req.floors && (floorUnknown(req.floors.pickup) || floorUnknown(req.floors.dropoff)) ? (['q_dFloorAsk'] as Key[]) : []), ...quickFor(role, req.stage)].map((k) => (
          <Pressable hitSlop={6} key={k} accessibilityRole="button" onPress={() => send(t(k))} style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 999, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' }}>
            <T size={13} weight="semibold">
              {t(k)}
            </T>
          </Pressable>
        ))}
      </ScrollView>
      {/* Chat rules (round 8): a conversation stays open during the trip and 48 hours after it ends,
          then closes; working together again goes through a new request, inside the app. */}
      {/* A cancelled trip (#68): the messages stay to read, writing stops; working together again
          goes through a new request (the customer can repeat it from the history). */}
      {chatClosed(req) || req.stage === 'cancelled' ? (
        <View style={{ marginHorizontal: 12, flexDirection: 'row', gap: 8, backgroundColor: c.raised, borderRadius: 14, padding: 12 }}>
          <Ionicons name="lock-closed-outline" size={16} color={c.muted} />
          <T size={13} muted style={{ flex: 1 }}>
            {req.stage === 'cancelled' ? (role === 'customer' ? t('chatCancelledCustomer') : t('chatCancelledDriver')) : t('chatClosed')}
          </T>
        </View>
      ) : (
      <View style={{ paddingHorizontal: 12 }}>
        <Composer
          hint={t('chatHint')}
          camera
          onSend={(bit) => {
            if (bit.kind === 'text') sendMessage(req.id, role, bit.text ?? '');
            else if (bit.uri) sendMessage(req.id, role, '', { kind: bit.kind, uri: bit.uri, ms: bit.ms, name: bit.name });
          }}
        />
      </View>
      )}
      <PersonSheet person={profile ? person : null} onClose={() => setProfile(false)} />
      {role === 'driver' ? <PriceAskSheet req={req} visible={askOpen} onClose={() => setAskOpen(false)} /> : null}
    </View>
  );
}

// ---------- Offers: what is going on now, and what happened before ----------

function Segments({ value, onChange, items }: { value: 'now' | 'past'; onChange: (v: 'now' | 'past') => void; items: [string, string] }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.raised, borderRadius: 14, padding: 4, gap: 4 }}>
      {(['now', 'past'] as const).map((v, i) => (
        <Pressable hitSlop={4}
          key={v}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === v }}
          onPress={() => {
            tap();
            onChange(v);
          }}
          style={{ flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: value === v ? c.surface : 'transparent' }}>
          <T size={14} weight="bold" color={value === v ? c.fg : c.muted}>
            {items[i]}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

type Status = { label: string; tone: 'live' | 'ok' | 'warn' | 'bad' | undefined; icon: keyof typeof Ionicons.glyphMap };

function OffersPage({ role, onClose }: { role: Role; onClose: () => void }) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [seg, setSeg] = useState<'now' | 'past'>('now');
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}>
      <PageTitle tag={t('tagWaybills')} title={t(role === 'customer' ? 'tabMyRequests' : 'tabMyTrips')} sub={role === 'customer' ? t('offersSubCustomer') : t('offersSubDriver')} />
      <Segments value={seg} onChange={setSeg} items={[t('segNow'), t('segPast')]} />
      {role === 'customer' ? <CustomerOffers seg={seg} onClose={onClose} /> : <DriverOffers seg={seg} onClose={onClose} />}
    </ScrollView>
  );
}

function CustomerOffers({ seg, onClose }: { seg: 'now' | 'past'; onClose: () => void }) {
  const { t, lang } = useT();
  const store = useStore();
  const now = store.requests.filter(isCurrentRequest);
  const past = store.requests.filter((r) => !isCurrentRequest(r));
  const status = (r: Request): Status => {
    const n = store.offers.filter((o) => o.requestId === r.id && o.status !== 'declined').length;
    if (r.stage === 'open' && isCurrentRequest(r)) return { label: n ? (n === 1 ? t('oneOffer') : t('offersN', { n })) : t('waitingOffers'), tone: 'live', icon: 'radio-outline' };
    // A booking for later reads as upcoming, with its day and time (round 8).
    if (r.stage === 'accepted' && r.when !== 'now') return { label: t('stUpcoming', { when: formatWhen(r.when, lang, t) }), tone: 'live', icon: 'calendar-outline' };
    if (isLive(r.stage)) return { label: t(`st_${r.stage}` as Key), tone: 'live', icon: 'navigate' };
    if (awaitsReceipt(r)) return { label: t('stConfirmReceipt'), tone: 'warn', icon: 'cube-outline' };
    if (r.stage === 'delivered') return { label: t('stFinished'), tone: 'ok', icon: 'checkmark-circle' };
    if (r.stage === 'cancelled' && r.closedQuietly) return { label: t('stClosedNoDriver'), tone: 'warn', icon: 'moon-outline' };
    if (r.stage === 'cancelled') return { label: r.cancelledBy === 'driver' ? t('stCancelledByDriver') : r.cancelledBy === 'customer' ? t('stCancelledByYou') : t('stCancelled'), tone: 'bad', icon: 'close-circle' };
    return { label: t('stNotContinued'), tone: 'warn', icon: 'time-outline' };
  };
  // Round 8: clear groups, in the order that matters to the customer.
  const groups: [Key, Request[]][] =
    seg === 'now'
      ? [
          ['grpConfirm', now.filter(awaitsReceipt)],
          ['grpMoving', now.filter((r) => isLive(r.stage) && (r.stage !== 'accepted' || r.when === 'now'))],
          ['grpUpcoming', now.filter((r) => r.stage === 'accepted' && r.when !== 'now').sort((a, b) => a.when.localeCompare(b.when))],
          ['grpWaiting', now.filter((r) => r.stage === 'open')],
        ]
      : [
          ['grpDelivered', past.filter((r) => r.stage === 'delivered')],
          ['grpCancelled', past.filter((r) => r.stage !== 'delivered')],
        ];
  const card = (r: Request) => (
    <RequestCard
      key={r.id}
      req={r}
      status={status(r)}
      open={
        seg === 'now'
          ? () => {
              update((s) => ({ ...s, activeRequestId: r.id }));
              onClose();
              setTimeout(openTrip, 0);
            }
          : undefined
      }>
      {seg === 'past' ? (
        <Btn
          title={t('repeatRequest')}
          icon="repeat"
          small
          onPress={() => {
            onClose();
            setTimeout(() => repeatRequest(r.id), 0);
          }}
        />
      ) : null}
    </RequestCard>
  );
  const any = groups.some(([, list]) => list.length);
  return (
    <>
      {/* Rule 4: a request that closed by itself, with «Send again» and «Edit». */}
      {seg === 'now' ? <ClosedRequests onOpen={onClose} /> : null}
      {groups.map(([title, list]) =>
        list.length ? (
          <View key={title} style={{ gap: 10 }}>
            <T size={13} weight="heavy" muted style={{ marginTop: 4 }}>
              {`${t(title)} · ${list.length}`}
            </T>
            {list.map(card)}
          </View>
        ) : null,
      )}
      {!any ? <Empty icon={seg === 'now' ? 'pricetags-outline' : 'archive-outline'} title={seg === 'now' ? t('noCurrent') : t('noPast')} sub={seg === 'now' ? t('noCurrentCustomer') : t('noPastSub')} /> : null}
    </>
  );
}

function DriverOffers({ seg, onClose }: { seg: 'now' | 'past'; onClose: () => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const store = useStore();
  const me = store.driver.name;
  const mineOffers = store.offers.filter((o) => o.id.endsWith('_me') && (!me || o.driverName === me));
  const reqOf = (o: Offer) => store.requests.find((r) => r.id === o.requestId);
  const jobs = store.requests.filter((r) => !!me && r.driverName === me && !r.driverIsExample);
  type Row = { req: Request; offer?: Offer; status: Status; now: boolean };
  const rows: Row[] = [];
  for (const r of jobs) {
    const live = isLive(r.stage);
    rows.push({ req: r, status: live ? { label: t(`st_${r.stage}` as Key), tone: 'live', icon: 'navigate' } : r.stage === 'delivered' ? { label: t('stFinished'), tone: 'ok', icon: 'checkmark-circle' } : { label: r.cancelledBy === 'driver' ? t('stCancelledByYou') : t('stCancelledByCustomer'), tone: 'bad', icon: 'close-circle' }, now: live });
  }
  for (const o of mineOffers) {
    const r = reqOf(o);
    if (!r || jobs.includes(r)) continue;
    if (o.status === 'declined') rows.push({ req: r, offer: o, status: { label: t('stDeclined'), tone: undefined, icon: 'close-circle' }, now: false });
    else if (r.stage === 'open' && isCurrentRequest(r)) rows.push({ req: r, offer: o, status: o.status === 'countered' ? { label: t('stCounter', { price: dh(o.counterPrice ?? 0, lang) }), tone: 'warn', icon: 'swap-horizontal' } : { label: t('stWaitingCustomer'), tone: 'live', icon: 'hourglass-outline' }, now: true });
    else rows.push({ req: r, offer: o, status: r.stage === 'cancelled' ? { label: t('stCancelledByCustomer'), tone: 'bad', icon: 'close-circle' } : { label: t('stNotChosen'), tone: undefined, icon: 'remove-circle-outline' }, now: false });
  }
  // Jobs this driver took and then cancelled (the request went back to other drivers).
  for (const r of store.requests) {
    if (!me || rows.some((x) => x.req.id === r.id)) continue;
    const mine = (r.cancelledDrivers ?? []).find((d) => d.name === me);
    if (mine) rows.push({ req: r, status: { label: t('stCancelledByYou'), tone: 'bad', icon: 'close-circle' }, now: false });
  }
  const list = rows.filter((x) => x.now === (seg === 'now'));
  return (
    <>
      {list.map(({ req, offer, status }) => (
        <RequestCard key={req.id} req={req} status={status} price={offer?.price} open={req.driverName === me && LIVE.includes(req.stage) ? () => { onClose(); setTimeout(openTrip, 0); } : undefined}>
          {offer?.status === 'countered' && offer.counterPrice ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Btn
                  title={t('acceptCounter', { price: dh(offer.counterPrice, lang) })}
                  small
                  onPress={() => {
                    play('send');
                    addOffer({ ...offer, price: offer.counterPrice!, status: undefined, counterPrice: undefined, createdAt: Date.now() });
                  }}
                />
              </View>
            </View>
          ) : null}
          {/* Round 10: booked trips can get a new price before loading. */}
          {req.driverName === me ? <PriceAskCard req={req} role="driver" /> : null}
          {req.driverName === me && req.takenAt ? <PriceAskButton req={req} /> : null}
          {offer && !offer.status && req.stage === 'open' ? (
            <T size={12} muted>
              {t('yourOfferWas', { price: dh(offer.price, lang) })}
            </T>
          ) : null}
          {offer?.status === 'declined' ? (
            <T size={12} color={c.muted}>
              {t('declinedNote')}
            </T>
          ) : null}
        </RequestCard>
      ))}
      {!list.length ? <Empty icon={seg === 'now' ? 'pricetags-outline' : 'archive-outline'} title={seg === 'now' ? t('noCurrent') : t('noPast')} sub={seg === 'now' ? t('noCurrentDriver') : t('noPastSub')} /> : null}
    </>
  );
}

/** One request in the lists: photo, route, when and price; current ones open, past ones unfold their details. */
function RequestCard({ req, status, price, open, children }: { req: Request; status: Status; price?: number; open?: () => void; children?: ReactNode }) {
  const c = useColors();
  const { t, lang, route, rtl } = useT();
  const [unfolded, setUnfolded] = useState(false);
  const toneColor = status.tone === 'live' ? c.live : status.tone === 'ok' ? c.ok : status.tone === 'warn' ? c.warn : status.tone === 'bad' ? c.danger : c.muted;
  const toneSoft = status.tone === 'live' ? c.liveSoft : status.tone === 'ok' ? c.okSoft : status.tone === 'warn' ? c.warnSoft : c.raised;
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 16, borderWidth: open ? 2 : 1, borderColor: open ? c.accent : c.line, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tap();
          if (open) open();
          else setUnfolded((u) => !u);
        }}
        style={({ pressed }) => ({ padding: 14, gap: 12, opacity: pressed ? 0.85 : 1 })}>
        {/* Stitch waybill card: number and status, the route on a line, load and price, the driver. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Tech color={c.fg}>{`${t('waybill')} #XP-${req.id.replace(/[^0-9a-z]/gi, '').slice(-4).toUpperCase()}`}</Tech>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: toneSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 1 }}>
            {status.tone === 'live' ? <LiveDot /> : <Ionicons name={status.icon} size={12} color={toneColor} />}
            <T size={11} weight="bold" color={toneColor} style={{ flexShrink: 1 }}>
              {status.label}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ alignItems: 'center', paddingTop: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: c.accent }} />
            <View style={{ width: 2, flex: 1, minHeight: 16, backgroundColor: c.line }} />
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent }} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <T size={15} weight="bold">
              {shortPlace(req.from)}
            </T>
            <T size={15} weight="bold">
              {shortPlace(req.to)}
            </T>
          </View>
          <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: c.raised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {req.photoUri ? <Image source={{ uri: req.photoUri }} style={{ width: 56, height: 56 }} resizeMode="cover" /> : <Ionicons name="cube-outline" size={24} color={c.muted} />}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1.4, backgroundColor: c.raised, borderRadius: 12, padding: 10, gap: 2 }}>
            <Tech>{t('loadTitle')}</Tech>
            <T size={13} weight="semibold">
              {loadOf(req, t)}
            </T>
          </View>
          <View style={{ flex: 1, backgroundColor: c.raised, borderRadius: 12, padding: 10, gap: 2 }}>
            <Tech>{formatWhen(req.when, lang, t)}</Tech>
            <T size={17} weight="heavy">
              {dh(price ?? req.price, lang)}
            </T>
          </View>
        </View>
        {req.driverName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="person-circle-outline" size={20} color={c.muted} />
            <T size={13} weight="semibold" style={{ flex: 1 }}>
              {[req.driverName, vName(t, req.driverVehicle)].join(' · ')}
            </T>
            <Ionicons name={open ? (rtl ? 'chevron-back' : 'chevron-forward') : unfolded ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Ionicons name={open ? (rtl ? 'chevron-back' : 'chevron-forward') : unfolded ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
          </View>
        )}
      </Pressable>
      {children ? <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>{children}</View> : null}
      {unfolded ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 }}>
          {(req.photoUris?.length ?? 0) > 1 ? <PhotoStrip uris={req.photoUris!} /> : null}
          <Detail label={t('from')} value={req.from} />
          <Detail label={t('to')} value={req.to} />
          <Detail label={t('secWhen')} value={formatWhen(req.when, lang, t)} />
          {req.driverName ? <Detail label={t('driverLabel')} value={[req.driverName, vName(t, req.driverVehicle)].join(' · ')} /> : null}
          {req.helpers ? <Detail label={t('helpTitle')} value={t('helpersTag', { n: req.helpers })} /> : null}
          {req.notes ? <Detail label={t('secHelp')} value={req.notes} /> : null}
          {req.rating ? <Detail label={t('howWas')} value={'★'.repeat(req.rating)} /> : null}
          {req.problem ? <Detail label={t('problemTitle')} value={req.problem.text || '📷'} /> : null}
          {req.tripPhotos?.length ? <TripPhotos req={req} side="customer" canAdd={false} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <T size={13} muted style={{ width: 96 }}>
        {label}
      </T>
      <T size={14} weight="semibold" style={{ flex: 1 }}>
        {value}
      </T>
    </View>
  );
}

// ---------- Profile ----------

/**
 * Owner's report #21: tapping the photo asks «Camera or gallery», then the phone's own editor crops
 * and zooms it (square) before it is kept.
 */
async function pickProfilePhoto(source: 'camera' | 'library'): Promise<string | null> {
  try {
    if (source === 'camera') {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return null;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] };
    const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets.length) return null;
    const small = await manipulateAsync(r.assets[0].uri, [{ resize: { width: 512 } }], { compress: 0.8, format: SaveFormat.JPEG });
    return small.uri;
  } catch {
    return null;
  }
}

function Avatar({ uri, name, onPick, size = 72 }: { uri?: string; name: string; onPick: (uri: string) => void; size?: number }) {
  const c = useColors();
  const { t } = useT();
  const [choose, setChoose] = useState(false);
  const take = async (source: 'camera' | 'library') => {
    setChoose(false);
    const got = await pickProfilePhoto(source);
    if (got) {
      play('pop');
      onPick(got);
    }
  };
  return (
    <>
    <Sheet visible={choose} onClose={() => setChoose(false)} title={t('changePhoto')}>
      <View style={{ gap: 10 }}>
        <T size={13} muted>
          {t('photoCropHint')}
        </T>
        <Btn title={t('takePhoto')} icon="camera-outline" onPress={() => take('camera')} />
        <Btn title={t('chooseGallery')} kind="ghost" icon="images-outline" onPress={() => take('library')} />
      </View>
    </Sheet>
    <Pressable accessibilityRole="button" accessibilityLabel={t('changePhoto')} onPress={() => { tap(); setChoose(true); }} style={{ alignSelf: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.liveSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.surface }}>
        {uri ? (
          <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
        ) : name.trim() ? (
          <T size={Math.round(size * 0.34)} weight="heavy" color={c.live}>
            {name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0] ?? '')
              .join('')
              .toUpperCase()}
          </T>
        ) : (
          <Ionicons name="person" size={Math.round(size * 0.42)} color={c.live} />
        )}
      </View>
      <View style={{ position: 'absolute', bottom: 0, end: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg }}>
        <Ionicons name="camera" size={13} color={c.onAccent} />
      </View>
    </Pressable>
    </>
  );
}

function Field({ label, value, onChange, placeholder, phone, icon }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; phone?: boolean; icon: keyof typeof Ionicons.glyphMap }) {
  const c = useColors();
  const { lang } = useT();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 3 }}>
      <T size={12} weight="bold" muted>
        {label}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderWidth: focus ? 2 : 1, borderColor: focus ? c.accent : c.line, borderRadius: 12, paddingHorizontal: 12, minHeight: 42 }}>
        <Ionicons name={icon} size={18} color={focus ? c.accent : c.muted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={c.muted}
          accessibilityLabel={label}
          keyboardType={phone ? 'phone-pad' : 'default'}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[{ flex: 1, minWidth: 0, fontSize: 16, color: c.fg, paddingVertical: 8 }, fieldDir(value, lang), { outlineWidth: 0, outlineStyle: 'none' } as object]}
        />
      </View>
    </View>
  );
}

const pickPhoto = async (): Promise<string | null> => {
  const got = await capture('library', 1);
  return Array.isArray(got) && got[0] ? got[0].uri : null;
};

function SavedLine({ shown }: { shown: boolean }) {
  const c = useColors();
  const { t } = useT();
  if (!shown) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' }}>
      <Ionicons name="checkmark-circle" size={18} color={c.ok} />
      <T size={14} weight="bold" color={c.ok}>
        {t('profileSaved')}
      </T>
    </View>
  );
}

function CustomerProfile() {
  const { t } = useT();
  const store = useStore();
  const insets = useSafeAreaInsets();
  const [p, setP] = useState(store.customer);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<typeof p>) => {
    setP({ ...p, ...patch });
    setSaved(false);
  };
  const sent = store.requests.length;
  const done = store.requests.filter((r) => r.stage === 'delivered').length;
  return (
    <KeyboardScroll keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }}>
      <PageTitle tag={t('tagAccount')} title={t('profileCustomerTitle')} sub={t('profileCustomerSub')} />
      {/* Round 9 (#91): photo and numbers on one row, slimmer boxes: the page fits on one screen. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar
          size={64}
          uri={p.photoUri}
          name={p.name}
          onPick={(uri) => set({ photoUri: uri })}
        />
        <Stat n={sent} label={t('statRequests')} />
        <Stat n={done} label={t('statDelivered')} />
      </View>
      <Card style={{ gap: 10 }}>
        <Field label={t('yourName')} icon="person-outline" value={p.name} onChange={(name) => set({ name })} />
        <Field label={t('phoneLabel')} icon="call-outline" value={p.phone} onChange={(phone) => set({ phone })} phone />
        <Field label={t('cityLabel')} icon="business-outline" value={p.city} onChange={(city) => set({ city })} />
        {/* Shops and companies (round 7): an optional company name drivers see. */}
        <Field label={t('companyLabel')} icon="briefcase-outline" value={p.company ?? ''} onChange={(company) => set({ company })} placeholder={t('optional')} />
      </Card>
      <SavedLine shown={saved} />
      <Btn
        title={t('saveChanges')}
        icon="checkmark"
        onPress={() => {
          update((s) => ({ ...s, customer: { ...p, name: p.name.trim(), phone: p.phone.trim(), city: p.city.trim(), company: p.company?.trim() || undefined } }));
          play('success');
          setSaved(true);
        }}
      />
    </KeyboardScroll>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' }}>
      <T size={20} weight="heavy">
        {String(n)}
      </T>
      <T size={12} muted style={{ textAlign: 'center' }}>
        {label}
      </T>
    </View>
  );
}

const PAPERS: { id: PaperId; icon: keyof typeof Ionicons.glyphMap; label: Key }[] = [
  { id: 'license', icon: 'card-outline', label: 'paperLicense' },
  { id: 'registration', icon: 'document-text-outline', label: 'paperRegistration' },
  { id: 'insurance', icon: 'shield-checkmark-outline', label: 'paperInsurance' },
  { id: 'idCard', icon: 'id-card-outline', label: 'paperId' },
];

function DriverProfile() {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const insets = useSafeAreaInsets();
  const [p, setP] = useState(store.driver);
  const [picker, setPicker] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<typeof p>) => {
    setP({ ...p, ...patch });
    setSaved(false);
  };
  const papers = p.papers ?? {};
  const added = PAPERS.filter((x) => papers[x.id]).length;
  const done = store.requests.filter((r) => !!p.name && r.driverName === p.name && !r.driverIsExample && r.stage === 'delivered').length;
  return (
    <KeyboardScroll keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}>
      <PageTitle tag={t('tagAccount')} title={t('profileDriverTitle')} sub={t('profileDriverSub')} />
      {/* Simple design: photo, stars and numbers on one row (no scrolling past a big header). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar size={64} uri={p.photoUri} name={p.name} onPick={(uri) => set({ photoUri: uri })} />
        <Stat n={done} label={t('statTrips')} />
        <Stat n={added} label={t('statPapers', { n: PAPERS.length })} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Stars avg={driverRating(store.requests, p.name).avg} count={driverRating(store.requests, p.name).count} size={14} />
        {committedDriver(store.requests, p.name) ? <CommittedBadge /> : null}
      </View>
      <Card>
        <Field label={t('yourName')} icon="person-outline" value={p.name} onChange={(name) => set({ name })} />
        <Field label={t('phoneLabel')} icon="call-outline" value={p.phone ?? ''} onChange={(phone) => set({ phone })} phone />
      </Card>
      <Card>
        <T size={18} weight="heavy">
          {t('yourVehicle')}
        </T>
        <VehicleRow id={p.vehicle} onChange={() => setPicker(true)} />
        <Field label={t('plateLabel')} icon="car-outline" value={p.plate ?? ''} onChange={(plate) => set({ plate })} />
      </Card>
      <WorkCard work={p.work ?? {}} onChange={(work) => set({ work })} />
      {/* Rule 12: a company's team and vehicles. */}
      {store.driver.accountType === 'company' ? <TeamCard /> : null}
      <Card>
        <View style={{ gap: 2 }}>
          <T size={18} weight="heavy">
            {t('papersTitle')}
          </T>
          <T size={13} muted>
            {t('papersSub')}
          </T>
        </View>
        {PAPERS.map((x) => {
          const uri = papers[x.id];
          return (
            <Pressable
              key={x.id}
              accessibilityRole="button"
              accessibilityLabel={`${t(x.label)}: ${uri ? t('paperAdded') : t('paperAdd')}`}
              onPress={async () => {
                tap();
                const got = await pickPhoto();
                if (got) set({ papers: { ...papers, [x.id]: got } });
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.raised, borderRadius: 16, padding: 10, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                {uri ? <Image source={{ uri }} style={{ width: 52, height: 52 }} resizeMode="cover" /> : <Ionicons name={x.icon} size={24} color={c.muted} />}
              </View>
              <View style={{ flex: 1 }}>
                <T weight="bold">{t(x.label)}</T>
                <T size={12} weight="semibold" color={uri ? c.ok : c.muted}>
                  {uri ? t('paperAdded') : t('paperAdd')}
                </T>
              </View>
              <Ionicons name={uri ? 'checkmark-circle' : 'add-circle-outline'} size={24} color={uri ? c.ok : c.accent} />
            </Pressable>
          );
        })}
        <T size={12} muted>
          {t('papersTestNote')}
        </T>
      </Card>
      <SavedLine shown={saved} />
      <Btn
        title={t('saveChanges')}
        icon="checkmark"
        disabled={!p.name.trim()}
        onPress={() => {
          // What changes elsewhere while this page is open (online switch, trips, cancellations) is kept as it is now.
          update((s) => ({ ...s, driver: { ...p, online: s.driver.online, plans: s.driver.plans, cancels: s.driver.cancels, priceCancels: s.driver.priceCancels, name: p.name.trim(), phone: p.phone?.trim(), plate: p.plate?.trim() } }));
          play('success');
          setSaved(true);
        }}
      />
      <VehiclePicker
        visible={picker}
        value={p.vehicle}
        weightKg={0}
        onClose={() => setPicker(false)}
        onPick={(vehicle) => {
          set({ vehicle });
          setPicker(false);
        }}
      />
    </KeyboardScroll>
  );
}


/** On a trip page: the conversation with the other side, one tap away (with its unread count). */
export function ChatButton({ req, role }: { req: Request; role: Role }) {
  const c = useColors();
  const { t, lang } = useT();
  const n = unread(req, role);
  const shown = messagesFor(req, role);
  const last = shown[shown.length - 1];
  const store = useStore();
  const other = role === 'customer' ? req.driverName || store.driver.name || t('driverLabel') : store.customer.name || t('customer');
  const person = personOf(req, role, store, t('customer'));
  return (
    // The call button first, then the conversation.
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <CallButton person={person} size={56} onChat={() => openTab('messages', req.id)} />
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        openTab('messages', req.id);
      }}
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: 20, borderWidth: n ? 1.5 : 1, borderColor: n ? c.accent : c.line, padding: 12, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="chatbubbles" size={22} color={c.onAccent} />
      </View>
      <View style={{ flex: 1 }}>
        <T weight="heavy">{t('openChat', { name: other })}</T>
        <T size={13} muted>
          {last ? (last.kind === 'voice' ? `🎤 ${t('voiceNote')}` : last.kind === 'photo' ? `📷 ${t('photoShort')}` : messageText(last, lang)) : t('chatStart')}
        </T>
      </View>
      {n ? (
        <View style={{ minWidth: 24, height: 24, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
          <T size={12} weight="heavy" color={c.onAccent} style={{ lineHeight: 15 }}>
            {String(n)}
          </T>
        </View>
      ) : null}
    </Pressable>
    </View>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBack } from './back';
import { setChatOnScreen, setLayer } from './where';
import { capture } from './flow';
import { openTab, openTrip, type TabId } from './home';
import { useT, type Key } from './i18n';
import { CallButton } from './call';
import { autoDir, BitBubble, Composer } from './composer';
import { driverRating, PersonSheet, Stars, type Person } from './people';
import { KeyboardScroll, useKeyboardInset } from './keyboard';
import { dh, Initials, loadOf, PhotoStrip, VehiclePicker, VehicleRow, vName } from './shared';
import { play } from './sounds';
import { addOffer, isLive, markSeen, messagesFor, messageText, sendMessage, unread, update, useStore, type Offer, type PaperId, type Request, type Role } from './store';
import { Btn, Card, LiveDot, Pill, T, tap, useColors } from './ui';
import { formatWhen } from './wheels';

/** A request older than this that never got a driver counts as "not continued". */
const STALE_MS = 36 * 3600 * 1000;
const LIVE = ['open', 'accepted', 'enroute', 'arrived', 'loaded'];
const shortPlace = (p: string) => p.split(/[,،]/)[0].trim();

// ---------- Which conversations and offers each side has ----------

/** Customer: trips with a driver. Driver: jobs this driver won (the example drivers are the customer's test). */
export function threadsFor(role: Role, requests: Request[], me: string): Request[] {
  const list = role === 'customer' ? requests.filter((r) => !!r.driverName && r.stage !== 'open') : requests.filter((r) => !!me && r.driverName === me && !r.driverIsExample);
  const last = (r: Request) => r.messages?.[r.messages.length - 1]?.at ?? r.acceptedAt ?? r.createdAt;
  return [...list].sort((a, b) => last(b) - last(a));
}

const isCurrentRequest = (r: Request) => LIVE.includes(r.stage) && (r.stage !== 'open' || Date.now() - r.createdAt < STALE_MS);

// ---------- The three buttons at the top ----------

// Offers · Messages · Profile in reading order (Offers first: on the left in English/French, on the right in Arabic).
const TABS: { id: TabId; icon: keyof typeof Ionicons.glyphMap; on: keyof typeof Ionicons.glyphMap; label: Key }[] = [
  { id: 'offers', icon: 'pricetags-outline', on: 'pricetags', label: 'tabOffers' },
  { id: 'messages', icon: 'chatbubbles-outline', on: 'chatbubbles', label: 'tabMessages' },
  { id: 'profile', icon: 'person-circle-outline', on: 'person-circle', label: 'tabProfile' },
];

/** Messages · Offers · Profile, in the same rounded switch the Customer / Driver buttons used. */
export function TabBar({ tab, onTab, role }: { tab: TabId | null; onTab: (t: TabId) => void; role: Role }) {
  const c = useColors();
  const { t } = useT();
  const store = useStore();
  const unreadCount = threadsFor(role, store.requests, store.driver.name).reduce((n, r) => n + unread(r, role), 0);
  const current = role === 'customer' ? store.requests.filter(isCurrentRequest).length : store.offers.filter((o) => o.id.endsWith('_me') && store.requests.some((r) => r.id === o.requestId && r.stage === 'open')).length;
  const badge = (id: TabId) => (id === 'messages' ? unreadCount : id === 'offers' ? current : 0);
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.raised, borderRadius: 999, padding: 4, gap: 2 }}>
      {TABS.map((x) => {
        const on = tab === x.id;
        const n = badge(x.id);
        return (
          <Pressable
            key={x.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={n ? `${t(x.label)} (${n})` : t(x.label)}
            onPress={() => {
              tap();
              onTab(x.id);
            }}
            style={{ flex: 1, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.surface : 'transparent', paddingHorizontal: 2 }}>
            <View>
              <Ionicons name={on ? x.on : x.icon} size={18} color={on ? c.accent : c.fg} />
              {n ? (
                <View style={{ position: 'absolute', top: -5, end: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: x.id === 'messages' ? c.danger : c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: c.raised }}>
                  <T size={9} weight="heavy" color="#FFFFFF" style={{ lineHeight: 11 }}>
                    {String(Math.min(9, n))}
                  </T>
                </View>
              ) : null}
            </View>
            <T size={11} weight="bold" color={on ? c.fg : c.muted} numberOfLines={1} style={{ lineHeight: 14, marginTop: 1 }}>
              {t(x.label)}
            </T>
          </Pressable>
        );
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
      {tab === 'messages' ? chat ? <ChatThread reqId={chat} role={role} onBack={() => setChat(null)} /> : <Messages role={role} onOpen={setChat} /> : null}
      {tab === 'offers' ? <OffersPage role={role} onClose={onClose} /> : null}
      {tab === 'profile' ? role === 'customer' ? <CustomerProfile /> : <DriverProfile /> : null}
    </View>
  );
}

function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T size={26} weight="heavy">
        {title}
      </T>
      {sub ? <T muted>{sub}</T> : null}
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

function Messages({ role, onOpen }: { role: Role; onOpen: (id: string) => void }) {
  const c = useColors();
  const { t, lang, route } = useT();
  const store = useStore();
  const insets = useSafeAreaInsets();
  const threads = threadsFor(role, store.requests, store.driver.name);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}>
      <PageTitle title={t('tabMessages')} sub={role === 'customer' ? t('msgSubCustomer') : t('msgSubDriver')} />
      {threads.map((r) => {
        const other = role === 'customer' ? (r.driverName ?? '') : t('customer');
        const seen = messagesFor(r, role);
        const last = seen[seen.length - 1];
        const n = unread(r, role);
        return (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityLabel={`${other}, ${route(shortPlace(r.from), shortPlace(r.to))}${n ? `, ${t('unreadN', { n })}` : ''}`}
            onPress={() => {
              tap();
              onOpen(r.id);
            }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: 20, borderWidth: n ? 1.5 : 1, borderColor: n ? c.accent : c.line, padding: 12, opacity: pressed ? 0.85 : 1 })}>
            <Initials name={other} />
            <View style={{ flex: 1, gap: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T weight="heavy" style={{ flex: 1 }} numberOfLines={1}>
                  {other}
                </T>
                {last ? (
                  <T size={12} muted style={{ writingDirection: 'ltr' }}>
                    {clock(last.at)}
                  </T>
                ) : null}
              </View>
              <T size={12} muted numberOfLines={1}>
                {route(shortPlace(r.from), shortPlace(r.to))}
              </T>
              <T size={14} weight={n ? 'bold' : 'regular'} color={n ? c.fg : c.muted} numberOfLines={1}>
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

const QUICK: Record<Role, Key[]> = {
  customer: ['q_c1', 'q_c2', 'q_c3', 'q_c4'],
  driver: ['q_d1', 'q_d2', 'q_d3', 'q_d4'],
};

/** The other side of a trip, as a person (photo, name; for a driver, the vehicle). */
function personOf(req: Request, role: Role, store: ReturnType<typeof useStore>, customerWord: string): Person {
  return role === 'customer'
    ? { role: 'driver', name: req.driverName ?? '', vehicle: req.driverVehicle, example: req.driverIsExample, photo: req.driverName === store.driver.name ? store.driver.photoUri : undefined }
    : { role: 'customer', name: store.customer.name || customerWord, photo: store.customer.photoUri, city: store.customer.city || undefined };
}

/** One conversation: the messages, quick replies, and a box that always sits right above the keyboard. */
export function ChatThread({ reqId, role, onBack }: { reqId: string; role: Role; onBack: () => void }) {
  const c = useColors();
  const { t, lang, route, rtl } = useT();
  const store = useStore();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const req = store.requests.find((r) => r.id === reqId);
  const [text, setText] = useState('');
  const [profile, setProfile] = useState(false);
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
  const other = role === 'customer' ? (req.driverName ?? '') : t('customer');
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
            <T weight="heavy" numberOfLines={1}>
              {other}
            </T>
            <T size={12} muted numberOfLines={1}>
              {[route(shortPlace(req.from), shortPlace(req.to)), req.driverVehicle && role === 'customer' ? vName(t, req.driverVehicle) : ''].filter(Boolean).join(' · ')}
            </T>
          </View>
        </Pressable>
        {req.driverName ? <CallButton person={person} size={40} /> : null}
        {live ? (
          <Pressable
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
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }} keyboardShouldPersistTaps="handled">
        {QUICK[role].map((k) => (
          <Pressable key={k} accessibilityRole="button" onPress={() => send(t(k))} style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 999, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' }}>
            <T size={13} weight="semibold">
              {t(k)}
            </T>
          </Pressable>
        ))}
      </ScrollView>
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
      <PersonSheet person={profile ? person : null} onClose={() => setProfile(false)} />
    </View>
  );
}

// ---------- Offers: what is going on now, and what happened before ----------

function Segments({ value, onChange, items }: { value: 'now' | 'past'; onChange: (v: 'now' | 'past') => void; items: [string, string] }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.raised, borderRadius: 14, padding: 4, gap: 4 }}>
      {(['now', 'past'] as const).map((v, i) => (
        <Pressable
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
      <PageTitle title={t('tabOffers')} sub={role === 'customer' ? t('offersSubCustomer') : t('offersSubDriver')} />
      <Segments value={seg} onChange={setSeg} items={[t('segNow'), t('segPast')]} />
      {role === 'customer' ? <CustomerOffers seg={seg} onClose={onClose} /> : <DriverOffers seg={seg} onClose={onClose} />}
    </ScrollView>
  );
}

function CustomerOffers({ seg, onClose }: { seg: 'now' | 'past'; onClose: () => void }) {
  const { t } = useT();
  const store = useStore();
  const now = store.requests.filter(isCurrentRequest);
  const past = store.requests.filter((r) => !isCurrentRequest(r));
  const status = (r: Request): Status => {
    const n = store.offers.filter((o) => o.requestId === r.id && o.status !== 'declined').length;
    if (r.stage === 'open' && isCurrentRequest(r)) return { label: n ? (n === 1 ? t('oneOffer') : t('offersN', { n })) : t('waitingOffers'), tone: 'live', icon: 'radio-outline' };
    if (isLive(r.stage)) return { label: t(`st_${r.stage}` as Key), tone: 'live', icon: 'navigate' };
    if (r.stage === 'delivered') return { label: t('stFinished'), tone: 'ok', icon: 'checkmark-circle' };
    if (r.stage === 'cancelled') return { label: r.cancelledBy === 'driver' ? t('stCancelledByDriver') : r.cancelledBy === 'customer' ? t('stCancelledByYou') : t('stCancelled'), tone: 'bad', icon: 'close-circle' };
    return { label: t('stNotContinued'), tone: 'warn', icon: 'time-outline' };
  };
  const list = seg === 'now' ? now : past;
  return (
    <>
      {list.map((r) => (
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
          }
        />
      ))}
      {!list.length ? <Empty icon={seg === 'now' ? 'pricetags-outline' : 'archive-outline'} title={seg === 'now' ? t('noCurrent') : t('noPast')} sub={seg === 'now' ? t('noCurrentCustomer') : t('noPastSub')} /> : null}
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
    <View style={{ backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: open ? c.live : c.line, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tap();
          if (open) open();
          else setUnfolded((u) => !u);
        }}
        style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 12, opacity: pressed ? 0.85 : 1 })}>
        <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: c.raised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {req.photoUri ? <Image source={{ uri: req.photoUri }} style={{ width: 64, height: 64 }} resizeMode="cover" /> : <Ionicons name="cube-outline" size={26} color={c.muted} />}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <T weight="heavy" numberOfLines={1}>
            {route(shortPlace(req.from), shortPlace(req.to))}
          </T>
          <T size={12} muted numberOfLines={1}>
            {[loadOf(req, t), formatWhen(req.when, lang, t)].filter(Boolean).join(' · ')}
          </T>
          {/* The price on one line, then the status in full (it may take two lines, never cut). */}
          <T size={14} weight="heavy" numberOfLines={1}>
            {dh(price ?? req.price, lang)}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: toneSoft, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '100%' }}>
            {status.tone === 'live' ? <LiveDot /> : <Ionicons name={status.icon} size={13} color={toneColor} />}
            <T size={12} weight="bold" color={toneColor} numberOfLines={2} style={{ flexShrink: 1 }}>
              {status.label}
            </T>
          </View>
        </View>
        <Ionicons name={open ? (rtl ? 'chevron-back' : 'chevron-forward') : unfolded ? 'chevron-up' : 'chevron-down'} size={20} color={c.muted} style={{ alignSelf: 'center' }} />
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

function Avatar({ uri, name, onPick }: { uri?: string; name: string; onPick: () => void }) {
  const c = useColors();
  const { t } = useT();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('changePhoto')} onPress={onPick} style={{ alignSelf: 'center' }}>
      <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: c.liveSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.surface }}>
        {uri ? (
          <Image source={{ uri }} style={{ width: 104, height: 104 }} resizeMode="cover" />
        ) : name.trim() ? (
          <T size={36} weight="heavy" color={c.live} style={{ lineHeight: 44 }}>
            {name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0] ?? '')
              .join('')
              .toUpperCase()}
          </T>
        ) : (
          <Ionicons name="person" size={44} color={c.live} />
        )}
      </View>
      <View style={{ position: 'absolute', bottom: 2, end: 2, width: 34, height: 34, borderRadius: 17, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg }}>
        <Ionicons name="camera" size={16} color={c.onAccent} />
      </View>
    </Pressable>
  );
}

function Field({ label, value, onChange, placeholder, phone, icon }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; phone?: boolean; icon: keyof typeof Ionicons.glyphMap }) {
  const c = useColors();
  const { lang } = useT();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T size={13} weight="bold" muted>
        {label}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderWidth: focus ? 2 : 1, borderColor: focus ? c.accent : c.line, borderRadius: 16, paddingHorizontal: 12, minHeight: 54 }}>
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
          style={[{ flex: 1, minWidth: 0, fontSize: 16, color: c.fg, paddingVertical: 12 }, autoDir(value, lang), { outlineWidth: 0, outlineStyle: 'none' } as object]}
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
    <KeyboardScroll keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 14 }}>
      <PageTitle title={t('profileCustomerTitle')} sub={t('profileCustomerSub')} />
      <Avatar uri={p.photoUri} name={p.name} onPick={async () => {
        const uri = await pickPhoto();
        if (uri) set({ photoUri: uri });
      }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat n={sent} label={t('statRequests')} />
        <Stat n={done} label={t('statDelivered')} />
      </View>
      <Card>
        <Field label={t('yourName')} icon="person-outline" value={p.name} onChange={(name) => set({ name })} />
        <Field label={t('phoneLabel')} icon="call-outline" value={p.phone} onChange={(phone) => set({ phone })} phone />
        <Field label={t('cityLabel')} icon="business-outline" value={p.city} onChange={(city) => set({ city })} />
      </Card>
      <SavedLine shown={saved} />
      <Btn
        title={t('saveChanges')}
        icon="checkmark"
        onPress={() => {
          update((s) => ({ ...s, customer: { ...p, name: p.name.trim(), phone: p.phone.trim(), city: p.city.trim() } }));
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
    <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 12, alignItems: 'center' }}>
      <T size={24} weight="heavy">
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
      <PageTitle title={t('profileDriverTitle')} sub={t('profileDriverSub')} />
      <Avatar uri={p.photoUri} name={p.name} onPick={async () => {
        const uri = await pickPhoto();
        if (uri) set({ photoUri: uri });
      }} />
      <View style={{ alignItems: 'center' }}>
        <Stars avg={driverRating(store.requests, p.name).avg} count={driverRating(store.requests, p.name).count} size={15} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat n={done} label={t('statTrips')} />
        <Stat n={added} label={t('statPapers', { n: PAPERS.length })} />
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
          update((s) => ({ ...s, driver: { ...p, name: p.name.trim(), phone: p.phone?.trim(), plate: p.plate?.trim() } }));
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
  const other = role === 'customer' ? (req.driverName ?? '') : t('customer');
  const store = useStore();
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
        <T size={13} muted numberOfLines={1}>
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

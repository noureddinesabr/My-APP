import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT, type Key } from './i18n';
import { searchOnline, type OnlinePlace } from './lib/geocode';
import { findPlaces, getPlace, placeLabel, rememberPlace, type Place } from './lib/places';
import { estimateDistanceKm, estimatePrice, HELPER_FEE } from './lib/pricing';
import { dh } from './shared';
import { play } from './sounds';
import { onNotice, sendMessage, update, useStore, type Notice, type Request } from './store';
import { Card, Pill, T, tap, useColors, useKeyboardInset } from './ui';
import type { VehicleId } from './vehicles';
import { formatWhen } from './wheels';

// ---------- distance and fair price from the picked places ----------

export function estimateTrip(fromPlaceId: string | undefined, toPlaceId: string | undefined, vehicle: VehicleId, helpers: number) {
  const a = getPlace(fromPlaceId);
  const b = getPlace(toPlaceId);
  if (!a || !b) return null;
  const km = estimateDistanceKm(a, b, a.cityId === b.cityId);
  const price = estimatePrice(vehicle, km, helpers);
  return { km, low: price.low, high: price.high, suggested: price.suggested };
}

/** The place a name means; "Derb Omar, Casablanca" looks for Derb Omar near Casablanca. */
export function matchPlace(text: string): Place | undefined {
  const q = text.trim();
  if (q.length < 2) return undefined;
  const direct = findPlaces(q, 1)[0];
  if (direct) return direct;
  const parts = q.split(/[,،]/).map((x) => x.trim()).filter((x) => x.length >= 2);
  if (parts.length < 2) return undefined;
  const city = findPlaces(parts[parts.length - 1], 1)[0];
  return findPlaces(parts[0], 1, city)[0] ?? city;
}

const KIND: Record<string, Key> = { city: 'k_city', town: 'k_town', district: 'k_district', street: 'k_street' };

// ---------- From / To with suggestions of Moroccan places ----------

export function PlaceField({ label, icon, value, placeId, near, onChange }: { label: string; icon: keyof typeof Ionicons.glyphMap; value: string; placeId?: string; near?: Place; onChange: (text: string, placeId?: string) => void }) {
  const c = useColors();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || t('tapToSearch')}`}
        onPress={() => {
          tap();
          setOpen(true);
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={c.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <T size={12} muted weight="semibold">
            {label}
          </T>
          <T size={16} weight="bold" color={value ? c.fg : c.muted}>
            {value || t('tapToSearch')}
          </T>
        </View>
        {placeId ? <Ionicons name="checkmark-circle" size={20} color={c.ok} accessibilityLabel={t('placeFound')} /> : <Ionicons name="search" size={18} color={c.muted} />}
      </Pressable>
      <PlaceSearch visible={open} label={label} icon={icon} initial={placeId ? '' : value} near={near} onClose={() => setOpen(false)} onPick={(text, id) => onChange(text, id)} />
    </>
  );
}

/**
 * Searching a place: the box sits right above the keyboard and the suggestions are stacked
 * above it, the best one nearest the box, from the first letter typed. Places the app knows
 * come first; addresses found online (OpenStreetMap) follow when the phone is connected.
 */
function PlaceSearch({ visible, label, icon, initial, near, onClose, onPick }: { visible: boolean; label: string; icon: keyof typeof Ionicons.glyphMap; initial: string; near?: Place; onClose: () => void; onPick: (text: string, placeId?: string) => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const [text, setText] = useState(initial);
  const [online, setOnline] = useState<OnlinePlace[]>([]);
  const [looking, setLooking] = useState(false);
  useEffect(() => {
    if (visible) setText(initial);
  }, [visible, initial]);
  // Online addresses, a moment after typing stops.
  useEffect(() => {
    setOnline([]);
    const q = text.trim();
    if (!visible || q.length < 3) return;
    let dead = false;
    setLooking(true);
    const timer = setTimeout(() => {
      searchOnline(q, lang, near)
        .then((found) => !dead && setOnline(found))
        .finally(() => !dead && setLooking(false));
    }, 350);
    return () => {
      dead = true;
      clearTimeout(timer);
      setLooking(false);
    };
  }, [text, visible, lang, near]);
  const local = text.trim().length >= 1 ? findPlaces(text, 6, near) : [];
  const seen = new Set(local.map((p) => placeLabel(p, lang).toLowerCase()));
  const extra = online.filter((o) => !seen.has(o.title.toLowerCase())).slice(0, 5);
  const done = (value: string, id?: string) => {
    tap();
    onPick(value, id);
    onClose();
  };
  type Row = { key: string; title: string; sub: string; icon: keyof typeof Ionicons.glyphMap; pick: () => void };
  const rows: Row[] = [
    ...local.map((p) => ({ key: p.id, title: placeLabel(p, lang), sub: `${t(KIND[p.kind] ?? 'k_place')}${lang === 'ar' ? ` · ${p.name.fr}` : ` · ${p.name.ar}`}`, icon: 'location' as const, pick: () => done(placeLabel(p, lang), p.id) })),
    ...extra.map((o) => ({ key: o.id, title: o.title, sub: [t('k_address'), o.subtitle].filter(Boolean).join(' · '), icon: 'navigate' as const, pick: () => done(o.subtitle ? `${o.title}, ${o.subtitle}` : o.title, rememberPlace(o).id) })),
  ];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 10, paddingBottom: keyboard ? keyboard + 8 : insets.bottom + 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color={c.fg} />
          </Pressable>
          <T size={18} weight="heavy">
            {label}
          </T>
        </View>
        {/* Suggestions above the box: the list ends right on top of it. */}
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 }}>
          {text.trim().length >= 2 ? (
            <Pressable accessibilityRole="button" onPress={() => done(text.trim())} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="create-outline" size={18} color={c.muted} />
              </View>
              <T size={15} weight="semibold" muted style={{ flex: 1 }}>
                {t('useTyped', { text: text.trim() })}
              </T>
            </Pressable>
          ) : null}
          {looking ? (
            <T size={12} muted style={{ paddingVertical: 6 }}>
              {t('searchingOnline')}
            </T>
          ) : null}
          {[...rows].reverse().map((r) => (
            <Pressable key={r.key} accessibilityRole="button" onPress={r.pick} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: c.line }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={r.icon} size={18} color={c.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <T size={16} weight="bold">
                  {r.title}
                </T>
                <T size={12} muted>
                  {r.sub}
                </T>
              </View>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderWidth: 2, borderColor: c.accent, borderRadius: 16, paddingHorizontal: 12, minHeight: 54 }}>
          <Ionicons name={icon} size={20} color={c.accent} />
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder={t('placePlaceholder')}
            placeholderTextColor={c.muted}
            accessibilityLabel={label}
            returnKeyType="done"
            onSubmitEditing={() => (rows[0] ? rows[0].pick() : text.trim() ? done(text.trim()) : onClose())}
            style={[{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: '700', color: c.fg, paddingVertical: 10 }, { outlineWidth: 0, outlineStyle: 'none' } as object]}
          />
          {text ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={() => setText('')} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close-circle" size={20} color={c.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ---------- Helpers and riding along ----------

export type Rider = { who: 'none' | 'me' | 'other'; name: string; phone: string };

/**
 * Its own clearly marked card: how many people to load and unload, and who travels with the
 * goods (nobody, the customer, or someone else, with their name and phone for the driver).
 */
export function HelpSection({ helpers, rider, onChange }: { helpers: number; rider: Rider; onChange: (helpers: number, rider: Rider) => void }) {
  const c = useColors();
  const { t } = useT();
  const round = (icon: 'remove' | 'add', label: string, press: () => void, disabled?: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        tap();
        press();
      }}
      style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: icon === 'add' ? c.accent : c.surface, borderWidth: icon === 'add' ? 0 : 1, borderColor: c.line, opacity: disabled ? 0.4 : 1, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={22} color={icon === 'add' ? c.onAccent : c.fg} />
    </Pressable>
  );
  const input = { flex: 1, minWidth: 0, minHeight: 48, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, paddingHorizontal: 12, fontSize: 15, color: c.fg } as const;
  return (
    <View style={{ backgroundColor: c.warnSoft, borderRadius: 22, borderWidth: 1.5, borderColor: c.accent, padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="people" size={22} color={c.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <T size={18} weight="heavy">
            {t('helpTitle')}
          </T>
          <T size={13} muted>
            {t('helpHint')}
          </T>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <T size={15} weight="bold">
          {t('helpersLine')}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {round('remove', t('helperLess'), () => onChange(Math.max(0, helpers - 1), rider), helpers === 0)}
          <T size={24} weight="heavy" style={{ minWidth: 26, textAlign: 'center' }}>
            {String(helpers)}
          </T>
          {round('add', t('helperMore'), () => onChange(Math.min(4, helpers + 1), rider), helpers >= 4)}
          <T size={12} muted style={{ flex: 1 }}>
            {helpers ? t('helpersSome', { fee: HELPER_FEE }) : t('helpersNone')}
          </T>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: c.line }} />
      <View style={{ gap: 8 }}>
        <T size={15} weight="bold">
          {t('riderTitle')}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['none', 'me', 'other'] as const).map((who) => (
            <Pressable
              key={who}
              accessibilityRole="radio"
              accessibilityState={{ selected: rider.who === who }}
              onPress={() => {
                tap();
                onChange(helpers, { ...rider, who });
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 44, borderRadius: 999, borderWidth: 1, borderColor: rider.who === who ? c.accent : c.line, backgroundColor: rider.who === who ? c.accent : c.surface }}>
              <Ionicons name={who === 'none' ? 'cube-outline' : who === 'me' ? 'person' : 'person-add-outline'} size={16} color={rider.who === who ? c.onAccent : c.fg} />
              <T size={14} weight="bold" color={rider.who === who ? c.onAccent : c.fg}>
                {t(`rider_${who}`)}
              </T>
            </Pressable>
          ))}
        </View>
        {rider.who === 'other' ? (
          <View style={{ gap: 8 }}>
            <T size={12} muted>
              {t('riderOtherHint')}
            </T>
            <TextInput value={rider.name} onChangeText={(name) => onChange(helpers, { ...rider, name })} placeholder={t('riderName')} placeholderTextColor={c.muted} accessibilityLabel={t('riderName')} style={input} />
            <TextInput value={rider.phone} onChangeText={(phone) => onChange(helpers, { ...rider, phone })} placeholder={t('riderPhone')} placeholderTextColor={c.muted} accessibilityLabel={t('riderPhone')} keyboardType="phone-pad" style={[input, { writingDirection: 'ltr' }]} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------- Chat between the customer and the driver ----------

const QUICK: Record<'customer' | 'driver', Key[]> = {
  customer: ['q_c1', 'q_c2', 'q_c3', 'q_c4'],
  driver: ['q_d1', 'q_d2', 'q_d3', 'q_d4'],
};

export function Chat({ req, side }: { req: Request; side: 'customer' | 'driver' }) {
  const c = useColors();
  const { t } = useT();
  const [text, setText] = useState('');
  const messages = req.messages ?? [];
  const send = (m: string) => {
    if (!m.trim()) return;
    play('send');
    sendMessage(req.id, side, m);
    setText('');
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="chatbubbles-outline" size={20} color={c.fg} />
        <T weight="heavy" style={{ flex: 1 }}>
          {side === 'customer' ? t('chatToDriver') : t('chatToCustomer')}
        </T>
      </View>
      {messages.length ? (
        <View style={{ gap: 6 }}>
          {messages.slice(-8).map((m) => {
            const mine = m.from === side;
            return (
              <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: mine ? c.accent : c.raised, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 }}>
                <T size={15} color={mine ? c.onAccent : c.fg}>
                  {m.text}
                </T>
              </View>
            );
          })}
        </View>
      ) : (
        <T size={14} muted>
          {t('chatEmpty')}
        </T>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {QUICK[side].map((k) => (
          <Pressable key={k} accessibilityRole="button" onPress={() => send(t(k))} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 12, minHeight: 38, justifyContent: 'center' }}>
            <T size={14} weight="semibold">
              {t(k)}
            </T>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('chatPlaceholder')}
          placeholderTextColor={c.muted}
          accessibilityLabel={t('chatPlaceholder')}
          onSubmitEditing={() => send(text)}
          style={{ flex: 1, backgroundColor: c.raised, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.fg }}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={t('chatSend')} onPress={() => send(text)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="send" size={18} color={c.onAccent} />
        </Pressable>
      </View>
    </Card>
  );
}

// ---------- Notices that slide in at the top, with a sound ----------

export function NoticeBanner({ side }: { side: 'customer' | 'driver' }) {
  const c = useColors();
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<Notice | null>(null);
  const y = useRef(new Animated.Value(-140)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = () => Animated.timing(y, { toValue: -140, duration: 220, useNativeDriver: true }).start(() => setNotice(null));
  useEffect(
    () =>
      onNotice((n) => {
        if (n.side !== side) return;
        play(n.sound);
        setNotice(n);
        y.setValue(-140);
        Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(hide, 4500);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [side],
  );
  if (!notice) return null;
  const vars = { ...notice.vars };
  if (typeof vars.price === 'number') vars.price = dh(vars.price, lang);
  const text = t(notice.key, vars);
  return (
    <Animated.View style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, transform: [{ translateY: y }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text}
        onPress={hide}
        style={{ backgroundColor: c.ink, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }}>
        <Ionicons name="notifications" size={20} color={c.onInk} />
        <T weight="bold" color={c.onInk} style={{ flex: 1 }}>
          {text}
        </T>
      </Pressable>
    </Animated.View>
  );
}

// ---------- The customer's past trips ----------

export function MyTrips({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const { t, lang, route } = useT();
  const store = useStore();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T size={26} weight="heavy">
            {t('trips')}
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={26} color={c.fg} />
          </Pressable>
        </View>
        {store.requests.map((r) => {
          const live = r.stage !== 'delivered' && r.stage !== 'cancelled';
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              disabled={!live}
              onPress={() => {
                update((s) => ({ ...s, activeRequestId: r.id }));
                onClose();
              }}>
              <Card style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <T weight="heavy" style={{ flex: 1 }}>
                    {route(r.from, r.to)}
                  </T>
                  <T weight="heavy">{dh(r.price, lang)}</T>
                </View>
                <T size={13} muted>
                  {[r.load, formatWhen(r.when, lang, t), r.rating ? '★'.repeat(r.rating) : ''].filter(Boolean).join(' · ')}
                </T>
                <Pill tone={r.stage === 'delivered' ? 'ok' : live ? 'live' : undefined}>{t(`s_${r.stage}` as Key)}</Pill>
              </Card>
            </Pressable>
          );
        })}
        {!store.requests.length ? (
          <Card style={{ alignItems: 'center' }}>
            <T muted>{t('tripsEmpty')}</T>
          </Card>
        ) : null}
      </ScrollView>
    </Modal>
  );
}


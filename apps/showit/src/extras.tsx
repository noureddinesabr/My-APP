import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT, type Key } from './i18n';
import { findPlaces, getPlace, placeLabel, type Place } from './lib/places';
import { estimateDistanceKm, estimatePrice, HELPER_FEE } from './lib/pricing';
import { dh } from './shared';
import { play } from './sounds';
import { onNotice, sendMessage, update, useStore, type Notice, type Request } from './store';
import { Card, Pill, T, tap, useColors } from './ui';
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

export const matchPlace = (text: string): Place | undefined => (text.trim().length >= 2 ? findPlaces(text, 1)[0] : undefined);

const KIND: Record<string, Key> = { city: 'k_city', town: 'k_town', district: 'k_district', street: 'k_street' };

// ---------- From / To with suggestions of Moroccan places ----------

export function PlaceField({ label, icon, value, placeId, near, onChange }: { label: string; icon: keyof typeof Ionicons.glyphMap; value: string; placeId?: string; near?: Place; onChange: (text: string, placeId?: string) => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const [focused, setFocused] = useState(false);
  const results = focused && value.trim().length >= 2 && !placeId ? findPlaces(value, 5, near) : [];
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={18} color={c.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <T size={12} muted weight="semibold">
            {label}
          </T>
          <TextInput
            value={value}
            onChangeText={(v) => onChange(v, undefined)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            placeholder={t('placePlaceholder')}
            placeholderTextColor={c.muted}
            accessibilityLabel={label}
            style={{ fontSize: 16, fontWeight: '700', color: c.fg, paddingVertical: 6 }}
          />
        </View>
        {placeId ? <Ionicons name="checkmark-circle" size={20} color={c.ok} accessibilityLabel={t('placeFound')} /> : null}
      </View>
      {results.length ? (
        <View style={{ backgroundColor: c.raised, borderRadius: 14, overflow: 'hidden' }}>
          {results.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => {
                tap();
                onChange(placeLabel(p, lang), p.id);
                setFocused(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
              <Ionicons name="location-outline" size={18} color={c.muted} />
              <View style={{ flex: 1 }}>
                <T size={15} weight="bold">
                  {placeLabel(p, lang)}
                </T>
                <T size={12} muted>
                  {t(KIND[p.kind] ?? 'k_place')}
                  {lang === 'ar' ? ` · ${p.name.fr}` : ` · ${p.name.ar}`}
                </T>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------- Helpers and riding along ----------

export function HelpRow({ helpers, rideAlong, onChange }: { helpers: number; rideAlong: boolean; onChange: (helpers: number, rideAlong: boolean) => void }) {
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
      style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: icon === 'add' ? c.accent : c.raised, opacity: disabled ? 0.4 : 1, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={22} color={icon === 'add' ? c.onAccent : c.fg} />
    </Pressable>
  );
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="people-outline" size={20} color={c.accent} />
          <T weight="bold" style={{ flex: 1 }}>
            {t('helpers')}
          </T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {round('remove', t('helperLess'), () => onChange(Math.max(0, helpers - 1), rideAlong), helpers === 0)}
          <T size={22} weight="heavy" style={{ minWidth: 24, textAlign: 'center' }}>
            {helpers}
          </T>
          {round('add', t('helperMore'), () => onChange(Math.min(4, helpers + 1), rideAlong), helpers >= 4)}
          <T size={12} muted style={{ flex: 1 }}>
            {helpers ? t('helpersSome', { fee: HELPER_FEE }) : t('helpersNone')}
          </T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="person-outline" size={20} color={c.accent} />
        <T weight="bold" style={{ flex: 1 }}>
          {t('rideAlong')}
        </T>
        <Switch
          value={rideAlong}
          onValueChange={(v) => {
            tap();
            onChange(helpers, v);
          }}
          trackColor={{ true: c.accent, false: c.line }}
          thumbColor="#FFFFFF"
          accessibilityLabel={t('rideAlong')}
        />
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


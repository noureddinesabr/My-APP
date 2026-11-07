import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, PanResponder, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { autoDir } from './composer';
import { useT, type Key } from './i18n';
import { Overlay } from './overlay';
import { openTab, openTrip } from './home';
import { useBack } from './back';
import { reverseOnline, searchOnline, type OnlinePlace } from './lib/geocode';
import type { LatLng } from './lib/geo';
import { PickMap } from './map/PickMap';
import { PIN, TripPin } from './map/pins';
import { DEFAULT_CENTER, locateOnce, useMyLocation } from './map/trip';
import { findPlaces, getPlace, nearestPlace, placeLabel, rememberPlace, type Place } from './lib/places';
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

// ---------- From / To: the most important part of a request ----------

/**
 * The route: pickup and destination, joined by a dotted line like a trip. It is highlighted so
 * nobody misses it; an empty end gently pulses until it is chosen. Each opens the map page.
 */
export function RouteFields({ from, to, onFrom, onTo, km, error }: { from: { text: string; id?: string }; to: { text: string; id?: string }; onFrom: (text: string, id?: string) => void; onTo: (text: string, id?: string) => void; km?: number; error?: boolean }) {
  const c = useColors();
  const { t } = useT();
  const done = !!from.text && !!to.text;
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 24, borderWidth: 2, borderColor: error ? c.danger : done ? c.ok : c.accent, padding: 16, gap: 12, shadowColor: c.accent, shadowOpacity: done ? 0.06 : 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: done ? 2 : 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: done ? c.okSoft : c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={done ? 'checkmark' : 'map'} size={20} color={done ? c.ok : c.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <T size={19} weight="heavy">
            {t('secRoute')}
          </T>
          <T size={13} muted>
            {done ? (km ? t('kmByRoad', { km }) : t('routeReady')) : t('routeHint')}
          </T>
        </View>
        {!done ? (
          <View style={{ backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T size={11} weight="heavy" color={c.onAccent}>
              {t('required')}
            </T>
          </View>
        ) : null}
      </View>
      <View>
        <PlaceField kind="pickup" label={t('from')} value={from.text} placeId={from.id} near={getPlace(to.id)} onChange={onFrom} />
        {/* The dotted line between the two ends. */}
        <View style={{ position: 'absolute', start: 21, top: 50, height: 22, width: 2, gap: 3 }} pointerEvents="none">
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 2, height: 4, borderRadius: 1, backgroundColor: c.line }} />
          ))}
        </View>
        <View style={{ height: 10 }} />
        <PlaceField kind="dropoff" label={t('to')} value={to.text} placeId={to.id} near={getPlace(from.id)} onChange={onTo} />
      </View>
    </View>
  );
}

/** One end of the trip: a big row that opens the map page; an empty one pulses gently. */
export function PlaceField({ kind, label, value, placeId, near, onChange }: { kind: 'pickup' | 'dropoff'; label: string; value: string; placeId?: string; near?: Place; onChange: (text: string, placeId?: string) => void }) {
  const c = useColors();
  const { t, rtl } = useT();
  const [open, setOpen] = useState(false);
  const color = kind === 'pickup' ? PIN.pickup : PIN.dropoff;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (value) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: false }), Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: false })]));
    loop.start();
    return () => loop.stop();
  }, [value, pulse]);
  const border = value ? c.line : pulse.interpolate({ inputRange: [0, 1], outputRange: [c.line, color] });
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || t('tapToChoose')}`}
        onPress={() => {
          tap();
          setOpen(true);
        }}>
        {({ pressed }) => (
          <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderRadius: 18, borderWidth: 1.5, borderColor: border, backgroundColor: value ? c.raised : c.bg, paddingHorizontal: 10, opacity: pressed ? 0.85 : 1 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 }}>
              <Ionicons name={kind === 'pickup' ? 'cube' : 'flag'} size={10} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <T size={12} weight="bold" color={color}>
                {label}
              </T>
              <T size={16} weight="heavy" color={value ? c.fg : c.muted} numberOfLines={2}>
                {value || t('tapToChoose')}
              </T>
            </View>
            {placeId ? <Ionicons name="checkmark-circle" size={22} color={c.ok} accessibilityLabel={t('placeFound')} /> : <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color={c.muted} />}
          </Animated.View>
        )}
      </Pressable>
      <PlacePicker visible={open} kind={kind} label={label} placeId={placeId} near={near} onClose={() => setOpen(false)} onPick={(text, id) => onChange(text, id)} />
    </>
  );
}

/**
 * Choosing one end of the trip on its own page: a map with a pin in the middle (move the map
 * under it), and at the bottom a box to type with suggestions, "my location" (GPS) and "use this
 * spot". The box always sits right above the keyboard; suggestions stack above it, best match
 * nearest the box, inside a limited, scrolling list.
 */
function PlacePicker({ visible, kind, label, placeId, near, onClose, onPick }: { visible: boolean; kind: 'pickup' | 'dropoff'; label: string; placeId?: string; near?: Place; onClose: () => void; onPick: (text: string, placeId?: string) => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const { height: screenH } = useWindowDimensions();
  const me = useMyLocation();
  const listRef = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);
  const [text, setText] = useState('');
  const [online, setOnline] = useState<OnlinePlace[]>([]);
  const [looking, setLooking] = useState(false);
  const [start, setStart] = useState<LatLng>(DEFAULT_CENTER);
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [target, setTarget] = useState<{ point: LatLng; seq: number } | null>(null);
  const [spot, setSpot] = useState<{ title: string; sub: string; online?: OnlinePlace } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<'' | 'gps' | 'spot'>('');
  const [gpsError, setGpsError] = useState(false);
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(lift, { toValue: dragging ? 1 : 0, useNativeDriver: true, friction: 6 }).start();
  }, [dragging, lift]);
  // Opens where it makes sense: the place already chosen, the other end, you, or Casablanca.
  useEffect(() => {
    if (!visible) return;
    const chosen = getPlace(placeId);
    const first = chosen ?? near ?? me ?? DEFAULT_CENTER;
    const p = { lat: first.lat, lng: first.lng };
    setText('');
    setStart(p);
    setCenter(p);
    setTarget(null);
    setGpsError(false);
    setBusy('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  // The address under the pin, a moment after the map stops.
  useEffect(() => {
    if (!visible) return;
    let dead = false;
    const near1 = nearestPlace(center);
    setSpot({ title: t('nearPlace', { name: placeLabel(near1, lang) }), sub: '' });
    const timer = setTimeout(() => {
      reverseOnline(center, lang).then((found) => {
        if (!dead && found) setSpot({ title: found.title, sub: found.subtitle, online: found });
      });
    }, 450);
    return () => {
      dead = true;
      clearTimeout(timer);
    };
  }, [center.lat, center.lng, visible, lang]);
  // Online addresses, a moment after typing stops.
  useEffect(() => {
    setOnline([]);
    const q = text.trim();
    if (!visible || q.length < 3) return;
    let dead = false;
    setLooking(true);
    const timer = setTimeout(() => {
      searchOnline(q, lang, near ?? center)
        .then((found) => !dead && setOnline(found))
        .finally(() => !dead && setLooking(false));
    }, 350);
    return () => {
      dead = true;
      clearTimeout(timer);
      setLooking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, visible, lang]);
  const local = text.trim().length >= 1 ? findPlaces(text, 6, near ?? center) : [];
  const seen = new Set(local.map((p) => placeLabel(p, lang).toLowerCase()));
  const extra = online.filter((o) => !seen.has(o.title.toLowerCase())).slice(0, 5);
  const done = (value: string, id?: string) => {
    tap();
    play('pop');
    onPick(value, id);
    onClose();
  };
  /** A point on the map becomes a place: its address when found online, otherwise "near" the closest known place. */
  const pickPoint = async (p: LatLng) => {
    const found = await reverseOnline(p, lang);
    const title = found ? (found.city && !found.title.includes(found.city) ? `${found.title}, ${found.city}` : found.title) : t('nearPlace', { name: placeLabel(nearestPlace(p), lang) });
    const place = rememberPlace({ id: `pin-${p.lat.toFixed(5)},${p.lng.toFixed(5)}`, title, lat: p.lat, lng: p.lng });
    done(title, place.id);
  };
  const useGps = async () => {
    tap();
    setGpsError(false);
    setBusy('gps');
    const here = me ?? (await locateOnce());
    if (!here) {
      setBusy('');
      setGpsError(true);
      return;
    }
    setTarget({ point: here, seq: Date.now() });
    await pickPoint(here);
    setBusy('');
  };
  type Row = { key: string; title: string; sub: string; icon: keyof typeof Ionicons.glyphMap; pick: () => void };
  const rows: Row[] = [
    ...local.map((p) => ({ key: p.id, title: placeLabel(p, lang), sub: t(KIND[p.kind] ?? 'k_place'), icon: 'location' as const, pick: () => done(placeLabel(p, lang), p.id) })),
    ...extra.map((o) => ({ key: o.id, title: o.title, sub: [t('k_address'), o.subtitle].filter(Boolean).join(' · '), icon: 'navigate' as const, pick: () => done(o.city && !o.title.includes(o.city) ? `${o.title}, ${o.city}` : o.title, rememberPlace(o).id) })),
  ];
  const typing = text.trim().length > 0;
  const color = kind === 'pickup' ? PIN.pickup : PIN.dropoff;
  return (
    <Overlay visible={visible} onClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        {/* The map, with the pin fixed in its middle. */}
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <PickMap start={start} target={target} me={me} onMove={setCenter} onDrag={setDragging} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ alignItems: 'center', transform: [{ translateY: -38 }, { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }] }}>
              <TripPin kind={kind} label={kind === 'pickup' ? t('pinPickupHere') : t('pinDropoffHere')} />
            </Animated.View>
            <Animated.View style={{ position: 'absolute', width: 14, height: 6, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.25)', transform: [{ scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) }] }} />
          </View>
          {/* Close and the page's name, floating over the map. */}
          <View style={{ position: 'absolute', top: insets.top + 10, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }} pointerEvents="box-none">
            <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 }}>
              <Ionicons name="close" size={24} color={c.fg} />
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderRadius: 999, paddingHorizontal: 14, minHeight: 44, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
              <T size={16} weight="heavy">
                {kind === 'pickup' ? t('choosePickup') : t('chooseDropoff')}
              </T>
            </View>
          </View>
          {/* Suggestions while typing: over the map, ending right on top of the box, limited and scrolling. */}
          {typing ? (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: Math.round(screenH * 0.42), backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 }}>
              <ScrollView
                ref={(r) => {
                  listRef.current = r;
                }}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6 }}>
                {looking ? (
                  <T size={12} muted style={{ paddingVertical: 6 }}>
                    {t('searchingOnline')}
                  </T>
                ) : null}
                {text.trim().length >= 2 ? (
                  <Pressable accessibilityRole="button" onPress={() => done(text.trim())} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="create-outline" size={18} color={c.muted} />
                    </View>
                    <T size={15} weight="semibold" muted style={{ flex: 1 }}>
                      {t('useTyped', { text: text.trim() })}
                    </T>
                  </Pressable>
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
                      <T size={12} muted numberOfLines={1}>
                        {r.sub}
                      </T>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
        {/* The bottom: box (always right above the keyboard), then GPS and "use this spot". */}
        <View style={{ backgroundColor: c.surface, borderTopLeftRadius: typing ? 0 : 24, borderTopRightRadius: typing ? 0 : 24, paddingHorizontal: 14, paddingTop: 12, paddingBottom: keyboard ? keyboard + 10 : insets.bottom + 14, gap: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 8 }}>
          {!typing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="location" size={16} color={color} />
              <T size={13} weight="semibold" muted numberOfLines={1} style={{ flex: 1 }}>
                {dragging ? t('moveTheMap') : spot ? [spot.title, spot.sub].filter(Boolean).join(' · ') : t('moveTheMap')}
              </T>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.bg, borderWidth: 2, borderColor: c.accent, borderRadius: 16, paddingHorizontal: 12, minHeight: 54 }}>
            <Ionicons name="search" size={20} color={c.accent} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('placePlaceholder')}
              placeholderTextColor={c.muted}
              accessibilityLabel={label}
              returnKeyType="search"
              onSubmitEditing={() => (rows[0] ? rows[0].pick() : text.trim() ? done(text.trim()) : undefined)}
              style={[{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: '700', color: c.fg, paddingVertical: 10 }, autoDir(text, lang), { outlineWidth: 0, outlineStyle: 'none' } as object]}
            />
            {text ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('clearText')} onPress={() => setText('')} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close-circle" size={20} color={c.muted} />
              </Pressable>
            ) : null}
          </View>
          {!typing && !keyboard ? (
            <>
              {gpsError ? (
                <T size={13} color={c.danger}>
                  {t('gpsOff')}
                </T>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={!!busy}
                  onPress={useGps}
                  style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: PIN.me, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.8 : 1 })}>
                  {busy === 'gps' ? <ActivityIndicator color={PIN.me} /> : <Ionicons name="locate" size={20} color={PIN.me} />}
                  <T size={14} weight="heavy" color={PIN.me}>
                    {t('myLocation')}
                  </T>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!!busy}
                  onPress={async () => {
                    tap();
                    setBusy('spot');
                    await pickPoint(center);
                    setBusy('');
                  }}
                  style={({ pressed }) => ({ flex: 1.2, minHeight: 52, borderRadius: 16, backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.85 : 1 })}>
                  {busy === 'spot' ? <ActivityIndicator color={c.onAccent} /> : <Ionicons name="checkmark" size={20} color={c.onAccent} />}
                  <T size={14} weight="heavy" color={c.onAccent}>
                    {t('useThisSpot')}
                  </T>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Overlay>
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
  const { t, lang } = useT();
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
    <View style={{ backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.line, padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* A person moving furniture on a hand truck: help with loading and unloading. */}
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="human-dolly" size={26} color={c.onAccent} />
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
          {/* − 1 + in English and French; in Arabic the + comes first (on the right) and the − after it. */}
          {(() => {
            const less = <View key="less">{round('remove', t('helperLess'), () => onChange(Math.max(0, helpers - 1), rider), helpers === 0)}</View>;
            const more = <View key="more">{round('add', t('helperMore'), () => onChange(Math.min(4, helpers + 1), rider), helpers >= 4)}</View>;
            const count = (
              <T key="n" size={24} weight="heavy" style={{ minWidth: 26, textAlign: 'center' }}>
                {String(helpers)}
              </T>
            );
            return lang === 'ar' ? [more, count, less] : [less, count, more];
          })()}
          <T size={12} muted style={{ flex: 1 }}>
            {helpers ? t('helpersCount', { n: helpers }) : t('helpersNone')}
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
            <TextInput value={rider.name} onChangeText={(name) => onChange(helpers, { ...rider, name })} placeholder={t('riderName')} placeholderTextColor={c.muted} accessibilityLabel={t('riderName')} style={[input, autoDir(rider.name, lang)]} />
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
  const { width } = useWindowDimensions();
  const [notice, setNotice] = useState<Notice | null>(null);
  const y = useRef(new Animated.Value(-160)).current;
  const x = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(y, { toValue: -160, duration: 220, useNativeDriver: true }).start(() => setNotice(null));
  };
  // Swiped to the right or left, it flies off that way.
  const fling = (dir: number) => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(x, { toValue: dir * width, duration: 180, useNativeDriver: true }).start(() => setNotice(null));
  };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => x.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 70 || Math.abs(g.vx) > 0.6) fling(g.dx > 0 ? 1 : -1);
        else Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;
  useEffect(
    () =>
      onNotice((n) => {
        if (n.side !== side) return;
        play(n.sound);
        setNotice(n);
        x.setValue(0);
        y.setValue(-160);
        Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        if (timer.current) clearTimeout(timer.current);
        // It stays about ten seconds, then slides away by itself.
        timer.current = setTimeout(hide, 10000);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [side],
  );
  // A notice for one side never stays on screen after switching to the other side.
  useEffect(() => {
    setNotice(null);
    if (timer.current) clearTimeout(timer.current);
  }, [side]);
  if (!notice) return null;
  const vars = { ...notice.vars };
  if (typeof vars.price === 'number') vars.price = dh(vars.price, lang);
  const text = t(notice.key, vars);
  const opacity = x.interpolate({ inputRange: [-width, 0, width], outputRange: [0, 1, 0] });
  // It floats just under the top buttons, over the page title, so the buttons stay reachable.
  return (
    <Animated.View {...pan.panHandlers} style={{ position: 'absolute', top: insets.top + 68, left: 12, right: 12, opacity, transform: [{ translateY: y }, { translateX: x }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityHint={t('close')}
        onPress={() => {
          // Tapped: opens what it is about (the conversation, or the request / job), and goes away.
          hide();
          if (notice.chat) openTab('messages', notice.chat);
          else openTrip();
        }}
        style={{ backgroundColor: c.ink, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, elevation: 10 }}>
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
  useBack(visible, onClose);
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


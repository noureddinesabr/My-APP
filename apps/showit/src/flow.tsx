import { Ionicons } from '@expo/vector-icons';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';

import { MovingTruck } from './truck';
import { Animated, Easing, Image, Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { TextInput } from './field';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { previewAi, type Draft } from './ai';
import { useStore, type FloorEnd } from './store';
import { PIN } from './map/pins';
import { COMMON_ITEMS, findThings, fold, wordsOf, LOAD_CAT_ICON, LOAD_CATS, nearestWeight, type LoadCat, type NoteTag } from './choices';
import { autoDir } from './composer';
import { estimateTrip, RouteFields } from './extras';
import { translate, useT, type Key } from './i18n';
import { Overlay } from './overlay';
import { scanLoad, fmtKg, itemId, kgRange, suggestThings, totalKg, type LoadScan, type ScanItem } from './scan';
import { Chip, LoadDrawing, VehiclePicker, VehicleRow, vName } from './shared';
import { play } from './sounds';
import { Btn, Card, T, tap, useColors, useHoldRepeat, useKeyboardInset } from './ui';
import { bestFit, vehicleById, vehicleMisfit, type VehicleId } from './vehicles';

export type Media = {
  photoUri: string;
  photoBase64: string | null;
  /** Every photo of the load (the first is also photoUri / photoBase64). */
  photos: Shot[];
  voiceUri: string;
  voiceMs: number;
  said: string;
};
export const NO_MEDIA: Media = {
  photoUri: '',
  photoBase64: null,
  photos: [],
  voiceUri: '',
  voiceMs: 0,
  said: '',
};

/** The customer's answers to the few questions a photo can't answer (round 10: floors at both ends). */
export type Answers = { pickup: FloorEnd; dropoff: FloorEnd; all: '' | 'yes' };
export const NO_ANSWERS: Answers = { pickup: {}, dropoff: {}, all: '' };
/** Answers saved by an older version (one floor) start again empty. */
export const okAnswers = (a?: Partial<Answers>): Answers => (a && a.pickup && a.dropoff ? (a as Answers) : NO_ANSWERS);

/** Where from and where to, as picked (text shown, and the known place when there is one). */
export type TripRoute = { from: string; to: string; fromPlaceId?: string; toPlaceId?: string };
export const NO_ROUTE: TripRoute = { from: '', to: '' };

/** The load as checked on "What we saw": the scan plus the customer's own changes. */
export type Checked = {
  scan: LoadScan;
  /** The customer's own weight, when they changed the estimate (kg). */
  weightKg?: number | null;
  vehicle: VehicleId | null;
  care: NoteTag[];
  helpers: number;
  /** "Other things": the box being written in (only while it is open). */
  otherText?: string;
  /** "Other things" the customer added, each its own tile (written, or picked from the suggestions). */
  others?: string[];
  /** The customer doesn't mind which vehicle comes (round 6). */
  anyVehicle?: boolean;
  /** The trip's road distance once both ends are known (for the vehicle engine). */
  km?: number;
};

const CARE_TAGS: NoteTag[] = ['fragile', 'heavy', 'cover'];

// ---------------- Taking the photo or video ----------------

/** One photo of the load, small enough to send to the AI. */
export type Shot = { uri: string; base64: string };

/** The most photos sent to the AI for one load. */
export const MAX_PHOTOS = 6;

/** Opens the camera (one photo) or the gallery (several at once); returns the photos, or an error key. */
export async function capture(source: 'camera' | 'library', room = MAX_PHOTOS): Promise<Shot[] | Key | null> {
  if (Platform.OS === 'web' && source === 'camera') return cameraInBrowser();
  try {
    if (source === 'camera') {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return 'cameraNoPermission';
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: Math.max(1, room), orderedSelection: true });
    if (result.canceled || !result.assets.length) return null;
    const shots: Shot[] = [];
    for (const asset of result.assets.slice(0, Math.max(1, room))) {
      const small = await manipulateAsync(asset.uri, [{ resize: { width: 1024 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
      if (small.base64) shots.push({ uri: small.uri, base64: small.base64 });
    }
    return shots.length ? shots : 'photoFailed';
  } catch {
    return 'photoFailed';
  }
}

/**
 * In a phone's browser: ask for the camera itself (capture="environment"), so it opens straight
 * away instead of asking "photo or file"; the photo is made small for the AI with a canvas.
 */
function cameraInBrowser(): Promise<Shot[] | Key | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const data = canvas.toDataURL('image/jpeg', 0.7);
        resolve([{ uri: data, base64: data.split(',')[1] ?? '' }]);
      };
      img.onerror = () => resolve('photoFailed');
      img.src = url;
    };
    input.click();
  });
}

// ---------------- Shared pieces ----------------

/** What tapping a step does (set by the customer screens; the bar's look doesn't change). */
export const stepNav: { current: ((i: number) => void) | null } = { current: null };

/** The three steps as a progress bar: show it, details, send. Each can be tapped. */
export function StepsBar({ at }: { at: 0 | 1 | 2 }) {
  const c = useColors();
  const { t } = useT();
  const labels: Key[] = ['st_show', 'st_say', 'st_send'];
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`${at + 1} / 3 · ${t(labels[at])}`}>
      {labels.map((k, i) => (
        <Pressable
          key={k}
          accessibilityRole="button"
          accessibilityLabel={`${i + 1} · ${t(k)}`}
          onPress={() => {
            tap();
            stepNav.current?.(i);
          }}
          hitSlop={8}
          style={{ flex: 1, gap: 8, minHeight: 32 }}>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= at ? c.accent : c.line,
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 1.5,
                borderColor: i <= at ? c.accent : c.muted,
                backgroundColor: i <= at ? c.accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {i < at ? (
                <Ionicons name="checkmark" size={11} color={c.onAccent} />
              ) : (
                <T size={10} weight="bold" color={i <= at ? c.onAccent : c.muted}>
                  {String(i + 1)}
                </T>
              )}
            </View>
            <T size={13} weight="bold" color={i === at ? c.fg : c.muted}>
              {t(k)}
            </T>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function Corners({ size = 30, inset = 20, color = '#FFFFFF' }: { size?: number; inset?: number; color?: string }) {
  return (
    <>
      {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
        <View
          key={k}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderColor: color,
            ...(k[0] === 't' ? { top: inset, borderTopWidth: 3 } : { bottom: inset, borderBottomWidth: 3 }),
            ...(k[1] === 'l' ? { left: inset, borderLeftWidth: 3 } : { right: inset, borderRightWidth: 3 }),
            ...(k === 'tl' ? { borderTopLeftRadius: 14 } : k === 'tr' ? { borderTopRightRadius: 14 } : k === 'bl' ? { borderBottomLeftRadius: 14 } : { borderBottomRightRadius: 14 }),
          }}
        />
      ))}
    </>
  );
}

// ---------------- 1 · Show it: the first screen ----------------

export function ShowStep({
  photos,
  onShoot,
  onRemove,
  onAnalyse,
  error,
  onSkip,
}: {
  photos: Shot[];
  onShoot: (source: 'camera' | 'library') => void;
  onRemove: (index: number) => void;
  onAnalyse: () => void;
  error: Key | '';
  onSkip: () => void;
}) {
  const c = useColors();
  const { t, lang } = useT();
  // The camera takes exactly the room left on the screen (round 8: the first page never scrolls,
  // in any language): it grows and shrinks with the page, between a small minimum and a maximum.
  const [camReal, setCamReal] = useState(300);
  // On a short phone the drawing steps aside, so the words and the shutter keep their room.
  const compact = camReal < 290;
  const last = photos[photos.length - 1];
  const full = photos.length >= MAX_PHOTOS;
  return (
    <View style={{ flex: 1, gap: 16 }}>
      <View style={{ gap: 4, marginTop: 6 }}>
        {/* The title with a small truck driving beside it (owner's request). */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T size={lang === 'ar' ? 28 : lang === 'fr' ? 28 : 32} weight="heavy" style={{ flex: 1, letterSpacing: lang === 'ar' ? 0 : -1.1, lineHeight: lang === 'ar' ? 44 : lang === 'fr' ? 32 : 36 }}>
            {t('homeTitle')}
          </T>
          <MovingTruck />
        </View>
        {/* What happens after the photo, in one line. */}
        <T size={15} muted>
          {t('showSub')}
        </T>
      </View>
      <StepsBar at={0} />
      {/* A smaller camera on shorter phones, so the gallery and "continue without photo" stay in view. */}
      <View onLayout={(e) => setCamReal(Math.round(e.nativeEvent.layout.height))} style={{ flex: 1, minHeight: 170, maxHeight: photos.length ? 300 : 380, borderRadius: 32, backgroundColor: '#17181E', borderWidth: 1, borderColor: c.line, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: '#13141A', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 14 }, elevation: 8 }}>
        {last ? (
          <>
            <Image source={{ uri: last.uri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(19,20,26,0.45)' }} />
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('takePhoto')}
          disabled={full}
          onPress={() => onShoot('camera')}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', paddingTop: compact ? 26 : last ? '18%' : '20%' }}>
          {last || compact ? null : <LoadDrawing scale={0.8} />}
          <T size={14} weight={last ? 'bold' : 'regular'} color={last ? '#FFFFFF' : 'rgba(255,255,255,0.62)'} style={{ marginTop: last || compact ? 0 : 22, textAlign: 'center', paddingHorizontal: 24 }}>
            {full ? t('photosFull', { n: MAX_PHOTOS }) : last ? t('anotherAngle') : t('pointAtLoad')}
          </T>
        </Pressable>
        <Corners />
        {/* The shutter, with how many photos are taken so far. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('takePhoto')}
          disabled={full}
          onPress={() => onShoot('camera')}
          style={({ pressed }) => ({ position: 'absolute', bottom: compact ? 22 : 28, width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', opacity: full ? 0.4 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={photos.length ? 'add' : 'camera'} size={photos.length ? 32 : 26} color="#FFFFFF" />
          </View>
          {photos.length ? (
            <View style={{ position: 'absolute', top: -6, right: -6, minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <T size={13} weight="heavy" color="#13141A">
                {String(photos.length)}
              </T>
            </View>
          ) : null}
        </Pressable>
      </View>

      {photos.length ? (
        <>
          {/* The photos taken so far; any can be removed before the AI looks. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 10, paddingTop: 6, paddingEnd: 6 }}>
            {photos.map((p, i) => (
              <View key={p.uri + i} style={{ width: 68, height: 68 }}>
                <Image source={{ uri: p.uri }} style={{ width: 68, height: 68, borderRadius: 16 }} resizeMode="cover" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('removePhoto', { n: i + 1 })}
                  onPress={() => onRemove(i)}
                  hitSlop={8}
                  style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#13141A', borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={13} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
            {!full ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('chooseGallery')}
                onPress={() => onShoot('library')}
                style={{ width: 68, height: 68, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.muted, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="images-outline" size={22} color={c.muted} />
              </Pressable>
            ) : null}
          </ScrollView>
          {error ? (
            <T color={c.danger} style={{ textAlign: 'center' }}>
              {t(error)}
            </T>
          ) : null}
          <Btn title={photos.length === 1 ? t('analyseOne') : t('analyseMany', { n: photos.length })} icon="sparkles" onPress={onAnalyse} />
        </>
      ) : (
        <>
          <T size={13} muted style={{ textAlign: 'center', marginTop: -4 }}>
            {t('optionalNote')}
          </T>
          {error ? (
            <T color={c.danger} style={{ textAlign: 'center' }}>
              {t(error)}
            </T>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => onShoot('library')} style={{ flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 8, minHeight: 36, marginTop: -6 }}>
            <Ionicons name="images-outline" size={18} color={c.accent} />
            <T size={15} weight="bold" color={c.accent}>
              {t('chooseGallery')}
            </T>
          </Pressable>
          <Btn title={t('skipPhoto')} kind="ghost" small icon="arrow-forward" onPress={onSkip} />
        </>
      )}
    </View>
  );
}

// ---------------- Looking at the load ----------------

/** The photo with a scanning light while the AI looks; what it finds pops in one by one. */
export function ScanStep({
  media,
  photos = [],
  run,
  onDone,
}: {
  media: Media;
  photos?: Shot[];
  run: (onBatch: (from: number, to: number, total: number) => void) => Promise<LoadScan>;
  onDone: (scan: LoadScan | null, note: Key | '') => void;
}) {
  // What it is doing now: a calm line that changes every few seconds, and which photos are being read.
  const [phase, setPhase] = useState(0);
  const [batch, setBatch] = useState<{ from: number; to: number; total: number } | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setPhase((p) => (p + 1) % 4), 2600);
    return () => clearInterval(timer);
  }, []);
  // With several photos, the scanner moves from one to the next.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (photos.length < 2) return;
    const timer = setInterval(() => setShown((i) => (i + 1) % photos.length), 1300);
    return () => clearInterval(timer);
  }, [photos.length]);
  const uri = photos[shown]?.uri ?? media.photoUri;
  const c = useColors();
  const { t } = useT();
  const sweep = useRef(new Animated.Value(0)).current;
  const [found, setFound] = useState<ScanItem[]>([]);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    let dead = false;
    run((from, to, total) => !dead && setBatch({ from, to, total }))
      .then((scan) => {
        if (dead) return;
        // Show what was found one by one, then move on.
        scan.items.forEach((item, i) =>
          setTimeout(
            () => {
              if (dead) return;
              setFound((f) => [...f, item]);
              play('tick');
            },
            260 * (i + 1),
          ),
        );
        setTimeout(() => !dead && done.current(scan, ''), 260 * (scan.items.length + 1) + 700);
      })
      .catch((e: { code?: string }) => !dead && done.current(null, e?.code === 'no_key' ? 'scanNoAi' : e?.code === 'no_images' ? 'scanNoImages' : 'scanFailed'));
    return () => {
      dead = true;
      loop.stop();
    };
    // Runs once for this photo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flex: 1, gap: 18 }}>
      <StepsBar at={0} />
      <View
        style={{
          height: 360,
          borderRadius: 32,
          overflow: 'hidden',
          backgroundColor: '#17181E',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {uri ? (
          <Image
            source={{ uri }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            resizeMode="cover"
          />
        ) : (
          <LoadDrawing scale={0.8} />
        )}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(19,20,26,0.25)',
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 3,
            backgroundColor: c.accent,
            shadowColor: c.accent,
            shadowOpacity: 0.9,
            shadowRadius: 12,
            elevation: 6,
            transform: [
              {
                translateY: sweep.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 357],
                }),
              },
            ],
          }}
        />
        <Corners />
      </View>
      {photos.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: -6 }}>
          {photos.map((p, i) => (
            <Image key={p.uri + i} source={{ uri: p.uri }} style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 2, borderColor: i === shown ? c.accent : 'transparent', opacity: i === shown ? 1 : 0.6 }} resizeMode="cover" />
          ))}
        </View>
      ) : null}
      <View style={{ alignItems: 'center', gap: 14 }}>
        <T size={20} weight="heavy">
          {t('scanning')}
        </T>
        <T size={14} muted style={{ marginTop: -8 }}>
          {found.length ? '' : t((['scanSlow1', 'scanSlow2', 'scanSlow3', 'scanSlow4'] as const)[phase])}
        </T>
        {batch && batch.total > batch.to - batch.from + 1 ? (
          <T size={12} muted style={{ marginTop: -8 }}>
            {t('scanBatch', { a: batch.from, b: batch.to, n: batch.total })}
          </T>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
          }}>
          {found.map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: 999,
                paddingHorizontal: 12,
                minHeight: 36,
              }}>
              <Ionicons name="checkmark-circle" size={16} color={c.ok} />
              <T size={14} weight="bold">
                {item.count > 1 ? `${item.name} ×${item.count}` : item.name}
              </T>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ---------------- What we saw: everything is one tap from being fixed ----------------

export function SawStep({
  media,
  checked,
  setChecked,
  answers,
  setAnswers,
  note,
  onMorePhoto,
  onRetake,
  onNext,
  route,
  setRoute,
}: {
  media: Media;
  checked: Checked;
  setChecked: (c: Checked) => void;
  answers: Answers;
  setAnswers: (a: Answers) => void;
  note: Key | '';
  onMorePhoto: () => void;
  onRetake: () => void;
  onNext: () => void;
  /** Pickup and destination, chosen on this page right under the load (round 6). */
  route: TripRoute;
  setRoute: (r: TripRoute) => void;
}) {
  const c = useColors();
  const { t, lang } = useT();
  const [adding, setAdding] = useState(false);
  const [picker, setPicker] = useState(false);
  const [editingKg, setEditingKg] = useState(false);
  // Round 10: one item's weight being changed (tap its weight); the total then follows the items.
  const [editItem, setEditItem] = useState<string | null>(null);
  const { scan } = checked;
  const own = checked.weightKg ?? null;
  // Without photos nobody can estimate the weight (furniture or cement?): only the customer's own number counts.
  // Also when the photos couldn't be read (no connection, AI off, any problem): the same choices,
  // with the photos kept on top, so nobody is left in front of an empty list.
  const byHand = !(media.photos.length || media.photoUri) || !scan.items.length;
  const kg = own || (byHand ? 0 : totalKg(scan.items));
  const range = own ? { low: own, high: own } : kgRange(kg);
  const vehicle = chosenVehicle(checked);
  // The trip's distance feeds the vehicle engine (a triporteur isn't offered between cities).
  const routeKm = estimateTrip(route.fromPlaceId, route.toPlaceId, 'smallVan', 0)?.km ?? 0;
  useEffect(() => {
    if ((checked.km ?? 0) !== routeKm) setChecked({ ...checked, km: routeKm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKm]);
  const setItems = (items: ScanItem[]) => setChecked({ ...checked, scan: { ...scan, items } });
  const latestItems = useRef(scan.items);
  latestItems.current = scan.items;
  const change = (id: string, patch: Partial<ScanItem>) => setItems(scan.items.map((i) => (i.id === id ? { ...i, ...patch, sure: true } : i)));
  // The weight is always said to be an estimate: nobody weighed the load.
  const summary = byHand ? '' : [scan.summary, kg ? t('kgEstimate', { kg: fmtKg(own ?? roundKg(kg), lang) }) : '', kg ? vName(t, vehicle) : ''].filter(Boolean).join(' · ');
  const photos = media.photos.length ? media.photos.map((p) => p.uri) : media.photoUri ? [media.photoUri] : [];
  // The same place picked twice (pins on top of each other, no distance): ask for another destination.
  const sameSpot = !!estimateTrip(route.fromPlaceId, route.toPlaceId, vehicle, 0)?.same;

  return (
    <View style={{ gap: 16 }}>
      <StepsBar at={0} />
      {photos.length ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={26} weight="heavy">
                {byHand ? t('loadPageTitle') : t('sawTitle')}
              </T>
              {summary ? (
                <T size={15} weight="bold" color={c.accent}>
                  {summary}
                </T>
              ) : null}
            </View>
            {/* Start again with new photos: dark, with a circling arrow, so it is easy to find. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('retakeLong')}
              onPress={() => {
                tap();
                onRetake();
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.ink, borderRadius: 999, paddingStart: 8, paddingEnd: 14, minHeight: 40, marginTop: 4, opacity: pressed ? 0.85 : 1 })}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="refresh" size={16} color={c.onAccent} />
              </View>
              <T size={14} weight="bold" color={c.onInk}>
                {t('retakeShort')}
              </T>
            </Pressable>
          </View>
          {/* Every photo, side by side and all the same size; more photos make them smaller so they fit the row. */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {photos.map((uri, i) => (
              <View key={uri + i} style={{ flex: 1, aspectRatio: photos.length === 1 ? 16 / 9 : photos.length === 2 ? 4 / 3 : 1, borderRadius: photos.length > 3 ? 12 : 18, overflow: 'hidden', backgroundColor: '#17181E' }}>
                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={t('photoN', { n: i + 1 })} />
              </View>
            ))}
          </View>
        </View>
      ) : (
        // No photo: the same list, filled by hand (the question itself is the title of the box below).
        <View style={{ gap: 4 }}>
          <T size={26} weight="heavy">
            {t('loadPageTitle')}
          </T>
          {summary ? (
            <T size={15} weight="bold" color={c.accent}>
              {summary}
            </T>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onRetake} style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            <Ionicons name="camera-outline" size={16} color={c.accent} />
            <T size={14} weight="bold" color={c.accent}>
              {t('takePhoto')}
            </T>
          </Pressable>
        </View>
      )}
      {/* The photos couldn't be read: one friendly line, then the choices right under it. */}
      {byHand && photos.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.warnSoft, borderRadius: 14, padding: 12 }}>
          <Ionicons name="hand-left-outline" size={18} color={c.warn} />
          <T size={14} weight="bold" color={c.warn} style={{ flex: 1 }}>
            {t('scanFailedPick')}
          </T>
        </View>
      ) : note ? (
        <View style={{ backgroundColor: c.warnSoft, borderRadius: 14, padding: 12 }}>
          <T size={14} color={c.warn}>
            {t(note)}
          </T>
        </View>
      ) : null}

      {/* Without photos: the six main kinds to tap, their quick picks, and "other things". */}
      {byHand ? <KindsBox checked={checked} setChecked={setChecked} /> : null}

      {/* The items, each with its count. */}
      {!byHand ? (
      <Card style={{ gap: 4, paddingVertical: 8 }}>
        {scan.items.length ? null : (
          <T muted style={{ paddingVertical: 8 }}>
            {t('sawEmpty')}
          </T>
        )}
        {scan.items.map((item, i) => (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              minHeight: 52,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: c.line,
              opacity: item.sure ? 1 : 0.7,
            }}>
            <View style={{ flex: 1 }}>
              <T size={16} weight="bold">
                {item.name}
              </T>
              {/* Each item's weight can be changed: tap it (round 10). */}
              {item.kgEach ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}: ${t('kgEachEdit', { kg: fmtKg(item.kgEach, lang) })}`}
                  hitSlop={6}
                  onPress={() => {
                    tap();
                    setEditItem(editItem === item.id ? null : item.id);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 2 }}>
                  <T size={12} weight="semibold" color={c.accent}>
                    {t('kgEachEdit', { kg: fmtKg(item.kgEach, lang) })}
                  </T>
                  <Ionicons name="create-outline" size={13} color={c.accent} />
                </Pressable>
              ) : null}
              {!item.sure ? (
                <T size={12} color={c.warn} weight="semibold">
                  {`? ${t('notSure')}`}
                </T>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name} −1`}
              onPress={() => (item.count > 1 ? change(item.id, { count: item.count - 1 }) : setItems(scan.items.filter((x) => x.id !== item.id)))}
              style={roundBtn(c.raised)}>
              <Ionicons name={item.count > 1 ? 'remove' : 'trash-outline'} size={18} color={c.fg} />
            </Pressable>
            <T size={17} weight="heavy" style={{ minWidth: 30, textAlign: 'center' }}>
              {String(item.count)}
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} +1`} onPress={() => change(item.id, { count: item.count + 1 })} style={roundBtn(c.raised)}>
              <Ionicons name="add" size={18} color={c.fg} />
            </Pressable>
          </View>
        )).flatMap((row, i) => {
          const item = scan.items[i];
          return editItem === item.id
            ? [
                row,
                <View key={`w-${item.id}`} style={{ paddingBottom: 10 }}>
                  <WeightEditor
                    min={1}
                    kg={item.kgEach}
                    onChange={(v) =>
                      // The total follows the items again (a total typed earlier gives way).
                      setChecked({ ...checked, weightKg: undefined, scan: { ...scan, items: scan.items.map((x) => (x.id === item.id ? { ...x, kgEach: v, sure: true } : x)) } })
                    }
                    onDone={() => setEditItem(null)}
                  />
                </View>,
              ]
            : [row];
        })}
        <Pressable
          accessibilityRole="button"
          onPress={() => setAdding(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            minHeight: 48,
            borderTopWidth: scan.items.length ? 1 : 0,
            borderTopColor: c.line,
          }}>
          <Ionicons name="add-circle" size={22} color={c.accent} />
          <T size={15} weight="bold" color={c.accent}>
            {t('addItem')}
          </T>
        </Pressable>
      </Card>
      ) : null}

      {/* Pickup and destination, right under what is being moved (round 6). */}
      <RouteFields
        from={{ text: route.from, id: route.fromPlaceId }}
        to={{ text: route.to, id: route.toPlaceId }}
        onFrom={(v, id) => setRoute({ ...route, from: v, fromPlaceId: id })}
        onTo={(v, id) => setRoute({ ...route, to: v, toPlaceId: id })}
        km={estimateTrip(route.fromPlaceId, route.toPlaceId, vehicle, checked.helpers)?.km}
      />
      {sameSpot ? (
        <T size={13} weight="bold" color={c.danger}>
          {t('samePlaces')}
        </T>
      ) : null}

      {/* Weight (an estimate, which the customer can change) and vehicle. */}
      {kg || byHand ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <T size={14} muted weight="semibold">
              {t('weightTitle')}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('editWeight')}
              onPress={() => {
                tap();
                setEditingKg(!editingKg);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 34, paddingHorizontal: 10, borderRadius: 999, backgroundColor: editingKg ? c.accent : c.raised }}>
              <Ionicons name={editingKg ? 'checkmark' : 'create-outline'} size={15} color={editingKg ? c.onAccent : c.accent} />
              <T size={13} weight="bold" color={editingKg ? c.onAccent : c.accent}>
                {editingKg ? t('ok') : kg ? t('edit') : t('addWeight')}
              </T>
            </Pressable>
          </View>
          {editingKg ? (
            <WeightEditor kg={own ?? (kg ? roundKg(kg) : 100)} onChange={(v) => setChecked({ ...checked, weightKg: v })} onDone={() => setEditingKg(false)} />
          ) : !kg ? (
            // Chosen by hand, no number given: the weight is simply left open.
            <View style={{ gap: 2 }}>
              <T size={18} weight="heavy">
                {t('weightUnknown')}
              </T>
              <T size={12} muted>
                {t('weightOptional')}
              </T>
            </View>
          ) : (
            <View style={{ gap: 2 }}>
              <T size={20} weight="heavy">
                {own ? t('weightYours', { kg: fmtKg(own, lang) }) : t('weightAbout', { low: fmtKg(range.low, lang), high: fmtKg(range.high, lang) })}
              </T>
              <T size={12} muted>
                {own ? t('weightYoursNote') : t('weightEstimateNote')}
              </T>
            </View>
          )}
          <VehicleRow id={vehicle} any={checked.anyVehicle} onChange={() => setPicker(true)} note={!checked.anyVehicle && kg && vehicleById(vehicle).maxKg >= range.high ? `✓ ${t('fitsOneTrip')}` : undefined} />
        </Card>
      ) : null}

      {/* Care tags the AI switched on; any can be switched off. */}
      <View style={{ gap: 8 }}>
        <T size={14} muted weight="semibold">
          {t('careTitle')}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CARE_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={t(`n_${tag}` as Key)}
              on={checked.care.includes(tag)}
              ai={scan.care.includes(tag)}
              onPress={() =>
                setChecked({
                  ...checked,
                  care: checked.care.includes(tag) ? checked.care.filter((x) => x !== tag) : [...checked.care, tag],
                })
              }
            />
          ))}
        </View>
      </View>

      {/* Round 10: the floor and the elevator at both ends; nothing is assumed, «لا أعرف» is a real
          answer, nothing here blocks the request, and each end folds into one line with «تعديل». */}
      <Card style={{ gap: 14 }}>
        <View style={{ gap: 2 }}>
          <T size={17} weight="heavy">
            {t('floorsTitle')}
          </T>
          <T size={12} muted>
            {t('floorsHint')}
          </T>
        </View>
        <FloorQuestion end="pickup" value={answers.pickup} onChange={(v) => setAnswers({ ...answers, pickup: v })} />
        <View style={{ height: 1, backgroundColor: c.line }} />
        <FloorQuestion end="dropoff" value={answers.dropoff} onChange={(v) => setAnswers({ ...answers, dropoff: v })} />
      </Card>

      <Btn title={t('looksRight')} icon="arrow-forward" disabled={(byHand ? !scan.goods.length && !(checked.others ?? []).length && !(checked.otherText ?? '').trim() : !scan.items.length) || !route.from.trim() || !route.to.trim() || sameSpot} onPress={onNext} />

      <AddItem visible={adding} title={photos.length ? t('addItemTitle') : t('otherThingsTitle')} onClose={() => setAdding(false)} onAdd={(item) => setItems(mergeItem(latestItems.current, item))} />
      <VehiclePicker
        visible={picker}
        value={vehicle}
        weightKg={kg ? roundKg(kg) : 0}
        km={routeKm}
        suggested={kg || routeKm ? suggestedVehicle(checked) : undefined}
        onPick={(id) => {
          setChecked({ ...checked, vehicle: id, anyVehicle: false });
          setPicker(false);
        }}
        any={checked.anyVehicle}
        onAny={() => {
          setChecked({ ...checked, anyVehicle: true });
          setPicker(false);
        }}
        onClose={() => setPicker(false)}
      />
    </View>
  );
}

/**
 * Which floor: − number + (ground up to the 100th; hold to keep going), the number springs a little at each step.
 * Untouched it reads "Ground floor" (nothing is sent until changed).
 */
function FloorStepper({ value, onChange, min = 0 }: { value: string; onChange: (f: string) => void; min?: number }) {
  const c = useColors();
  const { t } = useT();
  const n = Math.max(min, value === '' || value === 'ground' ? 0 : value === '4+' ? 4 : parseInt(value, 10) || 0);
  const pop = useRef(new Animated.Value(1)).current;
  const nRef = useRef(n);
  nRef.current = n;
  const set = (next: number) => {
    if (next < min || next > MAX_FLOOR) return;
    nRef.current = next;
    play('tick');
    pop.setValue(0.82);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    onChange(next === 0 ? 'ground' : String(next));
  };
  const hold = useHoldRepeat((delta) => set(nRef.current + delta));
  const btn = (icon: 'remove' | 'add', delta: number, label: string, off: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={off}
      onPressIn={() => hold.start(delta)}
      onPressOut={hold.stop}
      delayLongPress={60000}
      style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: icon === 'add' ? c.accent : c.raised, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.35 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
      <Ionicons name={icon} size={24} color={icon === 'add' ? c.onAccent : c.fg} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, direction: 'ltr', width: '100%' }}>
      {btn('remove', -1, t('floorDown'), n <= min)}
      <Animated.View style={{ flex: 1, alignItems: 'center', transform: [{ scale: pop }] }}>
        <T size={n === 0 ? 20 : 28} weight="heavy" style={{ textAlign: 'center' }}>
          {n === 0 ? t('floorGround') : String(n)}
        </T>
        {n > 0 ? (
          <T size={12} muted style={{ textAlign: 'center' }}>
            {t('floorWord')}
          </T>
        ) : null}
      </Animated.View>
      {btn('add', 1, t('floorUp'), n >= MAX_FLOOR)}
    </View>
  );
}

const MAX_FLOOR = 100;

/** «في الطابق 3 · بدون مصعد», «الطابق الأرضي», «لا نعرف الطابق»… for one end (shown folded and to the driver). */
export function floorSummary(e: FloorEnd, t: ReturnType<typeof useT>['t']) {
  if (e.floor === undefined) return t('floorNotGiven');
  if (e.floor === 'unknown') return t('floorUnknownShort');
  if (e.floor === 'ground') return t('floorGround');
  const lift = e.lift === 'yes' ? t('liftYesShort') : e.lift === 'no' ? t('liftNoShort') : t('liftUnknownShort');
  return `${t('floorN', { n: e.floor })} · ${lift}`;
}

/**
 * One end's floor (round 10): «الطابق الأرضي» · «طابق آخر» (− number +) · «لا أعرف», then, above the
 * ground floor, «هل يوجد مصعد؟» نعم · لا · لا أعرف. Nothing is chosen at the start; once answered it
 * folds into one line with «تعديل», and opens again any time before sending.
 */
function FloorQuestion({ end, value, onChange }: { end: 'pickup' | 'dropoff'; value: FloorEnd; onChange: (v: FloorEnd) => void }) {
  const c = useColors();
  const { t } = useT();
  const complete = value.floor === 'ground' || value.floor === 'unknown' || (typeof value.floor === 'number' && !!value.lift);
  const [open, setOpen] = useState(!complete);
  const color = end === 'pickup' ? PIN.pickup : PIN.dropoff;
  const title = t(end === 'pickup' ? 'floorPickup' : 'floorDropoff');
  const pick = (v: FloorEnd) => {
    tap();
    onChange(v);
    // Ground floor and «لا أعرف» are complete answers: fold a moment later.
    if (v.floor === 'ground' || v.floor === 'unknown') setTimeout(() => setOpen(false), 350);
  };
  const head = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 10, height: 10, borderRadius: end === 'pickup' ? 5 : 2, backgroundColor: color }} />
      <T size={15} weight="bold" style={{ flex: 1 }}>
        {title}
      </T>
    </View>
  );
  if (!open) {
    return (
      <View style={{ gap: 6 }}>
        {head}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.raised, borderRadius: 14, paddingHorizontal: 12, minHeight: 46 }}>
          <Ionicons name={value.floor === 'unknown' ? 'help-circle-outline' : 'checkmark-circle'} size={20} color={value.floor === 'unknown' ? c.muted : c.ok} />
          <T size={15} weight="semibold" style={{ flex: 1 }}>
            {floorSummary(value, t)}
          </T>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('editLoad')}: ${title}`}
            hitSlop={8}
            onPress={() => {
              tap();
              setOpen(true);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 6 }}>
            <Ionicons name="create-outline" size={16} color={c.accent} />
            <T size={14} weight="bold" color={c.accent}>
              {t('editLoad')}
            </T>
          </Pressable>
        </View>
      </View>
    );
  }
  const other = typeof value.floor === 'number';
  return (
    <View style={{ gap: 10 }}>
      {head}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label={t('floorGround')} on={value.floor === 'ground'} onPress={() => pick({ floor: 'ground' })} />
        <Chip label={t('floorOther')} on={other} onPress={() => pick({ floor: other ? value.floor : 1, lift: value.lift })} />
        <Chip label={t('dontKnow')} on={value.floor === 'unknown'} onPress={() => pick({ floor: 'unknown' })} />
      </View>
      {other ? (
        <>
          <T size={12} muted>
            {t('floorStepHelp')}
          </T>
          <FloorStepper min={1} value={String(value.floor)} onChange={(f) => onChange({ ...value, floor: parseInt(f, 10) || 1 })} />
          <T size={14} weight="bold">
            {t('q_lift')}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['yes', 'no', 'unknown'] as const).map((v) => (
              <Chip
                key={v}
                label={t(v === 'unknown' ? 'dontKnow' : v)}
                on={value.lift === v}
                onPress={() => {
                  tap();
                  onChange({ ...value, lift: v });
                  setTimeout(() => setOpen(false), 350);
                }}
              />
            ))}
          </View>
        </>
      ) : null}
      {value.floor === 'unknown' || value.lift === 'unknown' ? (
        <View style={{ flexDirection: 'row', gap: 8, backgroundColor: c.warnSoft, borderRadius: 12, padding: 10 }}>
          <Ionicons name="information-circle-outline" size={18} color={c.warn} />
          <T size={12} style={{ flex: 1 }}>
            {t('floorUnknownTip')}
          </T>
        </View>
      ) : null}
    </View>
  );
}

/** Changing the weight: − and + in sensible steps (hold to keep going), or typing the number; OK closes it. */
function WeightEditor({ kg, onChange, onDone, min = 10 }: { kg: number; onChange: (kg: number) => void; onDone: () => void; min?: number }) {
  const c = useColors();
  const { t, lang } = useT();
  const [typed, setTyped] = useState(String(kg));
  useEffect(() => setTyped(String(kg)), [kg]);
  const kgRef = useRef(kg);
  kgRef.current = kg;
  const stepOf = (v: number) => (v >= 2000 ? 500 : v >= 500 ? 100 : v >= 50 || min >= 10 ? 10 : 1);
  const set = (v: number) => {
    const next = Math.max(min, Math.min(40000, Math.round(v)));
    kgRef.current = next;
    onChange(next);
  };
  // Holding keeps going (round 8); each step follows the size of the weight at that moment.
  const hold = useHoldRepeat((dir) => set(kgRef.current + Math.sign(dir) * stepOf(dir < 0 ? kgRef.current - 1 : kgRef.current)));
  const btn = (icon: 'remove' | 'add', label: string, delta: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => hold.start(delta)}
      onPressOut={hold.stop}
      delayLongPress={60000}
      style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: c.line, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={22} color={c.fg} />
    </Pressable>
  );
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, direction: 'ltr' }}>
        {btn('remove', t('weightLess'), -1)}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
          <TextInput
            value={typed}
            onChangeText={(v) => {
              const d = v.replace(/[^0-9]/g, '').slice(0, 5);
              setTyped(d);
              if (Number(d) > 0) set(Number(d));
            }}
            onSubmitEditing={onDone}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            accessibilityLabel={t('weightTitle')}
            style={[{ minWidth: 90, fontSize: 30, fontWeight: '800', color: c.fg, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: c.accent, paddingVertical: 2 }, { outlineWidth: 0, outlineStyle: 'none' } as object]}
          />
          <T size={16} weight="bold" muted>
            {lang === 'ar' ? 'كلغ' : 'kg'}
          </T>
        </View>
        {btn('add', t('weightMore'), 1)}
      </View>
      <T size={12} muted style={{ textAlign: 'center' }}>
        {t('weightEditHint')}
      </T>
    </View>
  );
}

/** Rounds an estimate so it reads as one (≈ 300 kg, not 298 kg). */
/** One rounding for every weight shown (and sent): nearest 10 kg under a tonne, nearest 100 kg above. */
export const roundKg = (kg: number) => (kg >= 1000 ? Math.round(kg / 100) * 100 : Math.round(kg / 10) * 10 || 10);

const roundBtn = (bg: string) => ({
  width: 38,
  height: 38,
  borderRadius: 19,
  backgroundColor: bg,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T size={15} weight="heavy">
        {label}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

/** Adds one, or one more of something already on the list. */
function mergeItem(items: ScanItem[], item: ScanItem) {
  const same = items.find((i) => i.name.toLowerCase() === item.name.toLowerCase());
  return same ? items.map((i) => (i === same ? { ...i, count: i.count + 1, sure: true } : i)) : [...items, item];
}

/** The scan's vehicle while it can carry the list; a bigger one once the list outgrows it. */
export function suggestedVehicle(checked: Checked): VehicleId {
  const high = checked.weightKg ? checked.weightKg : kgRange(totalKg(checked.scan.items)).high;
  const km = checked.km ?? 0;
  return !vehicleMisfit(checked.scan.vehicle, high, km) ? checked.scan.vehicle : bestFit(high, km);
}

/** The vehicle in use: the customer's own choice unless it no longer suits (then the suggestion). */
export const chosenVehicle = (checked: Checked): VehicleId => {
  const high = checked.weightKg ? checked.weightKg : kgRange(totalKg(checked.scan.items)).high;
  return checked.vehicle && !vehicleMisfit(checked.vehicle, high, checked.km ?? 0) ? checked.vehicle : suggestedVehicle(checked);
};

/**
 * "What are you moving?" (no photo, or the photos couldn't be read): the kinds of load, one tap
 * each (one or several), and «Other things», which opens a box to write anything else in any
 * language. Suggestions come as soon as a letter is typed (formal Arabic, Darija, French, English);
 * Add (or the keyboard's enter key) turns what was written into its own tile, with ✕ to remove it.
 */
function KindsBox({ checked, setChecked }: { checked: Checked; setChecked: (c: Checked) => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const { scan } = checked;
  const chosen = scan.goods.filter((g): g is LoadCat => (LOAD_CATS as readonly string[]).includes(g));
  const others = checked.others ?? [];
  const typing = checked.otherText ?? '';
  const otherOpen = checked.otherText !== undefined;
  // Round 9 (#61): once something is picked (a kind, a thing written, or «Other things» opened),
  // the kinds not picked fold away; «Add another kind» brings them back until the next pick.
  const [showAll, setShowAll] = useState(false);
  const folded = !showAll && (chosen.length > 0 || others.length > 0 || otherOpen);
  const toggle = (cat: LoadCat) => {
    tap();
    const goods = chosen.includes(cat) ? scan.goods.filter((g) => g !== cat) : [...scan.goods, cat];
    setShowAll(false);
    setChecked({ ...checked, scan: { ...scan, goods } });
  };
  const addOther = (name: string) => {
    const words = name.trim();
    if (!words) return;
    play('pop');
    setShowAll(false);
    const known = others.some((o) => fold(o) === fold(words));
    setChecked({ ...checked, others: known ? others : [...others, words], otherText: '' });
  };
  const pickKind = (cat: LoadCat) => {
    play('pop');
    setShowAll(false);
    setChecked({ ...checked, scan: { ...scan, goods: chosen.includes(cat) ? scan.goods : [...scan.goods, cat] }, otherText: '' });
  };
  // Suggestions for what is being typed: a kind of load whose name matches, then things people move.
  const q = fold(typing);
  const kindHits = q
    ? LOAD_CATS.filter((cat) => !chosen.includes(cat) && (['ar', 'fr', 'en'] as const).some((l) => wordsOf(fold(translate(l, `g_${cat}` as Key))).some((w) => w.startsWith(q)))).slice(0, 2)
    : [];
  const thingHits = q ? findThings(typing, 8).filter((th) => !others.some((o) => fold(o) === fold(th[lang]))).slice(0, 6 - kindHits.length) : [];
  // Round 8: every kind stays in view as a small chip (no folding); the chosen ones are filled, and
  // each thing written under «Other things» becomes a chip of the same look, next to them.
  const chip = (key: string, label: string, icon: string, on: boolean, press: () => void, dashed?: boolean) => (
    <Pressable
      key={key}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      unstable_pressDelay={60}
      onPress={press}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderStyle: dashed && !on ? 'dashed' : 'solid', borderColor: on || dashed ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface, opacity: pressed ? 0.85 : 1, maxWidth: '100%' })}>
      <Ionicons name={(on && !dashed ? 'checkmark' : icon) as keyof typeof Ionicons.glyphMap} size={16} color={on ? c.onAccent : c.accent} />
      <T size={13} weight="bold" color={on ? c.onAccent : dashed ? c.accent : c.fg} style={{ flexShrink: 1 }} numberOfLines={2}>
        {label}
      </T>
    </Pressable>
  );
  const suggestion = (key: string, label: string, icon: keyof typeof Ionicons.glyphMap, press: () => void) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} onPress={press} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: c.accent, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 })}>
      <Ionicons name={icon} size={16} color={c.accent} />
      <T size={14} weight="bold" color={c.fg} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <T size={19} weight="heavy">
          {t('whatMoveBox')}
        </T>
        <T size={13} muted>
          {t('whatMoveHint')}
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(folded ? LOAD_CATS.filter((cat) => chosen.includes(cat)) : LOAD_CATS).map((cat) => chip(cat, t(`gs_${cat}` as Key), LOAD_CAT_ICON[cat], chosen.includes(cat), () => toggle(cat)))}
        {/* Things written under «Other things»: the same chips, filled, with ✕ to remove. */}
        {others.map((o) => (
          <View key={`o-${o}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingStart: 12, paddingEnd: 4, borderRadius: 999, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.accent, maxWidth: '100%' }}>
            <Ionicons name="checkmark" size={16} color={c.onAccent} />
            <T size={13} weight="bold" color={c.onAccent} style={{ flexShrink: 1 }} numberOfLines={2}>
              {o}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('removeOther', { name: o })}
              hitSlop={6}
              onPress={() => {
                tap();
                setChecked({ ...checked, others: others.filter((x) => x !== o) });
              }}
              style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' }}>
              <Ionicons name="close" size={15} color={c.onAccent} />
            </Pressable>
          </View>
        ))}
        {folded ? chip('more', t('kindsMore'), 'add', false, () => { tap(); setShowAll(true); }, true) : null}
        {chip('other', t('g_other'), otherOpen ? 'chevron-up' : 'add', false, () => {
          tap();
          // Tapping again with nothing written closes the box (the added chips stay).
          setChecked({ ...checked, otherText: otherOpen && !typing.trim() ? undefined : typing });
        }, true)}
      </View>
      {otherOpen ? (
        <View style={{ gap: 8 }}>
          {/* Suggestions in one sideways row of a fixed height right above the box: they come and go
              while typing without ever changing the page's height, so nothing shakes. */}
          {kindHits.length || thingHits.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ height: 40, flexGrow: 0 }} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
              {kindHits.map((cat) => suggestion(`k${cat}`, t(`g_${cat}` as Key), LOAD_CAT_ICON[cat] as keyof typeof Ionicons.glyphMap, () => pickKind(cat)))}
              {thingHits.map((th) => suggestion(th.id, th[lang], 'add-circle-outline', () => addOther(th[lang])))}
            </ScrollView>
          ) : (
            // The hint sits outside the sideways row (inside it, Android showed only its end), same height.
            <View style={{ height: 40, justifyContent: 'center' }}>
              <T size={13} muted numberOfLines={1}>
                {`✦ ${t('kindsTypeHint')}`}
              </T>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              autoFocus
              value={typing}
              onChangeText={(v) => setChecked({ ...checked, otherText: v })}
              placeholder={t('otherWhat')}
              placeholderTextColor={c.muted}
              accessibilityLabel={t('g_other')}
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={() => addOther(typing)}
              style={[{ flex: 1, minWidth: 0, height: 52, borderRadius: 16, borderWidth: 2, borderColor: c.accent, backgroundColor: c.surface, paddingHorizontal: 14, fontSize: 16, color: c.fg }, autoDir(typing, lang), { outlineWidth: 0, outlineStyle: 'none' } as object]}
            />
            <Btn title={t('add')} small icon="add" disabled={!typing.trim()} onPress={() => addOther(typing)} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}


function AddItem({ visible, title, onClose, onAdd }: { visible: boolean; title: string; onClose: () => void; onAdd: (item: ScanItem) => void }) {
  const c = useColors();
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const { height: screenH } = useWindowDimensions();
  const store = useStore();
  const [text, setText] = useState('');
  const [smart, setSmart] = useState<{ name: string; kg: number }[]>([]);
  const [thinking, setThinking] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  useEffect(() => {
    if (visible) {
      setText('');
      setAdded([]);
    }
  }, [visible]);
  const add = (name: string, kgEach: number) => {
    onAdd({ id: itemId(), name, count: 1, kgEach, sure: true });
    play('pop');
    setAdded((a) => [...a, name]);
    setText('');
  };
  const q = text.trim();
  const matches = q ? findThings(q, 6) : [];
  // Smart suggestions a moment after typing stops (when the AI is available).
  const aiOn = !!store.aiKey || previewAi();
  useEffect(() => {
    setSmart([]);
    if (!visible || !aiOn || q.length < 3) return;
    let dead = false;
    const timer = setTimeout(() => {
      setThinking(true);
      suggestThings(store.aiKey, q, lang)
        .then((found) => !dead && setSmart(found.filter((f) => !matches.some((m) => fold(m[lang]) === fold(f.name)))))
        .catch(() => {})
        .finally(() => !dead && setThinking(false));
    }, 700);
    return () => {
      dead = true;
      clearTimeout(timer);
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, visible, lang]);
  const row = (key: string, name: string, kg: number, icon: keyof typeof Ionicons.glyphMap) => (
    <Pressable key={key} accessibilityRole="button" onPress={() => add(name, kg)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderTopWidth: 1, borderTopColor: c.line }}>
      <Ionicons name={icon} size={20} color={c.accent} />
      <T size={16} weight="bold" style={{ flex: 1 }}>
        {name}
      </T>
      <T size={12} muted>
        {`≈ ${fmtKg(kg, lang)}`}
      </T>
    </Pressable>
  );
  return (
    <Overlay visible={visible} onClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
      <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 16, paddingBottom: keyboard ? keyboard + 12 : insets.bottom + 20, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T size={20} weight="heavy" style={{ flex: 1 }}>
            {title}
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color={c.fg} />
          </Pressable>
        </View>
        {added.length ? (
          <T size={13} weight="bold" color={c.ok}>
            {`✓ ${added.join('، ')}`}
          </T>
        ) : null}
        {/* Above the box: what matches the letters typed (best nearest the box), or quick picks. */}
        <ScrollView style={{ maxHeight: Math.round(screenH * 0.38), flexGrow: 0 }} keyboardShouldPersistTaps="handled">
          {q ? (
            <View>
              {smart.length ? (
                <T size={12} weight="bold" color={c.live} style={{ paddingVertical: 4 }}>
                  {`✦ ${t('smartSuggest')}`}
                </T>
              ) : null}
              {smart.map((s2, i) => row(`ai${i}`, s2.name, s2.kg, 'sparkles-outline'))}
              {thinking && !smart.length ? (
                <T size={12} muted style={{ paddingVertical: 4 }}>
                  {`✦ ${t('smartSuggest')}…`}
                </T>
              ) : null}
              {[...matches].reverse().map((it) => row(it.id, it[lang], it.kg, 'add-circle-outline'))}
              {q.length >= 2 ? row('typed', t('addTyped', { text: q }), matches[0]?.kg ?? 20, 'create-outline') : null}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {COMMON_ITEMS.map((it) => (
                <Chip key={it.id} icon={it.icon as keyof typeof Ionicons.glyphMap} label={t(`it_${it.id}` as Key)} on={false} onPress={() => add(t(`it_${it.id}` as Key), it.kg)} />
              ))}
            </View>
          )}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder={t('otherThingsHint')}
            placeholderTextColor={c.muted}
            accessibilityLabel={t('itemPlaceholder')}
            returnKeyType="done"
            onSubmitEditing={() => (q ? (matches[0] ? add(matches[0][lang], matches[0].kg) : add(q, 20)) : onClose())}
            style={[{ flex: 1, minWidth: 0, minHeight: 52, borderRadius: 16, backgroundColor: c.surface, borderWidth: 2, borderColor: c.accent, paddingHorizontal: 14, fontSize: 16, color: c.fg }, autoDir(text, lang), { outlineWidth: 0, outlineStyle: 'none' } as object]}
          />
          <Btn title={added.length && !q ? t('ok') : t('add')} small disabled={!q && !added.length} onPress={() => (q ? add(q, matches[0]?.kg ?? 20) : onClose())} />
        </View>
      </View>
    </Overlay>
  );
}

// ---------------- From the checked load to the request card ----------------

/** The card's starting point from "What we saw" and the answers (route, time and price come from "Say it"). */
/** The weight used everywhere: the customer's own number if they changed it, otherwise the estimate from the items. */
export const checkedKg = (checked: Checked) => checked.weightKg || totalKg(checked.scan.items);

export function draftFromChecked(checked: Checked, answers: Answers, t: ReturnType<typeof useT>['t']): Draft {
  const kg = checkedKg(checked);
  const tags: NoteTag[] = [...checked.care];
  // Round 10: the floors go as `floors` (both ends), read by each side in their own language.
  return {
    goods: checked.scan.goods[0] ?? '',
    // Chosen by hand (no photo): the kinds, then what was written under "Other things".
    load: checked.scan.items.length
      ? checked.scan.items.map((i) => (i.count > 1 ? `${i.name} ×${i.count}` : i.name)).join(', ')
      : [...checked.scan.goods.filter((g) => g !== 'other').map((g) => t(`g_${g}` as Key)), ...(checked.others ?? []), (checked.otherText ?? '').trim()].filter(Boolean).join(' · '),
    weightKg: kg ? roundKg(kg) : 0,
    vehicle: chosenVehicle(checked),
    from: '',
    to: '',
    when: 'now',
    price: 300,
    fairMin: 0,
    fairMax: 0,
    km: 0,
    noteTags: tags,
    // The message box for the driver starts empty; the floor goes with the load instead.
    notes: '',
    floors: { pickup: answers.pickup, dropoff: answers.dropoff },
    anyVehicle: checked.anyVehicle || undefined,
    loadKinds: checked.scan.items.length ? undefined : checked.scan.goods.filter((g) => g !== 'other'),
    loadOthers: checked.scan.items.length ? undefined : [...(checked.others ?? []), (checked.otherText ?? '').trim()].filter(Boolean),
    helpers: checked.helpers,
    rideAlong: false,
  };
}

/** Runs the AI on the photo (or a further photo, adding to the list). */

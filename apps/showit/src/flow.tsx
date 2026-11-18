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
import { setBarsOpen, useCameraFull } from './home';
import { PIN } from './map/pins';
import { COMMON_ITEMS, findThings, fold, wordsOf, LOAD_CAT_ICON, LOAD_CATS, nearestWeight, type LoadCat, type NoteTag } from './choices';
import { autoDir } from './composer';
import { estimateTrip, RouteFields } from './extras';
import { translate, useT, type Key } from './i18n';
import { Overlay } from './overlay';
import { scanLoad, fmtKg, itemId, kgRange, suggestThings, totalKg, type LoadScan, type ScanItem } from './scan';
import { Chip, LoadDrawing, VehiclePicker, VehicleRow, vName } from './shared';
import { play } from './sounds';
import { Box, BoxHead, Head, IconDot, itemIcon, Seg, Stat, Tech } from './stitch';
import { Btn, Card, ColorsContext, FadeIn, Glow, mainScroll, T, Tag, tap, useColors, useHoldRepeat, useKeyboardInset } from './ui';
import { bestFit, vehicleById, vehicleMisfit, type RouteEnds, type VehicleId } from './vehicles';
import { fade, stitchDark } from './theme';
import { LinearGradient } from 'expo-linear-gradient';

/** Owner's report #1: what to photograph, shown on the camera before the first photo (from the owner's Stitch export). */
// Owner's edit (18 Nov 2026): example photos of things only — furniture, boxes, cement — never a
// person; a different one each time the camera opens.
const CAMERA_EXAMPLES = [
  require('../assets/photos/camera-boxes-1.webp'),
  require('../assets/photos/camera-cement.webp'),
  require('../assets/photos/camera-table.webp'),
];
let exampleTurn = Math.floor(Math.random() * CAMERA_EXAMPLES.length);

/** Owner's report #4: a 3D picture for each kind of load (Fluent Emoji 3D, MIT, see credits). */
const KIND_PICTURES: Partial<Record<LoadCat, number>> = {
  household: require('../assets/kinds/household.webp'),
  appliances: require('../assets/kinds/appliances.webp'),
  building: require('../assets/kinds/building.webp'),
  commercial: require('../assets/kinds/commercial.webp'),
  food: require('../assets/kinds/food.webp'),
  farm: require('../assets/kinds/farm.webp'),
  industrial: require('../assets/kinds/industrial.webp'),
  auto: require('../assets/kinds/auto.webp'),
  parcels: require('../assets/kinds/parcels.webp'),
};

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
export type TripRoute = {
  from: string;
  to: string;
  fromPlaceId?: string;
  toPlaceId?: string;
  /** Owner's edit #5: the place chosen first (city, town…) when a street or neighbourhood was then
   * picked inside it; `from` / `fromPlaceId` are then the street (more exact for the driver). */
  fromBase?: { text: string; id?: string };
  toBase?: { text: string; id?: string };
};
export const NO_ROUTE: TripRoute = { from: '', to: '' };

/** A street or neighbourhood picked inside one end (owner's edit #5); '' takes it away again. */
export function withArea(r: TripRoute, end: 'from' | 'to', name: string, id?: string): TripRoute {
  const baseKey = end === 'from' ? 'fromBase' : 'toBase';
  const idKey = end === 'from' ? 'fromPlaceId' : 'toPlaceId';
  const base = r[baseKey] ?? { text: r[end], id: r[idKey] };
  if (!name.trim()) return { ...r, [end]: base.text, [idKey]: base.id, [baseKey]: undefined };
  return { ...r, [end]: `${name.trim()}, ${base.text.split(/[,،]/)[0].trim()}`, [idKey]: id ?? base.id, [baseKey]: base };
}

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
  /** Where the trip starts and ends (local vehicles never go between two big cities). */
  ends?: RouteEnds;
};

export const CARE_TAGS: NoteTag[] = ['fragile', 'heavy', 'cover'];

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

function Corners({ size = 30, inset = 20, color: given }: { size?: number; inset?: number; color?: string }) {
  const c = useColors();
  const color = given ?? c.onInverse;
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
  const { t, lang, rtl } = useT();
  // The camera takes exactly the room left on the screen (round 8: the first page never scrolls,
  // in any language): it grows and shrinks with the page, between a small minimum and a maximum.
  const [camReal, setCamReal] = useState(300);
  // On a short phone the drawing steps aside, so the words and the shutter keep their room.
  const compact = camReal < 290;
  const last = photos[photos.length - 1];
  const full = photos.length >= MAX_PHOTOS;
  // Xapp Freight (Stitch "AI load scanner"), owner's rule: the first page is the camera and its
  // buttons only. A dark viewfinder with the Xapp Vision chip, the framing hint and lime corners;
  // the gallery and the white-and-lime shutter at its foot; the photos under it, then "Scan".
  const shutter = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('takePhoto')}
      testID="shutter"
      disabled={full}
      onPress={() => onShoot('camera')}
      style={({ pressed }) => ({ width: 86, height: 86, borderRadius: 43, backgroundColor: fade(c.accent2, 0.22), alignItems: 'center', justifyContent: 'center', opacity: full ? 0.4 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <Glow tone="accent" style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: c.onInverse, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: c.inverse }} />
        </View>
      </Glow>
    </Pressable>
  );
  const glass = (icon: keyof typeof Ionicons.glyphMap, label: string, press: () => void, hidden?: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={hidden} onPress={press} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: fade(c.onInverse, 0.1), borderWidth: 1, borderColor: fade(c.onInverse, 0.18), alignItems: 'center', justifyContent: 'center', opacity: hidden ? 0 : 1 }}>
      <Ionicons name={icon} size={20} color={c.onInverse} />
    </Pressable>
  );
  // Owner's rule (Xapp Freight): the whole screen is the camera. Only the camera, its shutter and
  // gallery button, the photos taken with "Scan", and under them the line to go on without a photo.
  // The small menu button (Stitch's corner button) brings the app's bars back over it.
  const insets = useSafeAreaInsets();
  const cam = useCameraFull();
  // The next example each time the camera page opens.
  const [example] = useState(() => CAMERA_EXAMPLES[exampleTurn++ % CAMERA_EXAMPLES.length]);
  return (
    <View style={{ flex: 1, backgroundColor: c.inverse, paddingTop: insets.top + (cam.bars ? 70 : 10), paddingBottom: insets.bottom + 14 + (cam.bars ? 78 : 0) }}>
      {/* Owner's report #1: never an empty black screen — the last photo taken, or an example of
          what to photograph (things only, never a person) until the first photo. */}
      <Image source={last ? { uri: last.uri } : example} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: fade(c.inverse, last ? 0.45 : 0.38) }} />
      <LinearGradient pointerEvents="none" colors={[fade(c.inverse, 0), fade(c.inverse, 0.85)]} start={{ x: 0.5, y: 0.45 }} end={{ x: 0.5, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {/* The whole camera is a shutter too. */}
      <Pressable accessibilityRole="button" accessibilityLabel={t('takePhoto')} disabled={full} onPress={() => onShoot('camera')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {/* Only the menu button in the corner (it brings the app's bars back), and the photo count once there are photos. */}
      <View style={{ paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} pointerEvents="box-none">
        {glass(cam.bars ? 'close' : 'grid-outline', t('menu'), () => {
          tap();
          setBarsOpen(!cam.bars);
        })}
        {photos.length ? (
          <View pointerEvents="none" style={{ backgroundColor: c.inverseAccent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Tech color={c.onAccent}>{`${photos.length}/${MAX_PHOTOS}`}</Tech>
          </View>
        ) : null}
      </View>
      {/* Lime corner frame with a small cross in its middle. */}
      <View onLayout={(e) => setCamReal(Math.round(e.nativeEvent.layout.height))} pointerEvents="none" style={{ flex: 1, minHeight: 60, margin: 26, marginVertical: 12, alignItems: 'center', justifyContent: 'center' }}>
        {/* Owner's report #26: nothing over the picture but the shutter, its line and the button under it. */}
      </View>
      <View style={{ paddingHorizontal: 16, gap: 12 }} pointerEvents="box-none">
        {photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingTop: 4, paddingEnd: 6, alignSelf: 'center' }}>
            {photos.map((p, i) => (
              <View key={p.uri + i} style={{ width: 54, height: 54, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: i === photos.length - 1 ? c.inverseAccent : fade(c.onInverse, 0.3) }}>
                <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('removePhoto', { n: i + 1 })}
                  onPress={() => onRemove(i)}
                  hitSlop={8}
                  style={{ position: 'absolute', top: 3, end: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: fade(c.inverse, 0.8), alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={12} color={c.onInverse} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 }}>
          {glass('images-outline', t('chooseGallery'), () => onShoot('library'), full)}
          {shutter}
          <View style={{ width: 48 }} />
        </View>
        {/* Owner's report #2: right under the shutter, why to press it and what the AI does with the photo. */}
        <T size={13} weight="semibold" color={c.onInverse} style={{ textAlign: 'center', paddingHorizontal: 6 }}>
          {photos.length ? t('camShutterHelpMore') : t('camShutterHelp')}
        </T>
        {error ? (
          <T color={c.orange} weight="bold" style={{ textAlign: 'center' }}>
            {t(error)}
          </T>
        ) : null}
        {photos.length ? <Btn title={photos.length === 1 ? t('scanEstimateOne') : t('scanEstimate', { n: photos.length })} icon="sparkles" onPress={onAnalyse} /> : null}
        {/* Under the camera: a line of text and a button to go on without a photo. */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Pressable
            hitSlop={6}
            accessibilityRole="button"
            testID="skip-photo"
            onPress={onSkip}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 46, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1.5, borderColor: fade(c.onInverse, 0.5), backgroundColor: pressed ? fade(c.onInverse, 0.12) : 'transparent' })}>
            <T size={15} weight="bold" color={c.onInverse}>
              {t('skipPhoto')}
            </T>
            <Ionicons name={rtl ? 'arrow-back' : 'arrow-forward'} size={17} color={c.onInverse} />
          </Pressable>
        </View>
      </View>
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
  const { t, lang } = useT();
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
  // Stitch: a progress figure that climbs while the AI reads, and reaches 100 when it is done.
  const [pct, setPct] = useState(4);
  useEffect(() => {
    const timer = setInterval(() => setPct((p) => (p >= 92 ? p : p + Math.max(1, Math.round((92 - p) / 12)))), 600);
    return () => clearInterval(timer);
  }, []);
  const shownPct = found.length ? 100 : pct;
  const foundKg = found.reduce((n, i) => n + (i.kgEach || 0) * (i.count || 1), 0);
  // Where the "detected" tags sit on the photo, one per item found.
  const SPOTS = [{ top: '16%', left: '8%' }, { top: '42%', right: '8%' }, { bottom: '20%', left: '14%' }, { top: '64%', right: '18%' }];
  return (
    <View style={{ flex: 1, gap: 14 }}>
      <View style={{ height: 300, borderRadius: 28, overflow: 'hidden', backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center' }}>
        {uri ? <Image source={{ uri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" /> : <LoadDrawing scale={0.8} />}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: fade(c.inverse, 0.3) }} />
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: c.inverseAccent, shadowColor: c.inverseAccent, shadowOpacity: 0.9, shadowRadius: 12, elevation: 6, transform: [{ translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, 298] }) }] }}
        />
        <Corners color={c.inverseAccent} />
        <View style={{ position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: fade(c.inverse, 0.8), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.inverseAccent }} />
          <Tech color={c.onInverse}>{t('aiReadingLive')}</Tech>
        </View>
        {found.slice(0, SPOTS.length).map((item, i) => (
          <View key={item.id} style={[{ position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: fade(c.inverse, 0.82), borderRadius: 999, borderWidth: 1, borderColor: c.inverseAccent, paddingHorizontal: 9, paddingVertical: 3 }, SPOTS[i] as object]}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.inverseAccent }} />
            <Tech color={c.inverseAccent}>{item.count > 1 ? `${item.name} ×${item.count}` : item.name}</Tech>
          </View>
        ))}
      </View>
      {photos.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: -4 }}>
          {photos.map((p, i) => (
            <Image key={p.uri + i} source={{ uri: p.uri }} style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 2, borderColor: i === shown ? c.accent : 'transparent', opacity: i === shown ? 1 : 0.6 }} resizeMode="cover" />
          ))}
        </View>
      ) : null}

      <Box>
        <BoxHead tag={t('tagAiScan')} side={batch && batch.total > batch.to - batch.from + 1 ? t('scanBatch', { a: batch.from, b: batch.to, n: batch.total }) : undefined} />
        <View style={{ gap: 2 }}>
          <T size={22} weight="heavy">
            {t('scanning')}
          </T>
          <T size={14} muted>
            {t((['scanSlow1', 'scanSlow2', 'scanSlow3', 'scanSlow4'] as const)[phase])}
          </T>
        </View>
        <View style={{ backgroundColor: c.raised, borderRadius: 12, padding: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <Tech>{t('readingProgress')}</Tech>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <T size={30} weight="heavy">
                {String(shownPct)}
              </T>
              <T size={14} weight="bold" muted>
                %
              </T>
            </View>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
            <View style={{ width: `${shownPct}%`, height: 6, borderRadius: 3, backgroundColor: c.accent }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Stat label={t('statItems')} value={String(found.reduce((n, i) => n + (i.count || 1), 0))} style={{ backgroundColor: c.surface }} />
            <Stat label={t('statWeight')} value={foundKg ? fmtKg(roundKg(foundKg), lang) : '—'} style={{ backgroundColor: c.surface }} />
            <Stat label={t('statPhotos')} value={String(Math.max(1, photos.length))} style={{ backgroundColor: c.surface }} />
          </View>
        </View>
      </Box>

      {found.length ? (
        <View style={{ gap: 8 }}>
          <Tech>{t('foundSoFar', { n: found.length })}</Tech>
          {found.map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.line, padding: 12 }}>
              <IconDot icon={itemIcon(item.name)} />
              <View style={{ flex: 1 }}>
                <T size={15} weight="bold">
                  {item.count > 1 ? `${item.name} ×${item.count}` : item.name}
                </T>
                {item.kgEach ? (
                  <T size={12} muted>
                    {t('kgEachEdit', { kg: fmtKg(item.kgEach, lang) })}
                  </T>
                ) : null}
              </View>
              <Tag tone="ok">{t('readyTag')}</Tag>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ alignItems: 'center', gap: 10 }}>
        <Tech>{t('scanUsually')}</Tech>
        <Btn title={t('skipToManual')} kind="ghost" small icon="arrow-forward" onPress={() => done.current(null, '')} />
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
  const [itemsOpen, setItemsOpen] = useState(false);
  // Owner's report #5: the route sits on this page; Continue points to it when it's missing.
  const [routeError, setRouteError] = useState(false);
  const routeY = useRef(0);
  const routeNow = useRef(route);
  routeNow.current = route;
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
    if ((checked.km ?? 0) !== routeKm || checked.ends?.from !== route.fromPlaceId || checked.ends?.to !== route.toPlaceId) setChecked({ ...checked, km: routeKm, ends: { from: route.fromPlaceId, to: route.toPlaceId } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKm, route.fromPlaceId, route.toPlaceId]);
  const setItems = (items: ScanItem[]) => setChecked({ ...checked, scan: { ...scan, items } });
  const latestItems = useRef(scan.items);
  latestItems.current = scan.items;
  const change = (id: string, patch: Partial<ScanItem>) => setItems(scan.items.map((i) => (i.id === id ? { ...i, ...patch, sure: true } : i)));
  // The weight is always said to be an estimate: nobody weighed the load.
  const summary = byHand ? '' : [scan.summary, kg ? t('kgEstimate', { kg: fmtKg(own ?? roundKg(kg), lang) }) : '', kg ? vName(t, vehicle) : ''].filter(Boolean).join(' · ');
  const photos = media.photos.length ? media.photos.map((p) => p.uri) : media.photoUri ? [media.photoUri] : [];
  // The same place picked twice (pins on top of each other, no distance): ask for another destination.
  const sameSpot = !!estimateTrip(route.fromPlaceId, route.toPlaceId, vehicle, 0)?.same;

  const pieces = scan.items.reduce((n, i) => n + i.count, 0);
  // How full the chosen vehicle would be (by weight), for the design's fill bar.
  const fill = kg && !checked.anyVehicle ? Math.min(100, Math.round(((own ?? roundKg(kg)) / Math.max(1, vehicleById(vehicle).maxKg)) * 100)) : 0;
  const SPOTS = [{ top: '22%', left: '6%' }, { top: '44%', right: '6%' }, { bottom: '22%', left: '10%' }, { top: '66%', right: '14%' }];
  return (
    <View style={{ gap: 14 }}>
      {/* Xapp Freight (Stitch "Analyse volumétrique"): the photo with what the AI found on it. */}
      {photos.length ? (
        <View style={{ height: 150, borderRadius: 26, overflow: 'hidden', backgroundColor: c.inverse }}>
          <Image source={{ uri: photos[0] }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" accessibilityLabel={t('photoN', { n: 1 })} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: fade(c.inverse, 0.4) }} />
          <View style={{ position: 'absolute', top: 12, start: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: fade(c.inverse, 0.82), borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.inverseAccent }} />
            <Tech color={c.onInverse}>{photos.length === 1 ? t('photosCountOne') : t('photosCount', { n: photos.length })}</Tech>
          </View>
          {byHand
            ? null
            : scan.items.slice(0, 2).map((item, i) => (
                <View key={item.id} pointerEvents="none" style={[{ position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: fade(c.inverse, 0.82), borderRadius: 999, borderWidth: 1, borderColor: c.inverseAccent, paddingHorizontal: 9, paddingVertical: 3 }, SPOTS[i] as object]}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.inverseAccent }} />
                  <Tech color={c.inverseAccent}>{item.count > 1 ? `${item.name} ×${item.count}` : item.name}</Tech>
                </View>
              ))}
          {/* Owner's edit #3: the weight, the items and the photos on the photo itself (no big box), so
              the load and the route fit one screen. Tap the weight to change it. */}
          {!byHand ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('editWeight')}
              onPress={() => {
                tap();
                setEditingKg(!editingKg);
              }}
              style={({ pressed }) => ({ position: 'absolute', bottom: 12, start: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: fade(c.inverse, 0.86), borderRadius: 999, paddingHorizontal: 12, minHeight: 38, opacity: pressed ? 0.85 : 1 })}>
              <Ionicons name="barbell-outline" size={15} color={c.inverseAccent} />
              <T size={14} weight="heavy" color={c.onInverse}>
                {kg ? (own ? fmtKg(own, lang) : `~${fmtKg(roundKg(kg), lang)}`) : '—'}
              </T>
              <Ionicons name="create-outline" size={13} color={c.inverseAccent} />
            </Pressable>
          ) : null}
          <Pressable
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t('retakeLong')}
            onPress={() => {
              tap();
              onRetake();
            }}
            style={({ pressed }) => ({ position: 'absolute', bottom: 12, end: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: fade(c.inverse, 0.82), borderWidth: 1, borderColor: fade(c.onInverse, 0.2), borderRadius: 999, paddingHorizontal: 12, minHeight: 38, opacity: pressed ? 0.85 : 1 })}>
            <Ionicons name="refresh" size={15} color={c.onInverse} />
            <T size={13} weight="bold" color={c.onInverse}>
              {t('retakeShort')}
            </T>
          </Pressable>
        </View>
      ) : (
        <Head slim title={t('loadPageTitle')} />
      )}
      {byHand && photos.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.warnSoft, borderRadius: 16, padding: 12 }}>
          <Ionicons name="hand-left-outline" size={18} color={c.warn} />
          <T size={14} weight="bold" color={c.warn} style={{ flex: 1 }}>
            {t('scanFailedPick')}
          </T>
        </View>
      ) : note ? (
        <View style={{ backgroundColor: c.warnSoft, borderRadius: 16, padding: 12 }}>
          <T size={14} color={c.warn}>
            {t(note)}
          </T>
        </View>
      ) : null}

      {byHand ? <KindsBox checked={checked} setChecked={setChecked} /> : null}

      {/* The deep moss summary: what the AI found, the weight, then the vehicle it suggests. */}
      {editingKg && !byHand ? <WeightEditor kg={own ?? (kg ? roundKg(kg) : 100)} onChange={(v) => setChecked({ ...checked, weightKg: v })} onDone={() => setEditingKg(false)} /> : null}
      {byHand && kg ? (
        <ColorsContext.Provider value={stitchDark}>
          <Box tone="dark" style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Tech color={c.inverseAccent}>{byHand ? t('tagNewRequest') : t('tagAiScan')}</Tech>
                <T size={22} weight="heavy" color={c.onInverse}>
                  {t('sawTitle')}
                </T>
                {scan.summary ? (
                  <T size={13} color={c.onInverseMuted}>
                    {scan.summary}
                  </T>
                ) : null}
              </View>
              {!byHand ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: fade(c.inverseAccent, 0.5), borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <Ionicons name="checkmark-circle-outline" size={13} color={c.inverseAccent} />
                  <Tech color={c.inverseAccent}>{t('aiShort')}</Tech>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('editWeight')} onPress={() => setEditingKg(!editingKg)} style={{ flex: 1.25, backgroundColor: fade(c.onInverse, 0.06), borderRadius: 20, padding: 14, gap: 6, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <T size={12} color={c.onInverseMuted}>
                    {t('totalWeight')}
                  </T>
                  <Ionicons name="create-outline" size={14} color={c.inverseAccent} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <T size={30} weight="heavy" color={c.onInverse}>
                    {kg ? (own ? num(fmtKg(own, lang)) : `~${num(fmtKg(roundKg(kg), lang))}`) : '—'}
                  </T>
                  {kg ? (
                    <T size={14} weight="bold" color={c.onInverseMuted}>
                      {unitOf(fmtKg(1, lang))}
                    </T>
                  ) : null}
                </View>
                <T size={11} color={c.onInverseMuted}>
                  {!kg ? t('weightOptional') : own ? t('weightYoursNote') : t('weightEstimateShort')}
                </T>
              </Pressable>
              <View style={{ flex: 1, gap: 10 }}>
                <View style={{ flex: 1, backgroundColor: fade(c.onInverse, 0.06), borderRadius: 18, padding: 12, gap: 2 }}>
                  <T size={12} color={c.onInverseMuted}>
                    {t('statItems')}
                  </T>
                  <T size={20} weight="heavy" color={c.onInverse}>
                    {String(pieces)}
                  </T>
                </View>
                <View style={{ flex: 1, backgroundColor: fade(c.onInverse, 0.06), borderRadius: 18, padding: 12, gap: 2 }}>
                  <T size={12} color={c.onInverseMuted}>
                    {t('statPhotos')}
                  </T>
                  <T size={20} weight="heavy" color={c.onInverse}>
                    {String(photos.length)}
                  </T>
                </View>
              </View>
            </View>
            {editingKg ? (
              <ColorsContext.Provider value={c}>
                <WeightEditor kg={own ?? (kg ? roundKg(kg) : 100)} onChange={(v) => setChecked({ ...checked, weightKg: v })} onDone={() => setEditingKg(false)} />
              </ColorsContext.Provider>
            ) : null}
          </Box>
        </ColorsContext.Provider>
      ) : null}

      {!byHand ? (
        <View style={{ gap: 10 }}>
          {/* Owner's edit #3: the list of things found is folded behind one line («9 items · see /
              edit») so the route stays on the same screen. */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: itemsOpen }}
            onPress={() => {
              tap();
              setItemsOpen(!itemsOpen);
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
            <Glow style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 20, paddingHorizontal: 14, minHeight: 50 }}>
              <Ionicons name="list" size={18} color={c.live} />
              <View style={{ flex: 1 }}>
                <T size={14} weight="heavy">
                  {[t('itemsFound'), t('piecesN', { n: pieces })].join(' · ')}
                </T>
                <T size={12} muted>
                  {scan.items.slice(0, 3).map((i) => (i.count > 1 ? `${i.count}× ${i.name}` : i.name)).join(', ') || t('sawEmpty')}
                </T>
              </View>
              <T size={13} weight="bold" color={c.accent}>
                {itemsOpen ? t('itemsHide') : t('itemsSeeEdit')}
              </T>
              <Ionicons name={itemsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.muted} />
            </Glow>
          </Pressable>
          {itemsOpen ? (
          <View style={{ gap: 10 }}>
          {scan.items.length ? null : (
            <T muted style={{ paddingVertical: 8 }}>
              {t('sawEmpty')}
            </T>
          )}
          {scan.items.map((item) => (
            <Glow tone="glass" key={item.id} style={{ borderRadius: 20, padding: 12, gap: 8, opacity: item.sure ? 1 : 0.8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={itemIcon(item.name)} size={19} color={c.live} />
                </View>
                <View style={{ flex: 1 }}>
                  <T size={15} weight="bold">
                    {item.count > 1 ? `${item.count}× ${item.name}` : item.name}
                  </T>
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
                      <T size={12} muted>
                        {t('kgEachEdit', { kg: fmtKg(item.kgEach, lang) })}
                      </T>
                      <Ionicons name="create-outline" size={12} color={c.live} />
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
                <T size={16} weight="bold" style={{ minWidth: 22, textAlign: 'center' }}>
                  {String(item.count)}
                </T>
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} +1`} onPress={() => change(item.id, { count: item.count + 1 })} style={roundBtn(c.accent)}>
                  <Ionicons name="add" size={18} color={c.onAccent} />
                </Pressable>
              </View>
              {editItem === item.id ? (
                <WeightEditor
                  min={1}
                  kg={item.kgEach}
                  onChange={(v) => setChecked({ ...checked, weightKg: undefined, scan: { ...scan, items: scan.items.map((x) => (x.id === item.id ? { ...x, kgEach: v, sure: true } : x)) } })}
                  onDone={() => setEditItem(null)}
                />
              ) : null}
            </Glow>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => setAdding(true)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.line, backgroundColor: pressed ? c.raised : 'transparent' })}>
            <Ionicons name="add-circle-outline" size={20} color={c.live} />
            <T size={14} weight="bold" color={c.live}>
              {t('addItemForgot')}
            </T>
          </Pressable>
          {photos.length ? (
            <Pressable hitSlop={6} accessibilityRole="button" onPress={onMorePhoto} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: 999, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, opacity: pressed ? 0.85 : 1 })}>
              <Ionicons name="scan-outline" size={18} color={c.fg} />
              <T size={14} weight="bold">
                {t('rescanAngle')}
              </T>
            </Pressable>
          ) : null}
          </View>
          ) : null}
        </View>
      ) : null}

      {/* Owner's report #5: where from and where to, on this same page right under the load, with the
          floor at each end; then one Continue. */}
      <View
        onLayout={(e) => {
          routeY.current = e.nativeEvent.layout.y;
        }}>
        <RouteFields
          compact
          from={{ text: route.fromBase?.text ?? route.from, id: route.fromBase?.id ?? route.fromPlaceId }}
          to={{ text: route.toBase?.text ?? route.to, id: route.toBase?.id ?? route.toPlaceId }}
          fromArea={route.fromBase ? route.from.split(/[,،]/)[0] : undefined}
          toArea={route.toBase ? route.to.split(/[,،]/)[0] : undefined}
          onFrom={(v, id) => {
            setRoute({ ...routeNow.current, from: v, fromPlaceId: id, fromBase: undefined });
            setRouteError(false);
          }}
          onTo={(v, id) => {
            setRoute({ ...routeNow.current, to: v, toPlaceId: id, toBase: undefined });
            setRouteError(false);
          }}
          onFromArea={(name, id) => setRoute(withArea(routeNow.current, 'from', name, id))}
          onToArea={(name, id) => setRoute(withArea(routeNow.current, 'to', name, id))}
          km={routeKm || undefined}
          error={routeError}
          mapIds={{ from: route.fromPlaceId, to: route.toPlaceId }}
        />
        {sameSpot ? (
          <T size={13} weight="bold" color={c.danger}>
            {t('samePlaces')}
          </T>
        ) : null}
      </View>
      {routeError ? (
        <T weight="bold" color={c.danger}>
          {t('needRoute')}
        </T>
      ) : null}
      <Btn
        title={t('continueBtn')}
        icon="arrow-forward"
        disabled={sameSpot || (byHand ? !scan.goods.length && !(checked.others ?? []).length && !(checked.otherText ?? '').trim() : !scan.items.length)}
        onPress={() => {
          if (!route.from.trim() || !route.to.trim()) {
            setRouteError(true);
            mainScroll.current?.scrollTo({ y: Math.max(0, routeY.current - 12), animated: true });
            return;
          }
          onNext();
        }}
      />

      <AddItem visible={adding} title={photos.length ? t('addItemTitle') : t('otherThingsTitle')} onClose={() => setAdding(false)} onAdd={(item) => setItems(mergeItem(latestItems.current, item))} />
      <VehiclePicker
        visible={picker}
        value={vehicle}
        weightKg={kg ? roundKg(kg) : 0}
        km={routeKm}
        ends={{ from: route.fromPlaceId, to: route.toPlaceId }}
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
export function FloorQuestion({ end, value, onChange }: { end: 'pickup' | 'dropoff'; value: FloorEnd; onChange: (v: FloorEnd) => void }) {
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

/** "240 kg" → "240" and "kg" (the stat tiles show the unit apart). */
const num = (s: string) => s.replace(/\s*[^\d\s,.\u00A0\u202F]+$/, '').trim();
const unitOf = (s: string) => (s.match(/[^\d\s,.\u00A0\u202F]+$/)?.[0] ?? '');

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
  return !vehicleMisfit(checked.scan.vehicle, high, km, checked.ends) ? checked.scan.vehicle : bestFit(high, km, checked.ends);
}

/** The vehicle in use: the customer's own choice unless it no longer suits (then the suggestion). */
export const chosenVehicle = (checked: Checked): VehicleId => {
  const high = checked.weightKg ? checked.weightKg : kgRange(totalKg(checked.scan.items)).high;
  return checked.vehicle && !vehicleMisfit(checked.vehicle, high, checked.km ?? 0, checked.ends) ? checked.vehicle : suggestedVehicle(checked);
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
    <Pressable hitSlop={4}
      key={key}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      unstable_pressDelay={60}
      onPress={press}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderStyle: dashed && !on ? 'dashed' : 'solid', borderColor: on || dashed ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface, opacity: pressed ? 0.85 : 1, maxWidth: '100%' })}>
      <Ionicons name={(on && !dashed ? 'checkmark' : icon) as keyof typeof Ionicons.glyphMap} size={16} color={on ? c.onAccent : c.accent} />
      <T size={13} weight="bold" color={on ? c.onAccent : dashed ? c.accent : c.fg} style={{ flexShrink: 1 }}>
        {label}
      </T>
    </Pressable>
  );
  const suggestion = (key: string, label: string, icon: keyof typeof Ionicons.glyphMap, press: () => void) => (
    <Pressable hitSlop={5} key={key} accessibilityRole="button" accessibilityLabel={label} onPress={press} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: c.accent, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 })}>
      <Ionicons name={icon} size={16} color={c.accent} />
      <T size={14} weight="bold" color={c.fg}>
        {label}
      </T>
    </Pressable>
  );
  return (
    <Card style={{ gap: 8, paddingVertical: 12 }}>
      <View style={{ gap: 2 }}>
        <T size={16} weight="heavy">
          {t('whatMoveBox')}
        </T>
        <T size={13} muted>
          {t('whatMoveHint')}
        </T>
      </View>
      {/* Owner's report #4: the kinds as 3D pictures in a sideways row (right to left in Arabic).
          Once some are picked, the others fold away and the picked ones stay; «More kinds» and
          «Something else» bring back the rest or open the box to write it. */}
      {/* Owner's report #27: the row starts again from its first card whenever it folds or opens
          (a row scrolled far to the side then folded used to show an empty box). */}
      <ScrollView key={folded ? `f${chosen.length}` : 'all'} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -16 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 4 }}>
        {(folded ? LOAD_CATS.filter((cat) => chosen.includes(cat)) : LOAD_CATS).map((cat) => {
          const on = chosen.includes(cat);
          return (
            <FadeIn key={cat}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t(`gs_${cat}` as Key)}
                unstable_pressDelay={60}
                onPress={() => {
                  play(on ? 'tick' : 'pop');
                  toggle(cat);
                }}
                style={({ pressed }) => ({ width: 112, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                <Glow tone={on ? 'accent' : 'glass'} style={{ borderRadius: 22, padding: 8, alignItems: 'center', gap: 4, minHeight: 112 }}>
                  <Image source={KIND_PICTURES[cat] ?? KIND_PICTURES.parcels} style={{ width: 54, height: 54 }} resizeMode="contain" accessibilityIgnoresInvertColors />
                  <T size={13} weight="bold" color={on ? c.onAccent : c.fg} style={{ textAlign: 'center' }}>
                    {t(`gs_${cat}` as Key)}
                  </T>
                  {on ? (
                    <View style={{ position: 'absolute', top: 8, end: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="checkmark" size={14} color={c.inverseAccent} />
                    </View>
                  ) : null}
                </Glow>
              </Pressable>
            </FadeIn>
          );
        })}
        {folded ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('kindsMore')}
            onPress={() => {
              tap();
              setShowAll(true);
            }}
            style={({ pressed }) => ({ width: 112, minHeight: 112, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.live, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, opacity: pressed ? 0.8 : 1 })}>
            <Ionicons name="add-circle-outline" size={30} color={c.live} />
            <T size={13} weight="bold" color={c.live} style={{ textAlign: 'center' }}>
              {t('kindsMore')}
            </T>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('g_other')}
          onPress={() => {
            tap();
            // Tapping again with nothing written closes the box (the added things stay).
            setChecked({ ...checked, otherText: otherOpen && !typing.trim() ? undefined : typing });
          }}
          style={({ pressed }) => ({ width: 112, minHeight: 112, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: otherOpen ? c.accent2 : c.line, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, opacity: pressed ? 0.8 : 1 })}>
          <Ionicons name="create-outline" size={28} color={c.fg} />
          <T size={13} weight="bold" style={{ textAlign: 'center' }}>
            {t('g_other')}
          </T>
        </Pressable>
      </ScrollView>
      {/* Things written under «Something else»: chips with ✕ to remove. */}
      {others.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {others.map((o) => (
            <View key={`o-${o}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingStart: 12, paddingEnd: 4, borderRadius: 999, backgroundColor: c.accent, maxWidth: '100%' }}>
              <Ionicons name="checkmark" size={16} color={c.onAccent} />
              <T size={13} weight="bold" color={c.onAccent} style={{ flexShrink: 1 }}>
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
                style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: fade(c.onInverse, 0.22) }}>
                <Ionicons name="close" size={15} color={c.onAccent} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
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
              <T size={13} muted>
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
      <Pressable style={{ flex: 1, backgroundColor: fade(c.shadow, 0.4) }} onPress={onClose} />
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

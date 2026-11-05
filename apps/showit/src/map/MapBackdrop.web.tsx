import { Animated, Image, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useT } from '../i18n';
import type { LatLng } from '../lib/geo';
import type { BackdropProps } from './backdrop-types';
import { pinFade, Veil } from './veil';
import { MeDot, PIN, TripPin } from './pins';
import { DEFAULT_CENTER, useMapTrip, useMyLocation, useRoadRoute } from './trip';

/**
 * Browser version. Pages like the claude.ai preview can't load map tiles, so this shows still
 * pictures of the same OpenStreetMap style (made by scripts/render-map.js): Casablanca up close,
 * and the Casablanca–Rabat region. Places outside them show no pin here (phones use the live map).
 */
const BOUNDS = require('../../assets/map/bounds.json') as Record<'casa' | 'region', { west: number; east: number; north: number; south: number }>;
const PICTURES = [
  { id: 'casa' as const, source: require('../../assets/map/casa.webp'), b: BOUNDS.casa },
  { id: 'region' as const, source: require('../../assets/map/region.webp'), b: BOUNDS.region },
];
const SIZE = 2048;

const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};

type Pic = (typeof PICTURES)[number];
const toPx = (pic: Pic, p: LatLng) => ({
  x: ((mercX(p.lng) - mercX(pic.b.west)) / (mercX(pic.b.east) - mercX(pic.b.west))) * SIZE,
  y: ((mercY(p.lat) - mercY(pic.b.north)) / (mercY(pic.b.south) - mercY(pic.b.north))) * SIZE,
});
const inside = (pic: Pic, p: LatLng) => p.lng > pic.b.west && p.lng < pic.b.east && p.lat > pic.b.south && p.lat < pic.b.north;

export function MapBackdrop(props: BackdropProps) {
  const { window, scrollY } = props;
  const fade = pinFade(scrollY);
  const { t } = useT();
  const { width: W, height: H } = useWindowDimensions();
  const trip = useMapTrip();
  const me = useMyLocation();
  const route = useRoadRoute(trip.from, trip.to);
  const places = [trip.from, trip.to].filter((p): p is LatLng => !!p);
  const focus = places.length ? places : me ? [me] : [DEFAULT_CENTER];
  const cover = Math.max(W, H) / SIZE;
  // The window where the trip should sit, leaving room for the pins' tags.
  const box = { left: 50, right: W - 50, top: window.top + 70, bottom: window.top + window.height - 6 };

  // Pick the closest picture that holds every place, then the zoom that fits them in the window.
  let pic: Pic = PICTURES[1];
  let scale = cover;
  for (const candidate of PICTURES) {
    if (!focus.every((p) => inside(candidate, p))) continue;
    const px = focus.map((p) => toPx(candidate, p));
    const w = Math.max(...px.map((p) => p.x)) - Math.min(...px.map((p) => p.x));
    const h = Math.max(...px.map((p) => p.y)) - Math.min(...px.map((p) => p.y));
    const s = Math.min(1.4, (box.right - box.left) / Math.max(w, 1), (box.bottom - box.top) / Math.max(h, 1));
    if (s >= cover) {
      pic = candidate;
      scale = places.length > 1 ? s : 1;
      break;
    }
  }
  const px = focus.filter((p) => inside(pic, p)).map((p) => toPx(pic, p));
  const cx = px.length ? (Math.min(...px.map((p) => p.x)) + Math.max(...px.map((p) => p.x))) / 2 : SIZE / 2;
  const cy = px.length ? (Math.min(...px.map((p) => p.y)) + Math.max(...px.map((p) => p.y))) / 2 : SIZE / 2;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const left = clamp((box.left + box.right) / 2 - cx * scale, W - SIZE * scale, 0);
  const top = clamp((box.top + box.bottom) / 2 - cy * scale, H - SIZE * scale, 0);
  const at = (p: LatLng) => {
    const q = toPx(pic, p);
    return { x: left + q.x * scale, y: top + q.y * scale };
  };
  const line = route.filter((p) => inside(pic, p)).map(at);

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: '#F2EFE9' }]} pointerEvents="none">
      <Image source={pic.source} style={{ position: 'absolute', left, top, width: SIZE * scale, height: SIZE * scale }} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
      {line.length > 1 && (
        <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
          <polyline points={line.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={line.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={PIN.route} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {me && inside(pic, me) && <Placed at={at(me)} anchor="center">{<MeDot />}</Placed>}
      {trip.from && inside(pic, trip.from) && (
        <Placed at={at(trip.from)} anchor="bottom">
          <TripPin kind="pickup" label={t('mapPickup')} />
        </Placed>
      )}
      {trip.to && inside(pic, trip.to) && (
        <Placed at={at(trip.to)} anchor="bottom">
          <TripPin kind="dropoff" label={t('mapDropoff')} />
        </Placed>
      )}
      </Animated.View>
      <Veil {...props} />
    </View>
  );
}

/** Puts a pin on its point: by its bottom middle (pins) or its centre (the dot). */
function Placed({ at, anchor, children }: { at: { x: number; y: number }; anchor: 'bottom' | 'center'; children: React.ReactNode }) {
  const w = 160;
  const h = anchor === 'bottom' ? 120 : 60;
  return (
    <View style={{ position: 'absolute', left: at.x - w / 2, top: anchor === 'bottom' ? at.y - h : at.y - h / 2, width: w, height: h, alignItems: 'center', justifyContent: anchor === 'bottom' ? 'flex-end' : 'center' }}>
      {children}
    </View>
  );
}

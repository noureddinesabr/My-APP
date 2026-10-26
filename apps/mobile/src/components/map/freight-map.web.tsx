import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MOROCCO, NEIGHBOURS } from '@/components/map/morocco-shape';
import type { FreightMapProps, MapMarker } from '@/components/map/types';
import { Text } from '@/components/text';
import { CITIES } from '@/constants/cities';
import { PLACES } from '@/constants/places';
import { useLanguage } from '@/i18n/language-provider';
import { bounds, type LatLng } from '@/lib/geo';
import { Radius, softShadow, Spacing, useColors } from '@/theme';

/** Cities labelled when the whole country is in view. */
const MAJOR = new Set(['casablanca', 'rabat', 'marrakech', 'fes', 'tanger', 'agadir', 'oujda', 'laayoune', 'dakhla', 'meknes']);
const MIN_SPAN = 0.03;
const MAX_SPAN = 30;

type View2D = { lat: number; lng: number; span: number };

const glyph = (name: keyof typeof MaterialCommunityIcons.glyphMap) =>
  String.fromCodePoint(MaterialCommunityIcons.glyphMap[name] as number);

const MARKER_GLYPHS: Record<MapMarker['kind'], string> = {
  pickup: glyph('package-variant-closed'),
  dropoff: glyph('flag-checkered'),
  driver: glyph('truck'),
  load: glyph('package-variant'),
  pick: glyph('map-marker'),
};

function fit(points: LatLng[], width: number, height: number): View2D {
  const b = bounds(points.length ? points : CITIES, 0.35, MIN_SPAN);
  const lat = (b.minLat + b.maxLat) / 2;
  const lng = (b.minLng + b.maxLng) / 2;
  const cos = Math.cos((lat * Math.PI) / 180);
  const span = Math.max(b.maxLng - b.minLng, ((b.maxLat - b.minLat) * width) / (height * cos));
  return { lat, lng, span: Math.min(MAX_SPAN, Math.max(MIN_SPAN, span)) };
}

/**
 * Browser map drawn from bundled Natural Earth shapes: works offline and inside the
 * preview, where map tiles can't load. Shows Morocco, cities and neighbourhoods;
 * drag to move, scroll or +/− to zoom, tap to pick a point.
 */
export function FreightMap({ markers, route, approach, focus, focusKey, follow, onPick, height = 260, style }: FreightMapProps) {
  const colors = useColors();
  const { language } = useLanguage();
  const [size, setSize] = useState({ width: 360, height });
  const [view, setView] = useState<View2D>(() => fit(focus, 360, height));
  const drag = useRef<{ x: number; y: number; view: View2D; moved: boolean } | null>(null);

  // Refit when the trip changes or the map is resized, not on every driver move.
  const fitKey = `${focusKey}|${size.width}|${size.height}`;
  const [fittedFor, setFittedFor] = useState(fitKey);
  if (fittedFor !== fitKey) {
    setFittedFor(fitKey);
    setView(fit(focus, size.width, size.height));
  }

  // Follow the moving point (driver) until the user drags the map; the locate button turns it back on.
  const [following, setFollowing] = useState(true);
  const followKey = follow ? `${follow.lat.toFixed(5)},${follow.lng.toFixed(5)}` : null;
  const [followedFor, setFollowedFor] = useState<string | null>(null);
  if (follow && following && followedFor !== followKey) {
    setFollowedFor(followKey);
    setView((current) => ({ ...current, lat: follow.lat, lng: follow.lng }));
  }

  const { width, height: h } = size;
  const k = width / view.span;
  const cos = Math.cos((view.lat * Math.PI) / 180);
  const x = (lng: number) => (lng - view.lng) * k + width / 2;
  const y = (lat: number) => h / 2 - ((lat - view.lat) * k) / cos;
  const toLatLng = (px: number, py: number): LatLng => ({
    lng: view.lng + (px - width / 2) / k,
    lat: view.lat + ((h / 2 - py) * cos) / k,
  });
  const path = (ring: [number, number][]) => `M${ring.map(([lng, lat]) => `${x(lng).toFixed(1)},${y(lat).toFixed(1)}`).join('L')}Z`;
  const line = (points: LatLng[]) => points.map((p) => `${x(p.lng).toFixed(1)},${y(p.lat).toFixed(1)}`).join(' ');

  const candidates = useMemo(() => {
    if (view.span > 8) return PLACES.filter((p) => p.kind === 'city' && MAJOR.has(p.id));
    if (view.span > 0.35) return PLACES.filter((p) => p.kind === 'city');
    // Cities first so they win when labels collide.
    return [...PLACES].sort((a, b) => Number(b.kind === 'city') - Number(a.kind === 'city'));
  }, [view.span]);

  // Greedy label placement: skip any label that would overlap one already placed.
  const labels = (() => {
    const placed: { x1: number; y1: number; x2: number; y2: number }[] = [];
    return candidates.filter((place) => {
      const px = x(place.lng);
      const py = y(place.lat);
      if (px < -40 || px > width + 40 || py < -20 || py > h + 20) return false;
      const box = { x1: px - 4, y1: py - 16, x2: px + 8 + place.name[language].length * 6, y2: py + 4 };
      if (placed.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1)) return false;
      placed.push(box);
      return true;
    });
  })();

  const zoom = (factor: number, anchor?: LatLng) => {
    setView((current) => {
      const span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, current.span * factor));
      if (!anchor) return { ...current, span };
      // Keep the point under the cursor in place.
      const t = span / current.span;
      return { span, lat: anchor.lat + (current.lat - anchor.lat) * t, lng: anchor.lng + (current.lng - anchor.lng) * t };
    });
  };

  const local = (event: PointerEvent | WheelEvent) => {
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    return { px: event.clientX - rect.left, py: event.clientY - rect.top };
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, view, moved: false };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) {
      if (!start.moved && follow) setFollowing(false);
      start.moved = true;
    }
    if (!start.moved) return;
    const sk = width / start.view.span;
    setView({ ...start.view, lng: start.view.lng - dx / sk, lat: start.view.lat + (dy * cos) / sk });
  };
  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    drag.current = null;
    if (start && !start.moved && onPick) {
      const { px, py } = local(event);
      onPick(toLatLng(px, py));
    }
  };
  const onWheel = (event: WheelEvent<SVGSVGElement>) => {
    const { px, py } = local(event);
    zoom(event.deltaY > 0 ? 1.25 : 0.8, toLatLng(px, py));
  };

  const markerColor = (kind: MapMarker['kind']) =>
    kind === 'dropoff' ? colors.accent : kind === 'driver' ? colors.success : colors.primary;

  return (
    <View
      style={[styles.wrap, { height, backgroundColor: colors.mapSea }, style]}
      onLayout={(event) => {
        const { width: w, height: hh } = event.nativeEvent.layout;
        // Screens hidden in the navigation stack report a zero size; keep the last real one.
        if (w > 0 && hh > 0) setSize({ width: w, height: hh });
      }}>
      <svg
        width={width}
        height={h}
        style={{ touchAction: 'none', cursor: onPick ? 'crosshair' : 'grab', display: 'block', direction: 'ltr' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onWheel={onWheel}>
        {NEIGHBOURS.map((ring, i) => (
          <path key={`n${i}`} d={path(ring)} fill={colors.mapNeighbour} stroke={colors.mapBorder} strokeWidth={0.6} />
        ))}
        {MOROCCO.map((ring, i) => (
          <path key={`m${i}`} d={path(ring)} fill={colors.mapLand} stroke={colors.mapBorder} strokeWidth={1.2} />
        ))}

        {labels.map((place) => {
          const px = x(place.lng);
          const py = y(place.lat);
          const city = place.kind === 'city';
          return (
            <g key={place.id}>
              <circle cx={px} cy={py} r={city ? 3 : 2} fill={city ? colors.textMuted : colors.mapBorder} />
              <text
                x={px + 5}
                y={py - 4}
                fontSize={city ? 11 : 9.5}
                fontFamily="Cairo_600SemiBold"
                fill={city ? colors.text : colors.textMuted}
                stroke={colors.mapLand}
                strokeWidth={3}
                paintOrder="stroke"
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {place.name[language]}
              </text>
            </g>
          );
        })}

        {approach && approach.length > 1 && (
          <polyline points={line(approach)} fill="none" stroke={colors.success} strokeWidth={3} strokeDasharray="2 6" strokeLinecap="round" />
        )}
        {route && route.length > 1 && (
          <>
            <polyline points={line(route)} fill="none" stroke={colors.surface} strokeWidth={7} strokeLinecap="round" />
            <polyline points={line(route)} fill="none" stroke={colors.primary} strokeWidth={4} strokeLinecap="round" strokeDasharray="10 6" />
          </>
        )}

        {markers.map((marker) => {
          const px = x(marker.lng);
          const py = y(marker.lat);
          const color = markerColor(marker.kind);
          return (
            <g key={marker.id} style={{ pointerEvents: 'none' }}>
              {marker.kind === 'driver' && (
                <circle cx={px} cy={py} r={16} fill={color} opacity={0.25}>
                  <animate attributeName="r" values="14;26;14" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.35;0;0.35" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={px} cy={py} r={15} fill={color} stroke={colors.surface} strokeWidth={3} />
              <text x={px} y={py + 6} fontSize={17} textAnchor="middle" fontFamily="material-community" fill={colors.onPrimary}>
                {MARKER_GLYPHS[marker.kind]}
              </text>
              {marker.label && (
                <text
                  x={px}
                  y={py - 22}
                  fontSize={11}
                  textAnchor="middle"
                  fontFamily="Cairo_700Bold"
                  fill={colors.text}
                  stroke={colors.surface}
                  strokeWidth={3}
                  paintOrder="stroke">
                  {marker.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <View style={styles.controls}>
        <MapButton icon="add" label="zoom in" onPress={() => zoom(0.6)} />
        <MapButton icon="remove" label="zoom out" onPress={() => zoom(1.6)} />
        <MapButton icon="scan-outline" label="fit" onPress={() => setView(fit(focus, width, h))} />
        {follow && (
          <MapButton
            icon="locate"
            label="follow"
            active={following}
            onPress={() => {
              setFollowing(true);
              setView((current) => ({ ...current, lat: follow.lat, lng: follow.lng }));
            }}
          />
        )}
      </View>
      <Text variant="caption" muted style={styles.credit}>
        Natural Earth
      </Text>
    </View>
  );
}

function MapButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: 'add' | 'remove' | 'scan-outline' | 'locate';
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.button, { backgroundColor: active ? colors.primary : colors.surface }, softShadow(colors.shadow, 0.5)]}>
      <Ionicons name={icon} size={18} color={active ? colors.onPrimary : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden' },
  controls: { position: 'absolute', top: Spacing.sm, end: Spacing.sm, gap: Spacing.xs },
  button: { width: 34, height: 34, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  credit: { position: 'absolute', bottom: 2, start: Spacing.sm, fontSize: 9, lineHeight: 14, opacity: 0.7 },
});

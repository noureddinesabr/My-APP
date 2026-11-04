import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MOROCCO, NEIGHBOURS } from '@/components/map/morocco-shape';
import type { FreightMapProps, MapMarker } from '@/components/map/types';
import { useGlide } from '@/components/map/use-glide';
import { Text } from '@/components/text';
import { CITIES } from '@/constants/cities';
import { PLACES } from '@/constants/places';
import { useLanguage } from '@/i18n/language-provider';
import { bounds, type LatLng } from '@/lib/geo';
import { Radius, softShadow, Spacing, useColors } from '@/theme';

/** Cities labelled when the whole country is in view (outline map only). */
const MAJOR = new Set(['casablanca', 'rabat', 'marrakech', 'fes', 'tanger', 'agadir', 'oujda', 'laayoune', 'dakhla', 'meknes']);
/** Narrowest view: about 400 m across, enough to read street names. */
const MIN_SPAN = 0.004;
const MAX_SPAN = 30;
const TILE = 256;
const MAX_TILE_ZOOM = 19;

/**
 * Street map tiles (OpenStreetMap data, CARTO style: streets, neighbourhoods and their
 * names in Arabic and French). Pages that block outside images — like the claude.ai
 * preview — fall back to the bundled outline of Morocco.
 */
const TILES = {
  // Light in dark mode too: the owner wants the same street map in both themes.
  light: (z: number, x: number, y: number) => `https://${'abcd'[(x + y) % 4]}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@2x.png`,
};

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
const PERSON_GLYPH = glyph('human-greeting');
const RADAR = 90;
/** Pickup, drop-off and a place being chosen stand on a pointer, like a sticker pinned on the map. */
const PINNED = new Set<MapMarker['kind']>(['pickup', 'dropoff', 'pick']);

/** Web Mercator: 0–1 across the world, like every street map. */
const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => {
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
const latFromMercY = (my: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * 180) / Math.PI;

function fit(points: LatLng[], width: number, height: number, inset: FreightMapProps['inset'] = { top: 0, bottom: 0 }): View2D {
  const b = bounds(points.length ? points : CITIES, 0.35, 0.01);
  const left = inset.left ?? 0;
  const right = inset.right ?? 0;
  // Fit into the part of the map that isn't covered (buttons above, a panel below, stickers on the sides).
  const visible = Math.max(80, height - inset.top - inset.bottom);
  const visibleWidth = Math.max(80, width - left - right);
  // Longitude span that also fits the latitude span in the map's shape.
  const latSpanAsLng = ((mercY(b.minLat) - mercY(b.maxLat)) * 360 * width) / visible;
  const lngSpan = ((b.maxLng - b.minLng) * width) / visibleWidth;
  const span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, Math.max(lngSpan, (latSpanAsLng * width) / visibleWidth)));
  // Move the centre so the trip sits in the middle of the uncovered part.
  const pxPerMerc = (width * 360) / span;
  const centre = (mercY(b.minLat) + mercY(b.maxLat)) / 2 - (inset.top - inset.bottom) / 2 / pxPerMerc;
  const lng = (b.minLng + b.maxLng) / 2 - ((left - right) / 2) * (span / width);
  return { lat: latFromMercY(centre), lng, span };
}

/**
 * Browser map: real street tiles when the page may load them, the bundled outline otherwise.
 * Drag to move, scroll / pinch / +− to zoom, tap to pick a point. Shows the blue
 * "you are here" dot when `userLocation` is given.
 */
export function FreightMap({
  markers,
  route,
  approach,
  focus,
  focusKey,
  follow,
  onPick,
  userLocation,
  bare,
  height = 260,
  fill,
  inset,
  person,
  traveller,
  radar,
  style,
}: FreightMapProps) {
  const colors = useColors();
  const walker = useGlide(person);
  const { language } = useLanguage();
  const [size, setSize] = useState({ width: 360, height });
  const [view, setView] = useState<View2D>(() => fit(focus, 360, height));
  const [tiles, setTiles] = useState<'loading' | 'ok' | 'blocked'>('loading');
  const drag = useRef<{ x: number; y: number; view: View2D; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; view: View2D } | null>(null);

  // Refit when the trip changes or the map is resized, not on every driver move.
  const fitKey = `${focusKey}|${size.width}|${size.height}`;
  const [fittedFor, setFittedFor] = useState(fitKey);
  const [flight, setFlight] = useState<View2D | null>(null);
  if (fittedFor !== fitKey) {
    const sameTrip = fittedFor.split('|')[0] === fitKey.split('|')[0];
    setFittedFor(fitKey);
    // A new place glides into view (the map follows what is being chosen); a resize just refits.
    if (sameTrip) setView(fit(focus, size.width, size.height, inset));
    else setFlight(fit(focus, size.width, size.height, inset));
  }
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  });
  useEffect(() => {
    if (!flight) return;
    const from = viewRef.current;
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / 700);
      const ease = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
      setView({
        lat: from.lat + (flight.lat - from.lat) * ease,
        lng: from.lng + (flight.lng - from.lng) * ease,
        span: Math.exp(Math.log(from.span) + (Math.log(flight.span) - Math.log(from.span)) * ease),
      });
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [flight]);

  // Follow the moving point (driver) until the user drags the map; the locate button turns it back on.
  const [following, setFollowing] = useState(true);
  const followKey = follow ? `${follow.lat.toFixed(5)},${follow.lng.toFixed(5)}` : null;
  const [followedFor, setFollowedFor] = useState<string | null>(null);
  if (follow && following && followedFor !== followKey) {
    setFollowedFor(followKey);
    setView((current) => ({ ...current, lat: follow.lat, lng: follow.lng }));
  }

  const { width, height: h } = size;
  // World size in pixels at this zoom, and the view centre in world pixels.
  const world = (width * 360) / view.span;
  const cx = mercX(view.lng) * world;
  const cy = mercY(view.lat) * world;
  const x = (lng: number) => mercX(lng) * world - cx + width / 2;
  const y = (lat: number) => mercY(lat) * world - cy + h / 2;
  const toLatLng = (px: number, py: number): LatLng => ({
    lng: ((cx + px - width / 2) / world) * 360 - 180,
    lat: latFromMercY((cy + py - h / 2) / world),
  });
  const path = (ring: [number, number][]) => `M${ring.map(([lng, lat]) => `${x(lng).toFixed(1)},${y(lat).toFixed(1)}`).join('L')}Z`;
  const line = (points: LatLng[]) => points.map((p) => `${x(p.lng).toFixed(1)},${y(p.lat).toFixed(1)}`).join(' ');

  // Tiles covering the view at the nearest whole zoom level, scaled to the exact zoom.
  const tileGrid = useMemo(() => {
    if (tiles === 'blocked') return [];
    const zoom = Math.log2(world / TILE);
    const z = Math.max(0, Math.min(MAX_TILE_ZOOM, Math.round(zoom)));
    const scale = world / (TILE * 2 ** z);
    const size = TILE * scale;
    const count = 2 ** z;
    const left = cx - width / 2;
    const top = cy - h / 2;
    const out: { key: string; url: string; left: number; top: number; size: number }[] = [];
    for (let tx = Math.floor(left / size); tx <= Math.floor((left + width) / size); tx++) {
      for (let ty = Math.max(0, Math.floor(top / size)); ty <= Math.min(count - 1, Math.floor((top + h) / size)); ty++) {
        const wrapped = ((tx % count) + count) % count;
        out.push({ key: `${z}/${tx}/${ty}`, url: TILES.light(z, wrapped, ty), left: tx * size - left, top: ty * size - top, size });
      }
    }
    return out;
  }, [tiles, world, cx, cy, width, h]);

  const outline = tiles !== 'ok';

  const candidates = useMemo(() => {
    if (!outline) return [];
    if (view.span > 8) return PLACES.filter((p) => p.kind === 'city' && MAJOR.has(p.id));
    if (view.span > 0.35) return PLACES.filter((p) => p.kind === 'city');
    // Cities first so they win when labels collide.
    return [...PLACES].sort((a, b) => Number(b.kind === 'city') - Number(a.kind === 'city'));
  }, [view.span, outline]);

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

  const zoom = (factor: number, anchor?: LatLng, from: View2D = view) => {
    const span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, from.span * factor));
    if (!anchor) return setView({ ...from, span });
    // Keep the point under the cursor in place.
    const t = span / from.span;
    setView({ span, lat: anchor.lat + (from.lat - anchor.lat) * t, lng: anchor.lng + (from.lng - anchor.lng) * t });
  };

  const local = (event: PointerEvent | WheelEvent) => {
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    return { px: event.clientX - rect.left, py: event.clientY - rect.top };
  };
  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      pinch.current = { distance: distance(), view };
      drag.current = null;
    } else drag.current = { x: event.clientX, y: event.clientY, view, moved: false };
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && pointers.current.size === 2) {
      // Two fingers: zoom around the centre of the view.
      zoom(pinch.current.distance / Math.max(1, distance()), undefined, pinch.current.view);
      return;
    }
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) {
      if (!start.moved && follow) setFollowing(false);
      start.moved = true;
    }
    if (!start.moved) return;
    const startWorld = (width * 360) / start.view.span;
    const lng = start.view.lng - (dx / startWorld) * 360;
    const lat = latFromMercY(mercY(start.view.lat) - dy / startWorld);
    setView({ ...start.view, lng, lat });
  };
  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
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
    kind === 'dropoff' ? colors.accentFill : kind === 'driver' ? colors.successFill : colors.primaryFill;

  return (
    <View
      style={[styles.wrap, fill ? { flex: 1 } : { height }, { backgroundColor: outline ? colors.mapSea : colors.mapLand }, style]}
      onLayout={(event) => {
        const { width: w, height: hh } = event.nativeEvent.layout;
        // Screens hidden in the navigation stack report a zero size; keep the last real one.
        if (w > 0 && hh > 0) setSize({ width: w, height: hh });
      }}>
      {tileGrid.length > 0 && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', opacity: tiles === 'ok' ? 1 : 0 }}>
          {tileGrid.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              draggable={false}
              onLoad={() => tiles !== 'ok' && setTiles('ok')}
              onError={() => tiles === 'loading' && setTiles('blocked')}
              style={{ position: 'absolute', left: tile.left, top: tile.top, width: tile.size + 0.5, height: tile.size + 0.5 }}
            />
          ))}
        </div>
      )}
      <svg
        width={width}
        height={h}
        style={{ position: 'relative', touchAction: 'none', cursor: onPick ? 'crosshair' : 'grab', display: 'block', direction: 'ltr' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          drag.current = null;
          pinch.current = null;
        }}
        onWheel={onWheel}>
        {outline &&
          NEIGHBOURS.map((ring, i) => <path key={`n${i}`} d={path(ring)} fill={colors.mapNeighbour} stroke={colors.mapBorder} strokeWidth={0.6} />)}
        {outline && MOROCCO.map((ring, i) => <path key={`m${i}`} d={path(ring)} fill={colors.mapLand} stroke={colors.mapBorder} strokeWidth={1.2} />)}

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
          <polyline points={line(approach)} fill="none" stroke={colors.successFill} strokeWidth={4} strokeDasharray="2 7" strokeLinecap="round" />
        )}
        {route && route.length > 1 && (
          <>
            <polyline points={line(route)} fill="none" stroke={colors.surface} strokeWidth={8} strokeLinecap="round" />
            <polyline points={line(route)} fill="none" stroke={colors.primaryFill} strokeWidth={5} strokeLinecap="round" />
          </>
        )}

        {userLocation && (
          <g style={{ pointerEvents: 'none' }}>
            <circle cx={x(userLocation.lng)} cy={y(userLocation.lat)} r={22} fill={colors.location} opacity={0.18}>
              <animate attributeName="r" values="14;30;14" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={x(userLocation.lng)} cy={y(userLocation.lat)} r={9} fill={colors.location} stroke="white" strokeWidth={3} />
          </g>
        )}

        {radar && (
          <g transform={`translate(${x(radar.lng).toFixed(1)},${y(radar.lat).toFixed(1)})`} style={{ pointerEvents: 'none' }}>
            {/* Rings going out, a beam sweeping round, and the truck in the middle: searching here. */}
            <circle r={RADAR} fill={colors.primaryFill} opacity={0.08} />
            {[0, 0.8, 1.6].map((delay) => (
              <circle key={delay} r={RADAR} fill="none" stroke={colors.primaryFill} strokeWidth={2}>
                <animate attributeName="r" values={`${RADAR * 0.3};${RADAR}`} dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0" dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
              </circle>
            ))}
            <path d={`M 0 0 L 0 ${-RADAR} A ${RADAR} ${RADAR} 0 0 1 ${RADAR} 0 Z`} fill={colors.primaryFill} opacity={0.22}>
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3.2s" repeatCount="indefinite" />
            </path>
          </g>
        )}

        {route && route.length > 1 && traveller && (
          <g style={{ pointerEvents: 'none' }}>
            <circle r={13} fill={colors.successFill} stroke={colors.surface} strokeWidth={2.5}>
              <animateMotion dur="5s" repeatCount="indefinite" path={`M${line(route).replace(/ /g, ' L')}`} />
            </circle>
            <text fontSize={15} textAnchor="middle" dy={5} fontFamily="material-community" fill={colors.onPrimary}>
              <animateMotion dur="5s" repeatCount="indefinite" path={`M${line(route).replace(/ /g, ' L')}`} />
              {glyph(traveller)}
            </text>
          </g>
        )}

        {markers.filter((marker) => PINNED.has(marker.kind)).map((marker) => (
          <Pin key={marker.id} marker={marker} x={x} y={y} color={markerColor(marker.kind)} />
        ))}

        {walker && (
          <g transform={`translate(${x(walker.lng).toFixed(1)},${y(walker.lat).toFixed(1)})`} style={{ pointerEvents: 'none' }}>
            {/* You: a person in a bubble on a triangle pointing at the exact spot, with a soft pulse on the ground. */}
            <ellipse cx={0} cy={0} rx={9} ry={3.5} fill={colors.location} opacity={0.35}>
              <animate attributeName="rx" values="7;16;7" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.45;0.05;0.45" dur="2.2s" repeatCount="indefinite" />
            </ellipse>
            <path d="M -9 -16 L 9 -16 L 0 -2 Z" fill={colors.location} />
            <circle cx={0} cy={-34} r={19} fill={colors.location} stroke="white" strokeWidth={3} />
            <text x={0} y={-26} fontSize={23} textAnchor="middle" fontFamily="material-community" fill="white">
              {PERSON_GLYPH}
            </text>
          </g>
        )}

        {markers.filter((marker) => !PINNED.has(marker.kind)).map((marker) => {
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

      {!bare && (
        <View style={styles.controls}>
          <MapButton icon="add" label="zoom in" onPress={() => zoom(0.6)} />
          <MapButton icon="remove" label="zoom out" onPress={() => zoom(1.6)} />
          <MapButton icon="scan-outline" label="fit" onPress={() => setView(fit(focus, width, h, inset))} />
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
      )}
      <Text variant="caption" muted style={[styles.credit, { backgroundColor: colors.surface }]}>
        {outline ? 'Natural Earth' : '© OpenStreetMap · © CARTO'}
      </Text>
    </View>
  );
}

/**
 * A sticker pinned on the map: a round head with the icon (box = pickup, flag = drop-off) on a
 * triangle pointing at the exact spot, a short name above it, and a pulse on the ground. It
 * slides to a new place when the place changes.
 */
function Pin({ marker, x, y, color }: { marker: MapMarker; x: (lng: number) => number; y: (lat: number) => number; color: string }) {
  const colors = useColors();
  const at = useGlide(marker) ?? marker;
  const preview = marker.kind === 'pick';
  return (
    <g transform={`translate(${x(at.lng).toFixed(1)},${y(at.lat).toFixed(1)})`} style={{ pointerEvents: 'none' }}>
      <ellipse cx={0} cy={0} rx={8} ry={3} fill={color} opacity={0.35}>
        <animate attributeName="rx" values="6;15;6" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.45;0.05;0.45" dur="2.4s" repeatCount="indefinite" />
      </ellipse>
      <path d="M -9 -15 L 9 -15 L 0 -1 Z" fill={color} />
      <circle cx={0} cy={-32} r={18} fill={color} stroke={colors.surface} strokeWidth={3} strokeDasharray={preview ? '5 3' : undefined} />
      <text x={0} y={-25} fontSize={20} textAnchor="middle" fontFamily="material-community" fill={colors.onPrimary}>
        {MARKER_GLYPHS[marker.kind]}
      </text>
      {marker.label && (
        <text
          x={0}
          y={-58}
          fontSize={12}
          textAnchor="middle"
          fontFamily="Cairo_700Bold"
          fill={color}
          stroke="#FFFFFF"
          strokeWidth={4}
          paintOrder="stroke">
          {marker.label}
        </text>
      )}
    </g>
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
      style={[styles.button, { backgroundColor: active ? colors.primaryFill : colors.surface }, softShadow(colors.shadow, 0.5)]}>
      <Ionicons name={icon} size={18} color={active ? colors.onPrimary : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden' },
  controls: { position: 'absolute', top: Spacing.sm, end: Spacing.sm, gap: Spacing.xs },
  button: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  credit: { position: 'absolute', bottom: 2, start: Spacing.sm, fontSize: 9, lineHeight: 14, opacity: 0.8, paddingHorizontal: 4, borderRadius: 4 },
});

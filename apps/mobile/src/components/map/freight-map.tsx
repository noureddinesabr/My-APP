import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  NativeUserLocation,
  type LngLatBounds,
} from '@maplibre/maplibre-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FreightMapProps, MapMarker } from '@/components/map/types';
import { useGlide } from '@/components/map/use-glide';
import { Radar } from '@/components/motion/scenes';
import { bounds, type LatLng } from '@/lib/geo';
import { Radius, useColors } from '@/theme';

const ICONS = {
  pickup: 'package-variant-closed',
  dropoff: 'flag-checkered',
  driver: 'truck',
  load: 'package-variant',
  pick: 'map-marker',
} as const;

// Free OpenStreetMap vector style from OpenFreeMap: streets, neighbourhood names and
// buildings, with no API key. It stays light in dark mode too, like the maps people know.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const PADDING = { top: 60, bottom: 60, left: 60, right: 60 };

function toBounds(points: readonly LatLng[]): LngLatBounds {
  const b = bounds(points);
  return [b.minLng, b.minLat, b.maxLng, b.maxLat];
}

function line(points: LatLng[]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) } };
}

/** Phone map: OpenStreetMap streets (MapLibre), the phone's blue location dot and freight markers. */
export function FreightMap({ markers, route, approach, focus, focusKey, follow, onPick, bare, height = 260, fill, inset, person, traveller, radar, style }: FreightMapProps) {
  const colors = useColors();
  const camera = useRef<CameraRef>(null);
  const padding = {
    top: PADDING.top + (inset?.top ?? 0),
    bottom: PADDING.bottom + (inset?.bottom ?? 0),
    left: PADDING.left + (inset?.left ?? 0),
    right: PADDING.right + (inset?.right ?? 0),
  };
  const initial = toBounds(focus.length ? focus : markers);

  useEffect(() => {
    if (focus.length > 1) camera.current?.fitBounds(toBounds(focus), { padding, duration: 600 });
    // One place (a pickup or a place being chosen): fly to it, so the map follows the choice.
    else if (focus.length === 1) camera.current?.flyTo({ center: [focus[0].lng, focus[0].lat], zoom: 15, padding, duration: 900 });
    // Refit only when the caller says the trip changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Keep the moving driver in the centre, like a navigation app.
  useEffect(() => {
    if (!follow) return;
    camera.current?.easeTo({ center: [follow.lng, follow.lat], duration: 600 });
    // Recentre only when the position itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow?.lat, follow?.lng]);

  const markerColor = (kind: MapMarker['kind']) =>
    kind === 'dropoff' ? colors.accentFill : kind === 'driver' ? colors.successFill : colors.primaryFill;

  return (
    <View style={[styles.wrap, fill ? { flex: 1 } : { height }, style]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE}
        compass={!bare}
        logo={false}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
        touchPitch={false}
        onPress={(event) => {
          const [lng, lat] = event.nativeEvent.lngLat;
          onPick?.({ lat, lng });
        }}>
        <Camera ref={camera} initialViewState={{ bounds: initial, padding }} minZoom={4} maxZoom={19} />
        {/* The phone's own blue "you are here" dot (needs the location permission); the person replaces it. */}
        {person === undefined && <NativeUserLocation />}
        {route && route.length > 1 && (
          <GeoJSONSource id="route" data={line(route)}>
            <Layer
              id="route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.primaryFill, 'line-width': 5 }}
            />
          </GeoJSONSource>
        )}
        {approach && approach.length > 1 && (
          <GeoJSONSource id="approach" data={line(approach)}>
            <Layer
              id="approach-line"
              type="line"
              layout={{ 'line-cap': 'round' }}
              paint={{ 'line-color': colors.successFill, 'line-width': 4, 'line-dasharray': [1.5, 1.5] }}
            />
          </GeoJSONSource>
        )}
        {/* Under the pins: the radar searching around the pickup. */}
        {radar && (
          <Marker id="radar" lngLat={[radar.lng, radar.lat]} anchor="center">
            <Radar size={180}>
              <MaterialCommunityIcons name="truck-fast" size={24} color={colors.onPrimary} />
            </Radar>
          </Marker>
        )}
        {markers.map((marker) =>
          PINNED.has(marker.kind) ? (
            <Pin key={marker.id} marker={marker} color={markerColor(marker.kind)} />
          ) : (
            <Marker key={marker.id} id={marker.id} lngLat={[marker.lng, marker.lat]} anchor="center">
              <View
                accessibilityLabel={marker.label}
                style={[styles.marker, { backgroundColor: markerColor(marker.kind), borderColor: colors.surface }]}>
                <MaterialCommunityIcons name={ICONS[marker.kind]} size={18} color={colors.onPrimary} />
              </View>
            </Marker>
          ),
        )}
        {person !== undefined && <PersonPin at={person} />}
        {traveller && route && route.length > 1 && <Traveller route={route} icon={traveller} />}
      </Map>
    </View>
  );
}

/** Pickup, drop-off and a place being chosen stand on a pointer, like a sticker pinned on the map. */
const PINNED = new Set<MapMarker['kind']>(['pickup', 'dropoff', 'pick']);

/** A round head with the icon on a triangle pointing at the spot, its name above; it slides when moved. */
function Pin({ marker, color }: { marker: MapMarker; color: string }) {
  const colors = useColors();
  const at = useGlide(marker) ?? marker;
  return (
    <Marker id={marker.id} lngLat={[at.lng, at.lat]} anchor="bottom">
      <View style={styles.pin} accessibilityLabel={marker.label}>
        {marker.label && (
          <Text style={[styles.pinLabel, { color, backgroundColor: '#FFFFFF' }]} numberOfLines={1}>
            {marker.label}
          </Text>
        )}
        <View style={[styles.pinHead, { backgroundColor: color, borderColor: colors.surface }, marker.kind === 'pick' && { borderStyle: 'dashed' }]}>
          <MaterialCommunityIcons name={ICONS[marker.kind]} size={20} color={colors.onPrimary} />
        </View>
        <View style={[styles.pinTip, { borderTopColor: color }]} />
        <View style={[styles.pinSpot, { backgroundColor: color }]} />
      </View>
    </Marker>
  );
}

/** You, as a little person on a pointer; walks to a new pickup. */
function PersonPin({ at }: { at: { lat: number; lng: number } | null }) {
  const colors = useColors();
  const walker = useGlide(at);
  if (!walker) return null;
  return (
    <Marker id="person" lngLat={[walker.lng, walker.lat]} anchor="bottom">
      <View style={styles.pin}>
        <View style={[styles.pinHead, styles.personHead, { backgroundColor: colors.location }]}>
          <MaterialCommunityIcons name="human-greeting" size={22} color="#fff" />
        </View>
        <View style={[styles.pinTip, { borderTopColor: colors.location }]} />
        <View style={[styles.pinSpot, { backgroundColor: colors.location }]} />
      </View>
    </Marker>
  );
}

/** The chosen vehicle driving along the trip line, over and over. */
function Traveller({ route, icon }: { route: { lat: number; lng: number }[]; icon: NonNullable<FreightMapProps['traveller']> }) {
  const colors = useColors();
  const [k, setK] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setK(((Date.now() - start) % 5000) / 5000), 66);
    return () => clearInterval(timer);
  }, []);
  // Position along the polyline at share k of its length (by segments, close enough on a city scale).
  const segments = route.length - 1;
  const at = Math.min(segments - 1e-6, k * segments);
  const i = Math.floor(at);
  const f = at - i;
  const lng = route[i].lng + (route[i + 1].lng - route[i].lng) * f;
  const lat = route[i].lat + (route[i + 1].lat - route[i].lat) * f;
  return (
    <Marker id="traveller" lngLat={[lng, lat]} anchor="center">
      <View style={[styles.marker, { width: 30, height: 30, backgroundColor: colors.successFill, borderColor: colors.surface }]}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.onPrimary} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pin: { alignItems: 'center' },
  pinLabel: { fontSize: 12, fontWeight: '700', paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden', marginBottom: 2 },
  pinHead: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  personHead: { width: 40, height: 40, borderRadius: 20, borderColor: '#fff' },
  pinTip: { width: 0, height: 0, marginTop: -2, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  pinSpot: { width: 10, height: 4, borderRadius: 5, opacity: 0.4, marginTop: 1 },
  wrap: { borderRadius: Radius.lg, overflow: 'hidden' },
  marker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

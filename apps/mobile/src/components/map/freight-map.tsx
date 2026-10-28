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
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FreightMapProps, MapMarker } from '@/components/map/types';
import { useGlide } from '@/components/map/use-glide';
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
export function FreightMap({ markers, route, approach, focus, focusKey, follow, onPick, bare, height = 260, fill, inset, person, style }: FreightMapProps) {
  const colors = useColors();
  const walker = useGlide(person);
  const camera = useRef<CameraRef>(null);
  const padding = { ...PADDING, top: PADDING.top + (inset?.top ?? 0), bottom: PADDING.bottom + (inset?.bottom ?? 0) };
  const initial = toBounds(focus.length ? focus : markers);

  useEffect(() => {
    if (focus.length > 1) camera.current?.fitBounds(toBounds(focus), { padding, duration: 600 });
    // One place (the pickup being chosen): fly to it, so the map follows the choice.
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
        {markers.map((marker) => (
          <Marker key={marker.id} id={marker.id} lngLat={[marker.lng, marker.lat]} anchor="center">
            <View
              accessibilityLabel={marker.label}
              style={[styles.marker, { backgroundColor: markerColor(marker.kind), borderColor: colors.surface }]}>
              <MaterialCommunityIcons name={ICONS[marker.kind]} size={18} color={colors.onPrimary} />
            </View>
          </Marker>
        ))}
        {walker && (
          <Marker id="person" lngLat={[walker.lng, walker.lat]} anchor="bottom">
            <PersonPin />
          </Marker>
        )}
      </Map>
    </View>
  );
}

/** A person in a bubble, with a triangle pointing at the exact spot. */
function PersonPin() {
  const colors = useColors();
  return (
    <View style={styles.person} accessibilityLabel="you">
      <View style={[styles.personHead, { backgroundColor: colors.primaryFill, borderColor: colors.surface }]}>
        <MaterialCommunityIcons name="human-greeting" size={22} color={colors.onPrimary} />
      </View>
      <View style={[styles.personTip, { borderTopColor: colors.primaryFill }]} />
      <View style={[styles.personSpot, { backgroundColor: colors.primaryFill }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  person: { alignItems: 'center' },
  personHead: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  personTip: { width: 0, height: 0, marginTop: -2, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  personSpot: { width: 10, height: 4, borderRadius: 5, opacity: 0.4, marginTop: 1 },
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

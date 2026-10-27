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
import { bounds, type LatLng } from '@/lib/geo';
import { Radius, useColors, useTheme } from '@/theme';

const ICONS = {
  pickup: 'package-variant-closed',
  dropoff: 'flag-checkered',
  driver: 'truck',
  load: 'package-variant',
  pick: 'map-marker',
} as const;

// Free OpenStreetMap vector styles from OpenFreeMap: streets, neighbourhood names and
// buildings, with no API key. Labels follow the local names in OpenStreetMap.
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

const PADDING = { top: 60, bottom: 60, left: 60, right: 60 };

function toBounds(points: readonly LatLng[]): LngLatBounds {
  const b = bounds(points);
  return [b.minLng, b.minLat, b.maxLng, b.maxLat];
}

function line(points: LatLng[]): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) } };
}

/** Phone map: OpenStreetMap streets (MapLibre), the phone's blue location dot and freight markers. */
export function FreightMap({ markers, route, approach, focus, focusKey, follow, onPick, bare, height = 260, fill, style }: FreightMapProps) {
  const colors = useColors();
  const { scheme } = useTheme();
  const camera = useRef<CameraRef>(null);
  const initial = toBounds(focus.length ? focus : markers);

  useEffect(() => {
    if (focus.length > 1) camera.current?.fitBounds(toBounds(focus), { padding: PADDING, duration: 600 });
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
        mapStyle={STYLES[scheme === 'dark' ? 'dark' : 'light']}
        compass={!bare}
        logo={false}
        attribution
        attributionPosition={{ bottom: 8, right: 8 }}
        touchPitch={false}
        onPress={(event) => {
          const [lng, lat] = event.nativeEvent.lngLat;
          onPick?.({ lat, lng });
        }}>
        <Camera ref={camera} initialViewState={{ bounds: initial, padding: PADDING }} minZoom={4} maxZoom={19} />
        {/* The phone's own blue "you are here" dot (needs the location permission). */}
        <NativeUserLocation />
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
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
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

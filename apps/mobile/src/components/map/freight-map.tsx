import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import type { FreightMapProps, MapMarker } from '@/components/map/types';
import { bounds } from '@/lib/geo';
import { Radius, useColors, useTheme } from '@/theme';

const ICONS = {
  pickup: 'package-variant-closed',
  dropoff: 'flag-checkered',
  driver: 'truck',
  load: 'package-variant',
  pick: 'map-marker',
} as const;

/** Phone map (Apple Maps on iPhone, Google Maps on Android) with real GPS-ready markers. */
export function FreightMap({ markers, route, approach, focus, focusKey, follow, onPick, bare, height = 260, style }: FreightMapProps) {
  const colors = useColors();
  const { scheme } = useTheme();
  const ref = useRef<MapView>(null);
  const b = bounds(focus.length ? focus : markers);

  useEffect(() => {
    if (focus.length > 1) {
      ref.current?.fitToCoordinates(
        focus.map((p) => ({ latitude: p.lat, longitude: p.lng })),
        { edgePadding: { top: 60, bottom: 60, left: 60, right: 60 }, animated: true },
      );
    }
    // Refit only when the caller says the trip changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Keep the moving driver in the centre, like a navigation app.
  useEffect(() => {
    if (!follow) return;
    ref.current?.animateCamera({ center: { latitude: follow.lat, longitude: follow.lng } }, { duration: 600 });
    // Recentre only when the position itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow?.lat, follow?.lng]);

  const markerColor = (kind: MapMarker['kind']) =>
    kind === 'dropoff' ? colors.accentFill : kind === 'driver' ? colors.successFill : colors.primaryFill;

  return (
    <View style={[styles.wrap, { height }, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: (b.minLat + b.maxLat) / 2,
          longitude: (b.minLng + b.maxLng) / 2,
          latitudeDelta: b.maxLat - b.minLat,
          longitudeDelta: b.maxLng - b.minLng,
        }}
        // The phone's own blue "you are here" dot and the system "my location" button.
        showsUserLocation
        showsMyLocationButton={!bare}
        showsCompass={!bare}
        showsBuildings
        showsPointsOfInterests
        userInterfaceStyle={scheme}
        onPress={(event) =>
          onPick?.({ lat: event.nativeEvent.coordinate.latitude, lng: event.nativeEvent.coordinate.longitude })
        }>
        {route && route.length > 1 && (
          <Polyline
            coordinates={route.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={colors.primaryFill}
            strokeWidth={4}
          />
        )}
        {approach && approach.length > 1 && (
          <Polyline
            coordinates={approach.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={colors.successFill}
            strokeWidth={3}
            lineDashPattern={[6, 6]}
          />
        )}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.lat, longitude: marker.lng }}
            title={marker.label}
            anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.marker, { backgroundColor: markerColor(marker.kind), borderColor: colors.surface }]}>
              <MaterialCommunityIcons name={ICONS[marker.kind]} size={18} color={colors.onPrimary} />
            </View>
          </Marker>
        ))}
      </MapView>
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

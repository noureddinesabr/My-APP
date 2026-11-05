import { Camera, type CameraRef, GeoJSONSource, Layer, Map, Marker, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useT } from '../i18n';
import { bounds } from '../lib/geo';
import type { BackdropProps } from './backdrop-types';
import { MeDot, PIN, TripPin } from './pins';
import { DEFAULT_CENTER, useMapTrip, useMyLocation, useRoadRoute } from './trip';

// The same free OpenStreetMap style as the first Xapp app (OpenFreeMap, no API key). Its
// labels are hidden so they never run through the words written over the map.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
let cachedStyle: StyleSpecification | null = null;

function useQuietStyle() {
  const [style, setStyle] = useState<StyleSpecification | string | null>(cachedStyle);
  useEffect(() => {
    if (cachedStyle) return;
    fetch(STYLE_URL)
      .then((r) => r.json())
      .then((s: StyleSpecification) => {
        cachedStyle = { ...s, layers: s.layers.filter((l) => l.type !== 'symbol') };
        setStyle(cachedStyle);
      })
      .catch(() => setStyle(STYLE_URL));
  }, []);
  return style;
}

/** The live street map behind every screen, with the trip shown in the clear strip under the top buttons. */
export function MapBackdrop({ window, veil }: BackdropProps) {
  const { t } = useT();
  const { height } = useWindowDimensions();
  const style = useQuietStyle();
  const trip = useMapTrip();
  const me = useMyLocation();
  const route = useRoadRoute(trip.from, trip.to);
  const camera = useRef<CameraRef>(null);
  const padding = { top: window.top + 70, bottom: Math.max(40, height - window.top - window.height + 10), left: 50, right: 50 };
  const points = [trip.from, trip.to].filter((p): p is NonNullable<typeof p> => !!p);
  const focus = points.length ? points : me ? [me] : [];
  const key = focus.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(';');

  useEffect(() => {
    if (focus.length > 1) {
      const b = bounds(focus, 0.05, 0.002);
      camera.current?.fitBounds([b.minLng, b.minLat, b.maxLng, b.maxLat], { padding, duration: 700 });
    } else if (focus.length === 1) camera.current?.flyTo({ center: [focus[0].lng, focus[0].lat], zoom: 14.5, padding, duration: 800 });
    // Moves only when the places change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, style]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {style ? (
        <Map style={StyleSheet.absoluteFill} mapStyle={style} logo={false} compass={false} attribution={false} dragPan={false} touchZoom={false} touchRotate={false} touchPitch={false}>
          <Camera ref={camera} initialViewState={{ center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat], zoom: 12.5, padding }} />
          {route.length > 1 && (
            <GeoJSONSource id="route" data={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.map((p) => [p.lng, p.lat]) } }}>
              <Layer id="route-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#FFFFFF', 'line-width': 9 }} />
              <Layer id="route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': PIN.route, 'line-width': 4.5 }} />
            </GeoJSONSource>
          )}
          {me && (
            <Marker id="me" lngLat={[me.lng, me.lat]} anchor="center">
              <MeDot />
            </Marker>
          )}
          {trip.from && (
            <Marker id="pickup" lngLat={[trip.from.lng, trip.from.lat]} anchor="bottom">
              <TripPin kind="pickup" label={t('mapPickup')} />
            </Marker>
          )}
          {trip.to && (
            <Marker id="dropoff" lngLat={[trip.to.lng, trip.to.lat]} anchor="bottom">
              <TripPin kind="dropoff" label={t('mapDropoff')} />
            </Marker>
          )}
        </Map>
      ) : null}
      <View style={{ position: 'absolute', left: 0, right: 0, top: window.top + window.height, bottom: 0, backgroundColor: veil }} />
    </View>
  );
}

import { Camera, type CameraRef, GeoJSONSource, Layer, Map, Marker, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useT } from '../i18n';
import { bounds } from '../lib/geo';
import type { BackdropProps } from './backdrop-types';
import { PersonPin, PIN, Radar, TripPin } from './pins';
import { DEFAULT_CENTER, useMapRadar, useMapTrip, useMyLocation, useRecenter, useRoadRoute } from './trip';
import { Veil } from './veil';

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

/**
 * The live street map behind every screen. The strip under the top buttons is the part you see
 * and can move with a finger (drag, pinch); it shows you, then the pickup, destination and road.
 */
export function MapBackdrop(props: BackdropProps) {
  const { window } = props;
  const { t } = useT();
  const { height } = useWindowDimensions();
  const style = useQuietStyle();
  const trip = useMapTrip();
  const me = useMyLocation();
  const route = useRoadRoute(trip.from, trip.to);
  const again = useRecenter();
  const radar = useMapRadar();
  const camera = useRef<CameraRef>(null);
  const padding = { top: window.top + 64, bottom: Math.max(40, height - window.top - window.height + 14), left: 50, right: 50 };
  const points = [trip.from, trip.to].filter((p): p is NonNullable<typeof p> => !!p);
  const focus = points.length ? points : me ? [me] : [];
  const key = focus.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(';');

  useEffect(() => {
    if (focus.length > 1) {
      const b = bounds(focus, 0.05, 0.002);
      camera.current?.fitBounds([b.minLng, b.minLat, b.maxLng, b.maxLat], { padding, duration: 700 });
    } else if (focus.length === 1) camera.current?.flyTo({ center: [focus[0].lng, focus[0].lat], zoom: 15, padding, duration: 800 });
    // Moves only when the places change or "show the trip again" is tapped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, style, again]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {style ? (
        <Map style={StyleSheet.absoluteFill} mapStyle={style} logo={false} compass={false} attribution={false} touchRotate={false} touchPitch={false}>
          <Camera ref={camera} initialViewState={{ center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat], zoom: 12.5, padding }} minZoom={5} maxZoom={18} />
          {route.length > 1 && (
            <GeoJSONSource id="route" data={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.map((p) => [p.lng, p.lat]) } }}>
              <Layer id="route-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#FFFFFF', 'line-width': 9 }} />
              <Layer id="route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': PIN.route, 'line-width': 4.5 }} />
            </GeoJSONSource>
          )}
          {/* You, until the trip's own pins take over. */}
          {me && !points.length && (
            <Marker id="me" lngLat={[me.lng, me.lat]} anchor="bottom">
              <PersonPin label={t('mapYou')} />
            </Marker>
          )}
          {radar && trip.from && (
            <Marker id="radar" lngLat={[trip.from.lng, trip.from.lat]} anchor="center">
              <Radar size={220} />
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
      <Veil {...props} />
    </View>
  );
}

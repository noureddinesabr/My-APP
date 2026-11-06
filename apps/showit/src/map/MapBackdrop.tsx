import { Camera, type CameraRef, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useT } from '../i18n';
import { bounds } from '../lib/geo';
import type { BackdropProps } from './backdrop-types';
import { PersonPin, PIN, Radar, TripPin } from './pins';
import { DEFAULT_CENTER, useMapRadar, useMapTrip, useMyLocation, useRecenter, useRoadRoute } from './trip';
import { Veil } from './veil';
import { useQuietStyle } from './style';

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

  // Where the map opens: for a trip, a wider view around it, from which the camera then zooms in
  // (animated) until the pickup and destination fill the clear part of the screen; otherwise you.
  const fitted = focus.length > 1 ? bounds(focus, 0.05, 0.002) : null;
  const wideZoom = fitted ? Math.max(4.5, Math.min(13, Math.log2(360 / Math.max(fitted.maxLng - fitted.minLng, (fitted.maxLat - fitted.minLat) * 1.3, 0.002)) - 2.2)) : 0;
  const initialViewState = fitted
    ? { center: [(fitted.minLng + fitted.maxLng) / 2, (fitted.minLat + fitted.maxLat) / 2] as [number, number], zoom: wideZoom }
    : { center: (focus[0] ? [focus[0].lng, focus[0].lat] : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat]) as [number, number], zoom: focus[0] ? 15 : 12.5, padding };
  const frame = (duration: number) => {
    if (focus.length > 1 && fitted) camera.current?.fitBounds([fitted.minLng, fitted.minLat, fitted.maxLng, fitted.maxLat], { padding, duration });
    else if (focus.length === 1) camera.current?.flyTo({ center: [focus[0].lng, focus[0].lat], zoom: 15, padding, duration });
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;
  useEffect(() => {
    frameRef.current(900);
    // Once more after the map has drawn, in case it was still loading.
    const later = setTimeout(() => frameRef.current(1400), 1500);
    return () => clearTimeout(later);
    // Moves when the places change, the clear part of the screen changes size (offers arrive), or on "show the trip again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, style, again, window.top, window.height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {style ? (
        <Map key={key || 'none'} style={StyleSheet.absoluteFill} mapStyle={style} logo={false} compass={false} attribution={false} touchRotate={false} touchPitch={false} onDidFinishLoadingMap={() => setTimeout(() => frameRef.current(1800), 250)}>
          <Camera ref={camera} initialViewState={initialViewState} minZoom={4} maxZoom={18} />
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

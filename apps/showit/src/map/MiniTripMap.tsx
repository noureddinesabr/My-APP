import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

import { useT } from '../i18n';
import { bounds, type LatLng } from '../lib/geo';
import { TripPin, PIN } from './pins';
import { useRoadRoute } from './trip';
import { useQuietStyle } from './style';

export type MiniTripMapProps = { from: LatLng; to: LatLng; height: number };

/**
 * A small live map of the chosen trip (round 8): pickup, destination and the road between them,
 * framed to fit. It doesn't take touches, so the page around it scrolls normally.
 */
export function MiniTripMap({ from, to, height }: MiniTripMapProps) {
  const { t } = useT();
  const style = useQuietStyle();
  const route = useRoadRoute(from, to);
  const b = bounds([from, to], 0.25, 0.004);
  return (
    <View pointerEvents="none" style={{ height, borderRadius: 18, overflow: 'hidden', backgroundColor: '#F2EFE9' }}>
      {style ? (
        <Map key={`${from.lat},${from.lng};${to.lat},${to.lng}`} androidView="texture" style={StyleSheet.absoluteFill} mapStyle={style} logo={false} compass={false} attribution={false} dragPan={false} touchZoom={false} doubleTapZoom={false} touchRotate={false} touchPitch={false}>
          <Camera initialViewState={{ bounds: [b.minLng, b.minLat, b.maxLng, b.maxLat], padding: { top: 70, bottom: 16, left: 40, right: 40 } }} />
          {route.length > 1 && (
            <GeoJSONSource id="mini-route" data={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.map((p) => [p.lng, p.lat]) } }}>
              <Layer id="mini-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#FFFFFF', 'line-width': 7 }} />
              <Layer id="mini-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': PIN.route, 'line-width': 3.5 }} />
            </GeoJSONSource>
          )}
          <Marker id="mini-pickup" lngLat={[from.lng, from.lat]} anchor="bottom">
            <TripPin kind="pickup" label={t('mapPickup')} />
          </Marker>
          <Marker id="mini-dropoff" lngLat={[to.lng, to.lat]} anchor="bottom">
            <TripPin kind="dropoff" label={t('mapDropoff')} />
          </Marker>
        </Map>
      ) : null}
    </View>
  );
}

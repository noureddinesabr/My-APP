import { Camera, type CameraRef, Map, Marker } from '@maplibre/maplibre-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { LatLng } from '../lib/geo';
import { MeDot } from './pins';
import { useQuietStyle } from './style';
import { useColors } from '../ui';

export type PickMapProps = {
  /** Where the map opens. */
  start: LatLng;
  /** How close it opens (15.5 by default; a whole city ≈ 12). */
  zoom?: number;
  /** Move the map here (a new `seq` each time). */
  target: { point: LatLng; seq: number } | null;
  /** The phone's position, shown as a dot. */
  me: LatLng | null;
  /** The point under the pin in the middle, each time the map stops moving. */
  onMove: (center: LatLng) => void;
  /** Called while a finger moves the map (the pin lifts). */
  onDrag?: (dragging: boolean) => void;
};

/** A live map you move under a fixed pin in its middle, to choose a spot. */
export function PickMap({ start, zoom = 15.5, target, me, onMove, onDrag }: PickMapProps) {
  const c = useColors();
  const style = useQuietStyle();
  const camera = useRef<CameraRef>(null);
  useEffect(() => {
    if (target) camera.current?.flyTo({ center: [target.point.lng, target.point.lat], zoom: 16.5, duration: 900 });
  }, [target?.seq]);
  if (!style) return <View style={[StyleSheet.absoluteFill, { backgroundColor: c.mapBg }]} />;
  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={style}
      androidView="texture"
      logo={false}
      compass={false}
      attribution={false}
      touchRotate={false}
      touchPitch={false}
      onRegionWillChange={(e) => e.nativeEvent.userInteraction && onDrag?.(true)}
      onRegionDidChange={(e) => {
        onDrag?.(false);
        const [lng, lat] = e.nativeEvent.center;
        onMove({ lat, lng });
      }}>
      <Camera ref={camera} initialViewState={{ center: [start.lng, start.lat], zoom }} minZoom={5} maxZoom={19} />
      {me ? (
        <Marker id="me" lngLat={[me.lng, me.lat]} anchor="center">
          <MeDot />
        </Marker>
      ) : null}
    </Map>
  );
}

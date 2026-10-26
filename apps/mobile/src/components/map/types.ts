import type { StyleProp, ViewStyle } from 'react-native';

import type { LatLng } from '@/lib/geo';

export type MapMarker = LatLng & {
  id: string;
  kind: 'pickup' | 'dropoff' | 'driver' | 'load' | 'pick';
  /** Shown next to the marker. */
  label?: string;
};

export type FreightMapProps = {
  markers: MapMarker[];
  /** The trip line, pickup → drop-off. */
  route?: LatLng[];
  /** The driver's way to the pickup, drawn dotted. */
  approach?: LatLng[];
  /** Points the map keeps in view; refits when their key changes. */
  focus: LatLng[];
  /** Change it to refit the view (e.g. when the trip changes). */
  focusKey?: string;
  /** Keep the map centred on this point as it moves (the driver), until the user pans away. */
  follow?: LatLng | null;
  /** Tap on the map to pick a point. */
  onPick?: (point: LatLng) => void;
  /** The phone's own position, drawn as the blue "you are here" dot. */
  userLocation?: LatLng | null;
  /** Hide the zoom / fit buttons (e.g. a full-screen home map with its own controls). */
  bare?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

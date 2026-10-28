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
  /**
   * The client as a little person on a pointer, standing where their pickup is (from GPS or
   * picked by hand); it walks to a new place when that changes. Replaces the blue dot.
   */
  person?: LatLng | null;
  /** An icon (the chosen vehicle) driving along `route` again and again, so the trip feels real. */
  traveller?: 'truck' | 'truck-fast' | 'van-utility' | 'car-pickup' | 'rickshaw' | 'truck-snowflake' | 'truck-flatbed' | 'truck-trailer' | 'truck-cargo-container' | 'truck-outline';
  /** Hide the zoom / fit buttons (e.g. a full-screen home map with its own controls). */
  bare?: boolean;
  height?: number;
  /** Space covered by things drawn over the map (buttons on top, a panel below), kept clear when fitting the trip. */
  inset?: { top: number; bottom: number };
  /** Fill the parent (flex) instead of a fixed height. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
};

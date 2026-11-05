import type { Animated } from 'react-native';

/** The clear strip of map under the top buttons, in screen points. */
export type MapWindow = { top: number; height: number };

export type BackdropProps = {
  window: MapWindow;
  /** Veil over the rest of the map so text on it stays readable (warm white or ink). */
  veil: string;
  /** How far the screen is scrolled: the clear strip closes and the pins fade as the words move up. */
  scrollY: Animated.Value;
};

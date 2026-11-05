import { Animated, StyleSheet } from 'react-native';

import type { BackdropProps } from './backdrop-types';

/** The veil over the map below the clear strip; it slides up to cover the strip as the screen scrolls. */
export function Veil({ window, veil, scrollY }: BackdropProps) {
  const bottom = window.top + window.height;
  const translateY = scrollY.interpolate({ inputRange: [0, bottom], outputRange: [bottom, 0], extrapolate: 'clamp' });
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: veil, transform: [{ translateY }] }]} />;
}

/** Pins fade out once the words start moving over them. */
export const pinFade = (scrollY: Animated.Value) => scrollY.interpolate({ inputRange: [0, 90], outputRange: [1, 0], extrapolate: 'clamp' });

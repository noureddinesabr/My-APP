import { View } from 'react-native';

import type { BackdropProps } from './backdrop-types';

/** The veil over the map below the clear strip; it never covers the strip. */
export function Veil({ window, veil }: BackdropProps) {
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: window.top + window.height, bottom: 0, backgroundColor: veil }} />;
}

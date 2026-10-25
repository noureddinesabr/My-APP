import * as ExpoLocation from 'expo-location';

import type { LatLng } from '@/lib/geo';

/** The device's current position, or null when permission is refused or GPS is unavailable. */
export async function currentPosition(): Promise<LatLng | null> {
  try {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const position = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    return null;
  }
}

/** Follows the device's position while driving. Resolves null when GPS can't be used. */
export async function watchPosition(onChange: (point: LatLng) => void): Promise<(() => void) | null> {
  try {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const subscription = await ExpoLocation.watchPositionAsync(
      { accuracy: ExpoLocation.Accuracy.High, distanceInterval: 25, timeInterval: 4000 },
      (position) => onChange({ lat: position.coords.latitude, lng: position.coords.longitude }),
    );
    return () => subscription.remove();
  } catch {
    return null;
  }
}

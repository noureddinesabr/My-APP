import { Platform } from 'react-native';

import { saveForRestart } from './resume';

/**
 * Expo updates (EAS Update): when the app opens, it asks expo.dev for a newer version of its code
 * (same app version = same APK). If there is one it downloads it, tells the tester, remembers the
 * page in view (`resume.ts`) and restarts into it. Nothing happens in the browser preview, in
 * development, or in an APK built without the owner's Expo link (updates switched off).
 */
export async function checkForUpdate(onReady: () => void) {
  if (Platform.OS === 'web' || __DEV__) return;
  try {
    const Updates = await import('expo-updates');
    if (!Updates.isEnabled) return;
    const found = await Updates.checkForUpdateAsync();
    if (!found.isAvailable) return;
    const got = await Updates.fetchUpdateAsync();
    if (!got.isNew) return;
    onReady();
    await saveForRestart();
    await new Promise((r) => setTimeout(r, 2500));
    await Updates.reloadAsync();
  } catch {
    // No network or no update service: the app simply keeps running this version.
  }
}

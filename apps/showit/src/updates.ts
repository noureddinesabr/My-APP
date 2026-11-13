import { Platform } from 'react-native';

import { saveForRestart } from './resume';
import { getState, isLive } from './store';
import { openLayers } from './overlay';
import { layerNow, pageNow } from './where';

/**
 * Expo updates (EAS Update): when the app opens, it asks expo.dev for a newer version of its code
 * (same app version = same APK) and downloads it in the background. It restarts into it only at a
 * quiet moment (round 9): on the first page (customer "Show it", driver "loads"), with no page, chat,
 * sheet or call screen open (`openLayers`), no trip or job in progress and no finished trip still to confirm or rate. Until
 * then it waits and checks again every 20 seconds; if the app is closed first, the new version
 * simply starts the next time it opens. Nothing happens in the browser preview, in development, or
 * in an APK built without the owner's Expo link.
 */
const quiet = () => {
  const page = pageNow();
  const firstPage = page === 'customer · show' || page === 'driver · loads';
  const busyTrip = getState().requests.some((r) => isLive(r.stage) || (r.stage === 'delivered' && !r.rating && !r.receivedAt && Date.now() - (r.deliveredAt ?? 0) < 24 * 3600 * 1000));
  return firstPage && !layerNow() && !openLayers() && !busyTrip;
};

export async function checkForUpdate(onReady: () => void) {
  if (Platform.OS === 'web' || __DEV__) return;
  try {
    const Updates = await import('expo-updates');
    if (!Updates.isEnabled) return;
    const found = await Updates.checkForUpdateAsync();
    if (!found.isAvailable) return;
    const got = await Updates.fetchUpdateAsync();
    if (!got.isNew) return;
    // Wait for a quiet moment (checked every 20 s) before restarting.
    while (!quiet()) await new Promise((r) => setTimeout(r, 20_000));
    onReady();
    await saveForRestart();
    await new Promise((r) => setTimeout(r, 2500));
    // Still quiet after the notice (the tester didn't just open something): restart now.
    if (quiet()) await Updates.reloadAsync();
  } catch {
    // No network or no update service: the app simply keeps running this version.
  }
}

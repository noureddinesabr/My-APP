import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Round 9 (#101): switching between Arabic and French/English restarts the app on phones (the
 * layout flips direction). Before that restart, each open part of the app saves where it is (the
 * customer's page and progress, the open tab or settings, the driver's sign-up step); after it,
 * they open there again, as if nothing happened. Only a restart within a minute is resumed.
 */
const KEY = 'xapp.restart';
const savers = new Map<string, () => unknown>();
let restored: Record<string, unknown> = {};

/** Registers what a part of the app saves before a language restart. Returns the unregister. */
export function saveOnRestart(key: string, fn: () => unknown) {
  savers.set(key, fn);
  return () => {
    if (savers.get(key) === fn) savers.delete(key);
  };
}

/** Saves every registered part (called right before the restart). */
export async function saveForRestart() {
  const data: Record<string, unknown> = {};
  savers.forEach((fn, key) => {
    try {
      data[key] = fn();
    } catch {
      // A part that can't be saved simply opens fresh.
    }
  });
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Nothing saved: the app opens on its first page, as before.
  }
}

/** At start-up: reads (and forgets) what was saved before a recent language restart. */
export async function loadRestart() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;
    await AsyncStorage.removeItem(KEY);
    const saved = JSON.parse(raw) as { at: number; data: Record<string, unknown> };
    if (Date.now() - saved.at < 60_000) restored = saved.data ?? {};
  } catch {
    restored = {};
  }
}

/** What a part saved before the restart, given once (later calls get nothing). */
export function takeRestored<T>(key: string): T | undefined {
  const v = restored[key] as T | undefined;
  delete restored[key];
  return v;
}

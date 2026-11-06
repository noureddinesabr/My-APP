import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * The phone's back button (and the browser's, in the preview) goes back one page in the app.
 * Each open page or layer that can go back registers a handler; the newest one runs first.
 * When none is registered, the phone does its usual thing (leaves the app).
 *
 * In the browser, one extra history entry ("guard") is kept while there is somewhere to go
 * back to; pressing back uses it up, runs the handler, and puts it back if still needed.
 */
type Handler = { fn: () => void };
const stack: Handler[] = [];
const web = Platform.OS === 'web' && typeof window !== 'undefined';
let guard = false;

const ensureGuard = () => {
  if (!web || guard || !stack.length) return;
  try {
    window.history.pushState({ xappGuard: true }, '');
    guard = true;
  } catch {
    // History may be locked in some frames: the in-app buttons still work.
  }
};

if (Platform.OS !== 'web') {
  BackHandler.addEventListener('hardwareBackPress', () => {
    const top = stack[stack.length - 1];
    if (!top) return false;
    top.fn();
    return true;
  });
} else if (web) {
  window.addEventListener('popstate', () => {
    guard = false;
    const top = stack[stack.length - 1];
    if (top) top.fn();
    // Still somewhere to go back to after this step: keep a guard entry.
    setTimeout(ensureGuard, 60);
  });
}

/** While `active`, the back button calls `onBack` (e.g. close this layer, or go to the previous step). */
export function useBack(active: boolean, onBack: () => void) {
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (!active) return;
    const handler: Handler = { fn: () => latest.current() };
    stack.push(handler);
    ensureGuard();
    return () => {
      const i = stack.indexOf(handler);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

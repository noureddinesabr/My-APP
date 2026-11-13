/**
 * Which page is on screen, in a few words, for test reports ("customer · card", "tab · messages").
 * Screens set it as they show; the report button reads it when tapped.
 */
let page = '';
let layer = '';
export const setPage = (name: string) => {
  page = name;
};
/** A page opened over the screen (a top tab, a chat); '' when it closes. */
export const setLayer = (name: string) => {
  layer = name;
  listeners.forEach((l) => l());
};
export const whereNow = () => [page, layer].filter(Boolean).join(' › ');

/** The trip (request id) whose page or conversation is on screen, so its news needs no banner. */
let trip = '';
let chatTrip = '';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const setTripOnScreen = (id: string) => {
  trip = id;
  emit();
};
export const setChatOnScreen = (id: string) => {
  chatTrip = id;
  emit();
};
/** Re-renders the caller when the trip or chat on screen changes (a banner about it then steps aside). */
export const onScreenChange = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const tripOnScreen = (id?: string) => !!id && (chatTrip === id || (!layer && trip === id));
/** The page and the layer on screen (for the update check: restart only on a quiet first page). */
export const pageNow = () => page;
export const layerNow = () => layer;

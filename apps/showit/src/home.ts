/** The X logo: "go to the main page" for whichever side is showing (progress is kept). */
const listeners = new Set<() => void>();
export function goHome() {
  listeners.forEach((l) => l());
}
export function onHome(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** A tapped notification opens the request or job it is about. */
const tripListeners = new Set<() => void>();
export function openTrip() {
  tripListeners.forEach((l) => l());
}
export function onOpenTrip(fn: () => void) {
  tripListeners.add(fn);
  return () => {
    tripListeners.delete(fn);
  };
}

/** Opens a page from the top bar (messages, offers, profile), optionally a conversation. */
export type TabId = 'messages' | 'offers' | 'profile';
const tabListeners = new Set<(tab: TabId, chat?: string) => void>();
export function openTab(tab: TabId, chat?: string) {
  tabListeners.forEach((l) => l(tab, chat));
}
export function onOpenTab(fn: (tab: TabId, chat?: string) => void) {
  tabListeners.add(fn);
  return () => {
    tabListeners.delete(fn);
  };
}

/** Shops and businesses (round 7): start a new request like a past one (same route and load). */
const repeatListeners = new Set<(id: string) => void>();
export function repeatRequest(id: string) {
  repeatListeners.forEach((l) => l(id));
}
export function onRepeat(fn: (id: string) => void) {
  repeatListeners.add(fn);
  return () => {
    repeatListeners.delete(fn);
  };
}

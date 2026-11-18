import { useEffect, useState } from 'react';

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
export type TabId = 'messages' | 'offers' | 'earnings' | 'profile' | 'map';
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

/**
 * Xapp Freight, owner's rule: the customer's first page is the camera alone, filling the whole
 * screen (no top bar, no bottom bar). The camera's menu button brings the bars back over it.
 */
let cameraFull = false;
let barsOpen = false;
const cameraListeners = new Set<() => void>();
const emitCamera = () => cameraListeners.forEach((l) => l());
export function setCameraFull(on: boolean) {
  if (on === cameraFull) return;
  cameraFull = on;
  barsOpen = false;
  emitCamera();
}
export function setBarsOpen(on: boolean) {
  if (on === barsOpen) return;
  barsOpen = on;
  emitCamera();
}
export function useCameraFull(): { full: boolean; bars: boolean } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    cameraListeners.add(l);
    return () => {
      cameraListeners.delete(l);
    };
  }, []);
  return { full: cameraFull, bars: barsOpen };
}

/** Owner's report #11: the driver's status card stays fixed at the top of his loads page. */
let driverHeader = false;
const headerListeners = new Set<() => void>();
export function setDriverHeader(on: boolean) {
  if (on === driverHeader) return;
  driverHeader = on;
  headerListeners.forEach((l) => l());
}
export function useDriverHeader(): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    headerListeners.add(l);
    return () => {
      headerListeners.delete(l);
    };
  }, []);
  return driverHeader;
}

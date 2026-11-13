import * as Location from 'expo-location';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import type { LatLng } from '../lib/geo';

/** What the map behind the screens shows: the trip being prepared or running. */
export type MapTrip = { from?: LatLng; to?: LatLng };

let trip: MapTrip = {};
const listeners = new Set<() => void>();
const same = (a?: LatLng, b?: LatLng) => a?.lat === b?.lat && a?.lng === b?.lng;

/** Screens call this with the pickup / destination they know about. */
export function setMapTrip(next: MapTrip) {
  if (same(next.from, trip.from) && same(next.to, trip.to)) return;
  trip = next;
  listeners.forEach((l) => l());
}

export const useMapTrip = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => trip,
  );

/** The phone's position (asks for the location permission once); null until known or if refused. */
export function useMyLocation() {
  const [me, setMe] = useState<LatLng | null>(null);
  useEffect(() => {
    let stop: (() => void) | undefined;
    let dead = false;
    (async () => {
      try {
        if (Platform.OS === 'web') {
          if (!navigator.geolocation) return;
          const id = navigator.geolocation.watchPosition(
            (p) => !dead && setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => {},
            { enableHighAccuracy: true, maximumAge: 30000 },
          );
          stop = () => navigator.geolocation.clearWatch(id);
          return;
        }
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted || dead) return;
        const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 25 }, (p) =>
          setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
        );
        stop = () => sub.remove();
        if (dead) stop();
      } catch {
        // No location: the map simply shows no "you are here" dot.
      }
    })();
    return () => {
      dead = true;
      stop?.();
    };
  }, []);
  return me;
}

const routes = new Map<string, LatLng[]>();

/**
 * The road between two places (OpenStreetMap routing, OSRM demo server). Until it arrives, or
 * where it can't be reached, a straight line stands in.
 */
export function useRoadRoute(from?: LatLng, to?: LatLng): LatLng[] {
  const key = from && to ? `${from.lat},${from.lng};${to.lat},${to.lng}` : '';
  const [, bump] = useState(0);
  useEffect(() => {
    if (!from || !to || routes.has(key)) return;
    let dead = false;
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=simplified&geometries=geojson`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        const coords: [number, number][] | undefined = j?.routes?.[0]?.geometry?.coordinates;
        if (coords?.length) routes.set(key, coords.map(([lng, lat]) => ({ lat, lng })));
        if (!dead) bump((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
    // The key holds both places.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!from || !to) return [];
  return routes.get(key) ?? [from, to];
}

/** Casablanca: where the map starts before anything is known. */
export const DEFAULT_CENTER: LatLng = { lat: 33.5731, lng: -7.5898 };

let recenterCount = 0;
const recenterListeners = new Set<() => void>();
/** Brings the map back to the trip (or to you) after it was moved by hand. */
export function recenter() {
  recenterCount += 1;
  recenterListeners.forEach((l) => l());
}
export const useRecenter = () =>
  useSyncExternalStore(
    (l) => {
      recenterListeners.add(l);
      return () => recenterListeners.delete(l);
    },
    () => recenterCount,
  );

let mapShown = true;
const shownListeners = new Set<() => void>();
/** Hides the map strip on screens that need the whole phone (the first steps of a request). */
export function setMapShown(shown: boolean) {
  if (shown === mapShown) return;
  mapShown = shown;
  shownListeners.forEach((l) => l());
}
export const useMapShown = () =>
  useSyncExternalStore(
    (l) => {
      shownListeners.add(l);
      return () => shownListeners.delete(l);
    },
    () => mapShown,
  );

let mapBig = false;
const bigListeners = new Set<() => void>();
/** A big map (most of the screen) while a sent request waits for offers. */
export function setMapBig(big: boolean) {
  if (big === mapBig) return;
  mapBig = big;
  bigListeners.forEach((l) => l());
}
export const useMapBig = () =>
  useSyncExternalStore(
    (l) => {
      bigListeners.add(l);
      return () => bigListeners.delete(l);
    },
    () => mapBig,
  );

let radarOn = false;
const radarListeners = new Set<() => void>();
/** The radar around the pickup while a sent request looks for drivers. */
export function setMapRadar(on: boolean) {
  if (on === radarOn) return;
  radarOn = on;
  radarListeners.forEach((l) => l());
}
export const useMapRadar = () =>
  useSyncExternalStore(
    (l) => {
      radarListeners.add(l);
      return () => radarListeners.delete(l);
    },
    () => radarOn,
  );

let panelHeight = 0;
const panelListeners = new Set<() => void>();
/** How tall the cards floating at the bottom are, so the map frames the trip in the space above them. */
export function setMapPanel(height: number) {
  const h = Math.round(height);
  if (Math.abs(h - panelHeight) < 4) return;
  panelHeight = h;
  panelListeners.forEach((l) => l());
}
export const useMapPanel = () =>
  useSyncExternalStore(
    (l) => {
      panelListeners.add(l);
      return () => panelListeners.delete(l);
    },
    () => panelHeight,
  );

/** Asks the phone once where it is (null when refused, off or unavailable). */
export async function locateOnce(): Promise<LatLng | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
      return await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
        );
      });
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60000 });
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: now.coords.latitude, lng: now.coords.longitude };
  } catch {
    return null;
  }
}

/** The vehicle on its way (moving dot on the map), separate from the trip so it can move often. */
let vehicle: LatLng | null = null;
const vehicleListeners = new Set<() => void>();
export function setMapVehicle(next: LatLng | null) {
  if (next === vehicle || (next && vehicle && next.lat === vehicle.lat && next.lng === vehicle.lng)) return;
  vehicle = next;
  vehicleListeners.forEach((l) => l());
}
export const useMapVehicle = () =>
  useSyncExternalStore(
    (l) => {
      vehicleListeners.add(l);
      return () => vehicleListeners.delete(l);
    },
    () => vehicle,
  );

// ---- Report screenshots (test version) ----
// The map surface is drawn on top of everything in a screen capture, so the report button takes
// the map alone first, then hides the map for a moment and captures the app over its background.
/** The view that holds the live map (for its own picture). */
export const mapShotRef: { current: unknown } = { current: null };
let hiddenForShot = false;
const shotListeners = new Set<() => void>();
export function setMapHiddenForShot(hidden: boolean) {
  hiddenForShot = hidden;
  shotListeners.forEach((l) => l());
}
export const useMapHiddenForShot = () =>
  useSyncExternalStore(
    (l) => {
      shotListeners.add(l);
      return () => shotListeners.delete(l);
    },
    () => hiddenForShot,
  );

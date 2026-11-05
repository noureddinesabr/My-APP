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

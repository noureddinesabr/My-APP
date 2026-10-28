import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { Location } from '@/constants/places';

const KEY = 'xapp.recentPlaces';
const MAX = 8;
let recent: Location[] = [];
const listeners = new Set<(list: Location[]) => void>();

AsyncStorage.getItem(KEY)
  .then((saved) => {
    if (!saved) return;
    recent = JSON.parse(saved) as Location[];
    listeners.forEach((listener) => listener(recent));
  })
  .catch(() => {});

const same = (a: Location, b: Location) => (a.placeId && a.placeId === b.placeId) || (Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4);

/** Remembers a place the user picked, most recent first (kept on the phone). */
export function rememberPlace(location: Location) {
  recent = [location, ...recent.filter((item) => !same(item, location))].slice(0, MAX);
  AsyncStorage.setItem(KEY, JSON.stringify(recent)).catch(() => {});
  listeners.forEach((listener) => listener(recent));
}

/** Places picked before, for one-tap reuse (like a map app's history). */
export function useRecentPlaces() {
  const [list, setList] = useState(recent);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}

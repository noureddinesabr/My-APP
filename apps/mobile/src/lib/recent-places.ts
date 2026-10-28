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
    // Older lists could hold the same spot twice (GPS readings a few metres apart).
    recent = (JSON.parse(saved) as Location[]).filter((item, index, all) => all.findIndex((other) => same(other, item)) === index);
    listeners.forEach((listener) => listener(recent));
  })
  .catch(() => {});

/** The same place: same named place, or two points less than about 150 m apart (GPS moves a little). */
const same = (a: Location, b: Location) => (a.placeId && a.placeId === b.placeId) || (Math.abs(a.lat - b.lat) < 0.0015 && Math.abs(a.lng - b.lng) < 0.0015);

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

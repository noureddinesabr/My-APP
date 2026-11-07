import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { useEffect, useState } from 'react';

import { useStore } from '../store';

// The same free OpenStreetMap style as the first Xapp app (OpenFreeMap, no API key). Its
// labels are hidden so they never run through the words written over the map.
// In dark mode the same map comes in OpenFreeMap's dark style, so it isn't glaring at night.
const STYLE_URLS = { light: 'https://tiles.openfreemap.org/styles/liberty', dark: 'https://tiles.openfreemap.org/styles/dark' } as const;
const cached: Partial<Record<keyof typeof STYLE_URLS, StyleSpecification>> = {};

export function useQuietStyle() {
  const look = useStore().appearance === 'dark' ? 'dark' : 'light';
  const [style, setStyle] = useState<StyleSpecification | string | null>(cached[look] ?? null);
  useEffect(() => {
    if (cached[look]) {
      setStyle(cached[look]!);
      return;
    }
    let dead = false;
    fetch(STYLE_URLS[look])
      .then((r) => r.json())
      .then((s: StyleSpecification) => {
        cached[look] = { ...s, layers: s.layers.filter((l) => l.type !== 'symbol') };
        if (!dead) setStyle(cached[look]!);
      })
      .catch(() => !dead && setStyle(STYLE_URLS[look]));
    return () => {
      dead = true;
    };
  }, [look]);
  return style;
}


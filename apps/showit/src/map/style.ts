import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { useEffect, useState } from 'react';

// The same free OpenStreetMap style as the first Xapp app (OpenFreeMap, no API key). Its
// labels are hidden so they never run through the words written over the map.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
let cachedStyle: StyleSpecification | null = null;

export function useQuietStyle() {
  const [style, setStyle] = useState<StyleSpecification | string | null>(cachedStyle);
  useEffect(() => {
    if (cachedStyle) return;
    fetch(STYLE_URL)
      .then((r) => r.json())
      .then((s: StyleSpecification) => {
        cachedStyle = { ...s, layers: s.layers.filter((l) => l.type !== 'symbol') };
        setStyle(cachedStyle);
      })
      .catch(() => setStyle(STYLE_URL));
  }, []);
  return style;
}


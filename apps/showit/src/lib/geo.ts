/**
 * Small geo helpers: distances, movement along a route, nearest place.
 * Self-contained (no imports) so it can be unit-tested with plain Node.
 */

export type LatLng = { lat: number; lng: number };

const EARTH_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Straight-line distance in km. */
export function haversineKm(a: LatLng, b: LatLng) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Roads are longer than the straight line; this factor is typical for Moroccan road trips. */
export const ROAD_FACTOR = 1.3;
/** Shortest trip we quote, in km (loading area to nearby street). */
export const MIN_TRIP_KM = 3;

/** Estimated road distance in km, rounded, never below the minimum trip. */
export function roadKm(a: LatLng, b: LatLng) {
  return Math.max(MIN_TRIP_KM, Math.round(haversineKm(a, b) * ROAD_FACTOR));
}

/** The point a fraction `t` (0–1) of the way from `a` to `b`. */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  const k = Math.min(1, Math.max(0, t));
  return { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k };
}

/** Moves from `from` toward `to` by `stepKm`; returns the target if it is closer than that. */
export function stepToward(from: LatLng, to: LatLng, stepKm: number): LatLng {
  const total = haversineKm(from, to);
  if (total <= stepKm || total === 0) return { ...to };
  return interpolate(from, to, stepKm / total);
}

/** Item closest to a point. */
export function nearest<T extends LatLng>(point: LatLng, items: readonly T[]): T | undefined {
  let best: T | undefined;
  let bestKm = Infinity;
  for (const item of items) {
    const km = haversineKm(point, item);
    if (km < bestKm) {
      best = item;
      bestKm = km;
    }
  }
  return best;
}

/** Bounding box of points, padded by a fraction of its size (at least `minSpanDeg` wide). */
export function bounds(points: readonly LatLng[], pad = 0.2, minSpanDeg = 0.05) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, minSpanDeg);
  const lngSpan = Math.max(maxLng - minLng, minSpanDeg);
  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  minLat = cLat - (latSpan / 2) * (1 + pad);
  maxLat = cLat + (latSpan / 2) * (1 + pad);
  minLng = cLng - (lngSpan / 2) * (1 + pad);
  maxLng = cLng + (lngSpan / 2) * (1 + pad);
  return { minLat, maxLat, minLng, maxLng };
}

/** Accent- and case-insensitive text for searching ("Fès" → "fes", "Salé" → "sale"). */
export function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ْ]/g, '') // Arabic short vowels
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

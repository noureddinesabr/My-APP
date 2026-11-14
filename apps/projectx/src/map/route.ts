/**
 * Road route between two points: OSRM (OpenStreetMap routing) when reachable, otherwise a smooth
 * approximate curve that is labelled as approximate in the UI.
 */
export type LatLng = [number, number];
export type Route = { points: LatLng[]; approx: boolean; km: number | null; minutes: number | null };

const cache = new Map<string, Promise<Route>>();

export function curve(a: LatLng, b: LatLng, n = 48): LatLng[] {
  const mid: LatLng = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dx = b[1] - a[1];
  const dy = b[0] - a[0];
  const ctrl: LatLng = [mid[0] - dx * 0.18, mid[1] + dy * 0.18];
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * ctrl[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * ctrl[1] + t * t * b[1]];
  });
}

export function getRoute(a: LatLng, b: LatLng): Promise<Route> {
  const key = `${a.join(',')}|${b.join(',')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async (): Promise<Route> => {
    // 1) through the X server (no browser CORS limits), 2) OSRM directly, 3) approximate curve
    const urls = [`/api/route?from=${a.join(',')}&to=${b.join(',')}`, `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`];
    for (const url of urls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(url, {signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok && r.headers.get('content-type')?.includes('json')) {
        const j = (await r.json()) as { routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[] };
        const route = j.routes?.[0];
        if (route && route.geometry.coordinates.length > 1) {
          return { points: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]), approx: false, km: Math.round(route.distance / 1000), minutes: Math.round(route.duration / 60) };
        }
      }
    } catch {
      // offline / blocked — try the next source
    }
    }
    return { points: curve(a, b), approx: true, km: null, minutes: null };
  })();
  cache.set(key, p);
  return p;
}

/** The point at fraction `f` (0–1) of a polyline's length. */
export function along(points: LatLng[], f: number): LatLng {
  if (points.length < 2) return points[0];
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    seg.push(d);
    total += d;
  }
  let target = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i]) {
      const t = seg[i] ? target / seg[i] : 0;
      return [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t];
    }
    target -= seg[i];
  }
  return points[points.length - 1];
}

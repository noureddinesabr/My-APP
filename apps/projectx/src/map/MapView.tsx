import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PLACES } from '../models/places';
import { getRoute, type LatLng, type Route } from './route';

export type MapMarker = { id: string; at: LatLng; kind: 'pickup' | 'dropoff' | 'vehicle' | 'sample'; label?: string };

// Tiles: set VITE_MAP_TILES (e.g. a MapTiler/Stadia dark style URL with your key) for production.
// Default: OpenStreetMap's standard tiles, darkened with a CSS filter (fine for a prototype, not for heavy traffic).
const TILE = (import.meta.env.VITE_MAP_TILES as string | undefined) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARKEN = !import.meta.env.VITE_MAP_TILES;
const ATTR = (import.meta.env.VITE_MAP_ATTRIBUTION as string | undefined) || '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const pinHtml = (kind: MapMarker['kind'], label?: string) => {
  if (kind === 'sample') return `<div class="x-pin" style="width:14px;height:14px"><div style="width:10px;height:10px;border-radius:50%;background:#7f79a0;box-shadow:0 0 0 3px rgba(127,121,160,.25)"></div></div>`;
  if (kind === 'vehicle')
    return `<div class="x-pin" style="position:relative;width:44px;height:44px"><div style="position:absolute;inset:0;border-radius:50%;background:rgba(34,211,238,.18);box-shadow:0 0 24px rgba(34,211,238,.55)"></div><div style="position:relative;width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#22d3ee,#6366f1);display:grid;place-items:center;border:2px solid rgba(255,255,255,.8)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></div>${label ? `<div style="position:absolute;top:46px;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 10.5px/1.2 system-ui;color:#a5f3fc;background:rgba(10,8,20,.8);padding:3px 7px;border-radius:8px;border:1px solid rgba(34,211,238,.3)">${label}</div>` : ''}</div>`;
  const color = kind === 'pickup' ? '#a78bfa' : '#22d3ee';
  return `<div class="x-pin" style="position:relative;width:28px;height:28px">${kind === 'pickup' ? '<div class="x-pulse"></div><div class="x-pulse b"></div>' : ''}<div style="width:18px;height:18px;border-radius:${kind === 'pickup' ? '50%' : '5px'};transform:${kind === 'pickup' ? 'none' : 'rotate(45deg)'};background:${color};border:3px solid #0a0814;box-shadow:0 0 0 2px ${color},0 0 18px ${color}"></div>${label ? `<div style="position:absolute;bottom:30px;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 11.5px/1.2 system-ui;color:white;background:rgba(10,8,20,.82);padding:4px 8px;border-radius:9px;border:1px solid ${color}55">${label}</div>` : ''}</div>`;
};

/**
 * Interactive map (Leaflet). Dark CARTO tiles over OpenStreetMap data; if tiles can't load, an
 * offline fallback keeps the route, pins and city names visible and says it is offline.
 */
export function MapView({ from, to, markers = [], padding = [40, 40, 40, 40], onRoute, offlineLabel, approxLabel }: {
  from: LatLng | null;
  to: LatLng | null;
  markers?: MapMarker[];
  /** top, right, bottom, left — space covered by panels, so the route stays visible. */
  padding?: [number, number, number, number];
  onRoute?: (r: Route) => void;
  offlineLabel: string;
  approxLabel: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const [offline, setOffline] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: false, attributionControl: true, preferCanvas: false }).setView([32.5, -7], 6);
    L.control.zoom({ position: 'topright' }).addTo(m);
    let loaded = 0;
    let errors = 0;
    const tiles = L.tileLayer(TILE, { attribution: ATTR, maxZoom: 19, className: DARKEN ? 'x-dark-tiles' : '' });
    tiles.on('tileload', () => (loaded += 1));
    tiles.on('tileerror', () => {
      errors += 1;
      if (errors >= 4 && loaded === 0) setOffline(true);
    });
    tiles.addTo(m);
    const t = setTimeout(() => loaded === 0 && setOffline(true), 6000);
    routeLayer.current = L.layerGroup().addTo(m);
    markerLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current!);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // offline fallback: graticule + city names for geographic context
  useEffect(() => {
    const m = map.current;
    if (!m || !offline) return;
    const g = L.layerGroup().addTo(m);
    for (let lat = 20; lat <= 37; lat += 1) L.polyline([[lat, -18], [lat, 0]], { color: '#2a2446', weight: 1, interactive: false }).addTo(g);
    for (let lng = -18; lng <= 0; lng += 1) L.polyline([[20, lng], [37, lng]], { color: '#2a2446', weight: 1, interactive: false }).addTo(g);
    for (const p of PLACES.filter((x) => !x.area))
      L.marker([p.lat, p.lng], { interactive: false, icon: L.divIcon({ className: '', html: `<div style="font:600 10px system-ui;color:#7f79a0;white-space:nowrap;transform:translate(-50%,-50%)">● ${p.city}</div>` }) }).addTo(g);
    return () => {
      g.remove();
    };
  }, [offline]);

  // route
  const key = from && to ? `${from.join(',')}|${to.join(',')}` : '';
  useEffect(() => {
    let alive = true;
    routeLayer.current?.clearLayers();
    setRoute(null);
    if (!from || !to) return;
    getRoute(from, to).then((r) => {
      if (!alive || !routeLayer.current) return;
      setRoute(r);
      onRouteRef.current?.(r);
      const lg = routeLayer.current;
      L.polyline(r.points, { color: '#8b5cf6', weight: 12, opacity: 0.18, lineCap: 'round', interactive: false }).addTo(lg);
      L.polyline(r.points, { color: '#a78bfa', weight: 4.5, opacity: 0.95, lineCap: 'round', dashArray: r.approx ? '2 9' : undefined, interactive: false }).addTo(lg);
      L.polyline(r.points, { color: '#e0f7ff', weight: 2.5, opacity: 0.9, className: 'route-flow', interactive: false }).addTo(lg);
    });
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // markers
  useEffect(() => {
    const lg = markerLayer.current;
    if (!lg) return;
    lg.clearLayers();
    for (const mk of markers) L.marker(mk.at, { icon: L.divIcon({ className: '', html: pinHtml(mk.kind, mk.label), iconSize: mk.kind === 'vehicle' ? [44, 44] : [28, 28], iconAnchor: mk.kind === 'vehicle' ? [22, 22] : [14, 14] }), zIndexOffset: mk.kind === 'vehicle' ? 1000 : mk.kind === 'sample' ? -100 : 500, keyboard: false }).addTo(lg);
  }, [JSON.stringify(markers)]); // eslint-disable-line react-hooks/exhaustive-deps

  // framing
  const padKey = padding.join(',');
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const pts: LatLng[] = [...(route?.points ?? []), ...(from ? [from] : []), ...(to ? [to] : [])];
    if (!pts.length) return;
    const [t, r, b, l] = padding;
    if (pts.length === 1) m.setView(pts[0], 13, { animate: true });
    else m.flyToBounds(L.latLngBounds(pts), { paddingTopLeft: [l, t], paddingBottomRight: [r, b], maxZoom: 14, duration: 1.2 });
  }, [route, padKey, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0">
      <div ref={el} className="absolute inset-0" data-testid="map" />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 70% at 50% 40%, transparent 55%, rgba(5,4,10,.55) 100%)' }} />
      {(offline || route?.approx) && (
        <div className="pointer-events-none absolute start-3 top-[calc(env(safe-area-inset-top)+64px)] z-[500] flex flex-col gap-1">
          {offline && <span className="tag glass text-amber-200">{offlineLabel}</span>}
          {route?.approx && <span className="tag glass text-mist-300">{approxLabel}</span>}
        </div>
      )}
    </div>
  );
}

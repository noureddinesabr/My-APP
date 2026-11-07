import type { LatLng } from './geo';

/** A street address or point of interest found online. */
export type OnlinePlace = LatLng & { id: string; title: string; subtitle: string; city: string };

/**
 * Names in Morocco often carry two scripts ("Casablanca الدار البيضاء"); keep the one that matches
 * the app's language when both are there.
 */
export function oneScript(text: string, language: 'ar' | 'fr' | 'en') {
  const arabic = /[\u0600-\u06FF]/;
  const latin = /[A-Za-zÀ-ÿ]/;
  if (!arabic.test(text) || !latin.test(text)) return text;
  const words = text.split(/\s+/);
  const keep = words.filter((w) => (language === 'ar' ? !latin.test(w) : !arabic.test(w)));
  const out = keep.join(' ').replace(/^[\s,،-]+|[\s,،-]+$/g, '').replace(/\s+([,،])/g, '$1');
  return out || text;
}

/** Morocco (with the southern provinces), west, south, east, north. */
const BBOX = '-17.2,20.7,-0.9,36.0';
const cache = new Map<string, OnlinePlace[]>();

/**
 * Street-level search from OpenStreetMap (Photon), for addresses the offline list doesn't have.
 * Returns [] when offline or when the page blocks outside requests (the claude.ai preview);
 * the offline suggestions still work there. To be replaced by a paid geocoder (Google Places)
 * when the production backend exists.
 */
export async function searchOnline(text: string, language: 'ar' | 'fr' | 'en', near?: LatLng): Promise<OnlinePlace[]> {
  const query = text.trim();
  if (query.length < 3) return [];
  const key = `${language}|${query.toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ''}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({ q: query, limit: '8', bbox: BBOX, lang: language === 'ar' ? 'default' : language });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lng));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`https://photon.komoot.io/api/?${params}`, { signal: controller.signal });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      features: {
        geometry: { coordinates: [number, number] };
        properties: Record<string, string | undefined>;
      }[];
    };
    const places = data.features
      .filter((feature) => feature.properties.countrycode === 'MA')
      .map((feature) => {
        // Names here may carry several scripts at once ("سيدي بليوط ⵙⵉⴷⵉ"); keep the readable part.
        const clean = (v?: string) => oneScript((v ?? '').replace(/[\u2D30-\u2D7F]+/g, '').replace(/\s{2,}/g, ' ').trim(), language);
        const p = feature.properties;
        const street = clean([p.housenumber, p.street].filter(Boolean).join(' '));
        const title = clean(p.name) || street || clean(p.district);
        const city = clean(p.city ?? p.county);
        const subtitle = [clean(p.name) ? street : '', clean(p.district ?? p.locality), city].filter(Boolean).join(', ');
        const [lng, lat] = feature.geometry.coordinates;
        return { id: `osm-${p.osm_type}${p.osm_id}`, title, subtitle, city, lat, lng };
      })
      .filter((place) => place.title);
    cache.set(key, places);
    return places;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** The address at a point (OpenStreetMap / Photon), for a spot picked on the map or from the phone's location. */
export async function reverseOnline(point: LatLng, language: 'ar' | 'fr' | 'en'): Promise<OnlinePlace | null> {
  const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng), lang: language === 'ar' ? 'default' : language, limit: '1' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`https://photon.komoot.io/reverse?${params}`, { signal: controller.signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[] };
    const f = data.features[0];
    if (!f) return null;
    const clean = (v?: string) => oneScript((v ?? '').replace(/[\u2D30-\u2D7F]+/g, '').replace(/\s{2,}/g, ' ').trim(), language);
    const p = f.properties;
    const street = clean([p.street, p.housenumber].filter(Boolean).join(' '));
    // A bare number (a postcode or house number) is never a place's name.
    const named = (v: string) => (v && !/^[\d\s-]+$/.test(v) ? v : '');
    const title = named(clean(p.name)) || named(street) || named(clean(p.district ?? p.locality)) || named(clean(p.city ?? p.county));
    if (!title) return null;
    const city = clean(p.city ?? p.county);
    return { id: `pin-${point.lat.toFixed(5)},${point.lng.toFixed(5)}`, title, subtitle: [clean(p.district ?? p.locality), city].filter(Boolean).join(', '), city, lat: point.lat, lng: point.lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

import type { LatLng } from '@/lib/geo';

/** A street address or point of interest found online. */
export type OnlinePlace = LatLng & { id: string; title: string; subtitle: string };

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
        const p = feature.properties;
        const street = [p.housenumber, p.street].filter(Boolean).join(' ');
        const title = p.name ?? street ?? p.district ?? '';
        const subtitle = [p.name ? street : '', p.district ?? p.locality, p.city ?? p.county].filter(Boolean).join(', ');
        const [lng, lat] = feature.geometry.coordinates;
        return { id: `osm-${p.osm_type}${p.osm_id}`, title, subtitle, lat, lng };
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

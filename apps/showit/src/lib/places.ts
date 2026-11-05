import { CITIES, getCity, type CityId } from './cities';
export type Language = 'ar' | 'fr' | 'en';
import { nearest, type LatLng } from './geo';
import { PLACE_ROWS } from './places-data';
import { searchPlaces, type Searchable } from './place-search';

export type Place = Searchable & LatLng & { cityId: CityId };

/**
 * Every place the search knows offline: the main cities, 440+ towns (GeoNames) and
 * hand-picked neighbourhoods, streets, markets, ports, stations and industrial zones
 * (generated into places-data.ts by scripts/build-places.py).
 */
/** Extra spellings people type. */
const CITY_ALIASES: Partial<Record<CityId, string[]>> = {
  casablanca: ['casa', 'dar el beida', 'darbida', 'كازا'],
  marrakech: ['marrakesh', 'mrakch', 'مراكش'],
  fes: ['fez', 'fas'],
  tanger: ['tangier', 'tanja', 'طنجة'],
  meknes: ['mknas'],
  kenitra: ['qnitra'],
  eljadida: ['jadida', 'mazagan'],
  laayoune: ['layoune', 'el aaiun'],
};

export const PLACES: Place[] = [
  ...CITIES.map((city) => ({
    id: city.id,
    cityId: city.id,
    kind: 'city' as const,
    name: city.name,
    aliases: CITY_ALIASES[city.id],
    lat: city.lat,
    lng: city.lng,
    population: undefined,
  })),
  ...PLACE_ROWS.map(([id, cityId, kind, ar, fr, en, lat, lng, population]) => ({
    id,
    cityId,
    kind,
    name: { ar, fr, en },
    lat,
    lng,
    population: population || undefined,
  })),
];

/** Adds a place found online (an address), so the trip and the map can use it like any other. */
export function rememberPlace(place: { id: string; title: string; lat: number; lng: number }): Place {
  const known = PLACES.find((p) => p.id === place.id);
  if (known) return known;
  const city = nearest(place, CITIES) ?? CITIES[0];
  const added: Place = { id: place.id, cityId: city.id, kind: 'street', name: { ar: place.title, fr: place.title, en: place.title }, lat: place.lat, lng: place.lng };
  PLACES.push(added);
  return added;
}

export function getPlace(id: string | undefined) {
  return PLACES.find((place) => place.id === id);
}

/** Type-ahead matches; `near` (the user or the other end of the trip) ranks nearby places first. */
export function findPlaces(text: string, limit?: number, near?: LatLng) {
  return searchPlaces(PLACES, text, limit, near);
}

export function nearestPlace(point: LatLng) {
  return nearest(point, PLACES) ?? PLACES[0];
}

export function nearestCityId(point: LatLng): CityId {
  return (nearest(point, CITIES) ?? CITIES[0]).id;
}

/** "Maarif, Casablanca" for a district, "Casablanca" for a city or town. */
export function placeLabel(place: Place, language: Language) {
  if (place.kind === 'city' || place.kind === 'town') return place.name[language];
  return `${place.name[language]}${language === 'ar' ? '، ' : ', '}${getCity(place.cityId).name[language]}`;
}

/** A location picked by search, on the map or from GPS. */
export type Location = LatLng & {
  /** Set when the location is a named place. */
  placeId?: string;
  /** Nearest city, used for "move inside Casablanca" and matching drivers. */
  cityId: CityId;
  /** How it was chosen. */
  source: 'place' | 'map' | 'gps';
  /** Street address found by the online search (e.g. "12 Rue Ibnou Mounir, Maârif"). */
  label?: string;
};

export function locationFromPlace(place: Place): Location {
  return { lat: place.lat, lng: place.lng, placeId: place.id, cityId: place.cityId, source: 'place' };
}

export function locationFromPoint(point: LatLng, source: 'map' | 'gps'): Location {
  return { lat: point.lat, lng: point.lng, cityId: nearestCityId(point), source };
}

export function locationFromCity(cityId: CityId): Location {
  const city = getCity(cityId);
  return { lat: city.lat, lng: city.lng, placeId: city.id, cityId: city.id, source: 'place' };
}

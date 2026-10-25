import { CITIES, getCity, type CityId } from '@/constants/cities';
import type { Language } from '@/i18n/languages';
import { nearest, type LatLng } from '@/lib/geo';
import { searchPlaces, type Searchable } from '@/lib/place-search';

export type Place = Searchable & LatLng & { cityId: CityId };

type Row = [id: string, cityId: CityId, kind: Place['kind'], ar: string, fr: string, en: string, lat: number, lng: number];

/** Neighbourhoods, industrial zones and ports where loads are often picked up. Approximate centres. */
const ROWS: Row[] = [
  ['casa-maarif', 'casablanca', 'district', 'المعاريف', 'Maârif', 'Maarif', 33.585, -7.632],
  ['casa-anfa', 'casablanca', 'district', 'أنفا', 'Anfa', 'Anfa', 33.586, -7.655],
  ['casa-aindiab', 'casablanca', 'district', 'عين الذئاب', 'Aïn Diab', 'Ain Diab', 33.593, -7.683],
  ['casa-gauthier', 'casablanca', 'district', 'غوتييه', 'Gauthier', 'Gauthier', 33.59, -7.626],
  ['casa-centre', 'casablanca', 'district', 'وسط المدينة', 'Centre-ville', 'Downtown', 33.595, -7.618],
  ['casa-medina', 'casablanca', 'district', 'المدينة القديمة', 'Ancienne Médina', 'Old Medina', 33.601, -7.619],
  ['casa-habous', 'casablanca', 'district', 'الأحباس', 'Habous', 'Habous', 33.578, -7.6],
  ['casa-derbsultan', 'casablanca', 'district', 'درب السلطان', 'Derb Sultan', 'Derb Sultan', 33.577, -7.595],
  ['casa-belvedere', 'casablanca', 'district', 'بلفدير', 'Belvédère', 'Belvedere', 33.597, -7.585],
  ['casa-haymohammadi', 'casablanca', 'district', 'الحي المحمدي', 'Hay Mohammadi', 'Hay Mohammadi', 33.59, -7.56],
  ['casa-ainsebaa', 'casablanca', 'district', 'عين السبع', 'Aïn Sebaâ', 'Ain Sebaa', 33.605, -7.53],
  ['casa-bernoussi', 'casablanca', 'district', 'سيدي البرنوصي', 'Sidi Bernoussi', 'Sidi Bernoussi', 33.608, -7.495],
  ['casa-sidimoumen', 'casablanca', 'district', 'سيدي مومن', 'Sidi Moumen', 'Sidi Moumen', 33.58, -7.51],
  ['casa-bourgogne', 'casablanca', 'district', 'بوركون', 'Bourgogne', 'Bourgogne', 33.598, -7.64],
  ['casa-racine', 'casablanca', 'district', 'راسين', 'Racine', 'Racine', 33.59, -7.638],
  ['casa-oasis', 'casablanca', 'district', 'الواحة', 'Oasis', 'Oasis', 33.556, -7.635],
  ['casa-californie', 'casablanca', 'district', 'كاليفورنيا', 'Californie', 'Californie', 33.542, -7.628],
  ['casa-hayhassani', 'casablanca', 'district', 'الحي الحسني', 'Hay Hassani', 'Hay Hassani', 33.56, -7.68],
  ['casa-ainchock', 'casablanca', 'district', 'عين الشق', 'Aïn Chock', 'Ain Chock', 33.545, -7.6],
  ['casa-sidimaarouf', 'casablanca', 'district', 'سيدي معروف', 'Sidi Maârouf', 'Sidi Maarouf', 33.53, -7.645],
  ['casa-bouskoura', 'casablanca', 'district', 'بوسكورة', 'Bouskoura', 'Bouskoura', 33.45, -7.65],
  ['casa-zi-ainsebaa', 'casablanca', 'industrial', 'المنطقة الصناعية عين السبع', 'Zone industrielle Aïn Sebaâ', 'Ain Sebaa industrial zone', 33.6, -7.52],
  ['casa-zi-lissasfa', 'casablanca', 'industrial', 'المنطقة الصناعية ليساسفة', 'Zone industrielle Lissasfa', 'Lissasfa industrial zone', 33.53, -7.675],
  ['casa-zi-bernoussi', 'casablanca', 'industrial', 'المنطقة الصناعية سيدي البرنوصي', 'Zone industrielle Sidi Bernoussi', 'Sidi Bernoussi industrial zone', 33.613, -7.48],
  ['casa-port', 'casablanca', 'port', 'ميناء الدار البيضاء', 'Port de Casablanca', 'Port of Casablanca', 33.605, -7.605],
  ['casa-hadsoualem', 'berrechid', 'industrial', 'حد السوالم', 'Had Soualem', 'Had Soualem', 33.42, -7.85],
  ['mohammedia-port', 'mohammedia', 'port', 'ميناء المحمدية', 'Port de Mohammedia', 'Port of Mohammedia', 33.718, -7.39],
  ['berrechid-zi', 'berrechid', 'industrial', 'المنطقة الصناعية برشيد', 'Zone industrielle Berrechid', 'Berrechid industrial zone', 33.28, -7.6],
  ['rabat-agdal', 'rabat', 'district', 'أكدال', 'Agdal', 'Agdal', 33.997, -6.851],
  ['rabat-hassan', 'rabat', 'district', 'حسان', 'Hassan', 'Hassan', 34.02, -6.83],
  ['rabat-hayriad', 'rabat', 'district', 'حي الرياض', 'Hay Riad', 'Hay Riad', 33.96, -6.87],
  ['rabat-souissi', 'rabat', 'district', 'السويسي', 'Souissi', 'Souissi', 33.985, -6.825],
  ['rabat-ocean', 'rabat', 'district', 'المحيط', 'Océan', 'Ocean', 34.015, -6.85],
  ['rabat-yacoub', 'rabat', 'district', 'يعقوب المنصور', 'Yacoub El Mansour', 'Yacoub El Mansour', 34.005, -6.88],
  ['marrakech-gueliz', 'marrakech', 'district', 'جليز', 'Guéliz', 'Gueliz', 31.637, -8.01],
  ['marrakech-medina', 'marrakech', 'district', 'المدينة القديمة', 'Médina', 'Medina', 31.629, -7.989],
  ['marrakech-hivernage', 'marrakech', 'district', 'الحي الشتوي', 'Hivernage', 'Hivernage', 31.623, -8.015],
  ['marrakech-daoudiate', 'marrakech', 'district', 'الداوديات', 'Daoudiate', 'Daoudiate', 31.655, -7.995],
  ['marrakech-sidighanem', 'marrakech', 'industrial', 'سيدي غانم', 'Sidi Ghanem', 'Sidi Ghanem', 31.67, -8.03],
  ['tanger-centre', 'tanger', 'district', 'وسط المدينة', 'Centre-ville', 'City centre', 35.77, -5.81],
  ['tanger-malabata', 'tanger', 'district', 'ملاباطا', 'Malabata', 'Malabata', 35.775, -5.78],
  ['tanger-zonefranche', 'tanger', 'industrial', 'المنطقة الحرة', 'Zone franche', 'Free zone', 35.73, -5.9],
  ['tanger-med', 'tanger', 'port', 'ميناء طنجة المتوسط', 'Port Tanger Med', 'Tanger Med port', 35.88, -5.5],
  ['fes-medina', 'fes', 'district', 'المدينة القديمة', 'Médina', 'Medina', 34.064, -4.973],
  ['fes-villenouvelle', 'fes', 'district', 'المدينة الجديدة', 'Ville nouvelle', 'New town', 34.033, -5.0],
  ['fes-sidibrahim', 'fes', 'industrial', 'سيدي إبراهيم', 'Sidi Brahim', 'Sidi Brahim', 34.05, -4.96],
  ['agadir-centre', 'agadir', 'district', 'وسط المدينة', 'Centre-ville', 'City centre', 30.42, -9.595],
  ['agadir-port', 'agadir', 'port', 'ميناء أكادير', "Port d'Agadir", 'Port of Agadir', 30.425, -9.635],
  ['agadir-aitmelloul', 'agadir', 'industrial', 'أيت ملول', 'Aït Melloul', 'Ait Melloul', 30.335, -9.5],
];

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
  })),
  ...ROWS.map(([id, cityId, kind, ar, fr, en, lat, lng]) => ({ id, cityId, kind, name: { ar, fr, en }, lat, lng })),
];

export function getPlace(id: string | undefined) {
  return PLACES.find((place) => place.id === id);
}

export function findPlaces(text: string, limit?: number) {
  return searchPlaces(PLACES, text, limit);
}

export function nearestPlace(point: LatLng) {
  return nearest(point, PLACES) ?? PLACES[0];
}

export function nearestCityId(point: LatLng): CityId {
  return (nearest(point, CITIES) ?? CITIES[0]).id;
}

/** "Maarif, Casablanca" for a district, "Casablanca" for a city. */
export function placeLabel(place: Place, language: Language) {
  if (place.kind === 'city') return place.name[language];
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

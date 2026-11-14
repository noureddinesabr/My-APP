import type { Lang, Place } from './booking';

/** Moroccan cities and well-known neighbourhoods, with the names people actually say and write. */
export type Gaz = { id: string; city: string; area?: string; lat: number; lng: number; ar: string; fr?: string; words: string[] };

export const PLACES: Gaz[] = [
  { id: 'casablanca', city: 'Casablanca', lat: 33.5731, lng: -7.5898, ar: 'الدار البيضاء', words: ['casablanca', 'casa', 'kaza', 'dar el beida', 'dar lbida', 'الدار البيضاء', 'الدارالبيضاء', 'البيضاء', 'كازا', 'كازابلانكا'] },
  { id: 'ainsebaa', city: 'Casablanca', area: 'Aïn Sebaâ', lat: 33.607, lng: -7.533, ar: 'عين السبع', words: ['ain sebaa', 'ain sbaa', 'ain seba', 'عين السبع', 'عين سبع'] },
  { id: 'maarif', city: 'Casablanca', area: 'Maârif', lat: 33.583, lng: -7.633, ar: 'المعاريف', words: ['maarif', 'maariff', 'المعاريف', 'معاريف'] },
  { id: 'sidimaarouf', city: 'Casablanca', area: 'Sidi Maârouf', lat: 33.533, lng: -7.64, ar: 'سيدي معروف', words: ['sidi maarouf', 'sidi maaruf', 'سيدي معروف'] },
  { id: 'hayhassani', city: 'Casablanca', area: 'Hay Hassani', lat: 33.562, lng: -7.672, ar: 'الحي الحسني', words: ['hay hassani', 'الحي الحسني', 'حي الحسني'] },
  { id: 'derbomar', city: 'Casablanca', area: 'Derb Omar', lat: 33.596, lng: -7.613, ar: 'درب عمر', words: ['derb omar', 'درب عمر'] },
  { id: 'ainchock', city: 'Casablanca', area: 'Aïn Chock', lat: 33.548, lng: -7.6, ar: 'عين الشق', words: ['ain chock', 'ain chok', 'عين الشق'] },
  { id: 'bernoussi', city: 'Casablanca', area: 'Sidi Bernoussi', lat: 33.61, lng: -7.5, ar: 'سيدي البرنوصي', words: ['bernoussi', 'sidi bernoussi', 'البرنوصي', 'سيدي البرنوصي'] },
  { id: 'anfa', city: 'Casablanca', area: 'Anfa', lat: 33.59, lng: -7.66, ar: 'أنفا', words: ['anfa', 'انفا'] },
  { id: 'bouskoura', city: 'Bouskoura', lat: 33.449, lng: -7.649, ar: 'بوسكورة', words: ['bouskoura', 'بوسكوره'] },
  { id: 'mohammedia', city: 'Mohammedia', lat: 33.6866, lng: -7.383, ar: 'المحمدية', words: ['mohammedia', 'mohamedia', 'mohammadia', 'mohamadia', 'fedala', 'المحمديه', 'محمديه', 'فضاله'] },
  { id: 'rabat', city: 'Rabat', lat: 34.0209, lng: -6.8416, ar: 'الرباط', words: ['rabat', 'rbat', 'الرباط', 'رباط'] },
  { id: 'agdal', city: 'Rabat', area: 'Agdal', lat: 33.999, lng: -6.851, ar: 'أكدال', words: ['agdal', 'اكدال'] },
  { id: 'hayriad', city: 'Rabat', area: 'Hay Riad', lat: 33.96, lng: -6.87, ar: 'حي الرياض', words: ['hay riad', 'حي الرياض'] },
  { id: 'sale', city: 'Salé', lat: 34.0331, lng: -6.7985, ar: 'سلا', words: ['sale', 'sala', 'سلا'] },
  { id: 'temara', city: 'Témara', lat: 33.9287, lng: -6.9063, ar: 'تمارة', words: ['temara', 'تماره'] },
  { id: 'kenitra', city: 'Kénitra', lat: 34.261, lng: -6.5802, ar: 'القنيطرة', words: ['kenitra', 'القنيطره', 'قنيطره'] },
  { id: 'settat', city: 'Settat', lat: 33.001, lng: -7.6166, ar: 'سطات', words: ['settat', 'sttat', 'سطات'] },
  { id: 'berrechid', city: 'Berrechid', lat: 33.2655, lng: -7.5875, ar: 'برشيد', words: ['berrechid', 'berrchid', 'برشيد'] },
  { id: 'eljadida', city: 'El Jadida', lat: 33.2316, lng: -8.5007, ar: 'الجديدة', words: ['el jadida', 'eljadida', 'jadida', 'الجديده', 'جديده'] },
  { id: 'marrakech', city: 'Marrakech', lat: 31.6295, lng: -7.9811, ar: 'مراكش', words: ['marrakech', 'marrakesh', 'marrakch', 'mraksh', 'مراكش'] },
  { id: 'gueliz', city: 'Marrakech', area: 'Guéliz', lat: 31.634, lng: -8.01, ar: 'جليز', words: ['gueliz', 'guiliz', 'جليز', 'كليز'] },
  { id: 'agadir', city: 'Agadir', lat: 30.4278, lng: -9.5981, ar: 'أكادير', words: ['agadir', 'اكادير', 'اݣادير'] },
  { id: 'fes', city: 'Fès', lat: 34.0181, lng: -5.0078, ar: 'فاس', words: ['fes', 'fez', 'fas', 'فاس'] },
  { id: 'meknes', city: 'Meknès', lat: 33.8935, lng: -5.5473, ar: 'مكناس', words: ['meknes', 'mekness', 'مكناس'] },
  { id: 'tangier', city: 'Tangier', fr: 'Tanger', lat: 35.7595, lng: -5.834, ar: 'طنجة', words: ['tangier', 'tanger', 'tanja', 'طنجه'] },
  { id: 'tetouan', city: 'Tétouan', lat: 35.5889, lng: -5.3626, ar: 'تطوان', words: ['tetouan', 'tetuan', 'تطوان'] },
  { id: 'oujda', city: 'Oujda', lat: 34.6814, lng: -1.9086, ar: 'وجدة', words: ['oujda', 'وجده'] },
  { id: 'safi', city: 'Safi', lat: 32.2994, lng: -9.2372, ar: 'آسفي', words: ['safi', 'اسفي', 'سافي'] },
  { id: 'essaouira', city: 'Essaouira', lat: 31.5085, lng: -9.7595, ar: 'الصويرة', words: ['essaouira', 'الصويره', 'صويره'] },
  { id: 'benimellal', city: 'Béni Mellal', lat: 32.3373, lng: -6.3498, ar: 'بني ملال', words: ['beni mellal', 'bni mellal', 'بني ملال'] },
  { id: 'khouribga', city: 'Khouribga', lat: 32.8811, lng: -6.9063, ar: 'خريبكة', words: ['khouribga', 'خريبكه', 'خريبݣه'] },
  { id: 'nador', city: 'Nador', lat: 35.1681, lng: -2.9335, ar: 'الناظور', words: ['nador', 'الناظور', 'ناظور'] },
  { id: 'laayoune', city: 'Laâyoune', lat: 27.1253, lng: -13.1625, ar: 'العيون', words: ['laayoune', 'layoune', 'العيون'] },
  { id: 'dakhla', city: 'Dakhla', lat: 23.6848, lng: -15.958, ar: 'الداخلة', words: ['dakhla', 'الداخله', 'داخله'] },
  { id: 'ouarzazate', city: 'Ouarzazate', lat: 30.9189, lng: -6.8934, ar: 'ورزازات', words: ['ouarzazate', 'ورزازات'] },
  { id: 'errachidia', city: 'Errachidia', lat: 31.9314, lng: -4.4246, ar: 'الراشيدية', words: ['errachidia', 'الراشيديه'] },
  { id: 'taza', city: 'Taza', lat: 34.21, lng: -4.01, ar: 'تازة', words: ['taza', 'تازه'] },
  { id: 'alhoceima', city: 'Al Hoceïma', lat: 35.2517, lng: -3.9372, ar: 'الحسيمة', words: ['al hoceima', 'hoceima', 'الحسيمه'] },
  { id: 'khemisset', city: 'Khémisset', lat: 33.8241, lng: -6.0663, ar: 'الخميسات', words: ['khemisset', 'الخميسات'] },
  { id: 'larache', city: 'Larache', lat: 35.1932, lng: -6.1557, ar: 'العرائش', words: ['larache', 'العرايش', 'العرائش'] },
];
export const placeById = (id: string | null | undefined) => PLACES.find((p) => p.id === id) ?? null;

export const toPlace = (g: Gaz): Place => ({ id: g.id, city: g.city, area: g.area ?? null, address: null, lat: g.lat, lng: g.lng });

/** A short display name in the reply language: "Aïn Sebaâ, Casablanca" / "عين السبع، الدار البيضاء". */
export function placeName(p: { id?: string | null; city: string; area?: string | null }, lang: Lang | 'ar' | 'fr' | 'en', short = false) {
  const g = p.id ? placeById(p.id) : null;
  const arabic = lang === 'darija' || lang === 'ar';
  if (g) {
    const parent = g.area ? PLACES.find((x) => !x.area && x.city === g.city) : null;
    if (arabic) return g.area && !short ? `${g.ar}، ${parent?.ar ?? g.city}` : g.ar;
    const city = lang === 'fr' && g.fr ? g.fr : g.city;
    return g.area ? (short ? g.area : `${g.area}, ${city}`) : city;
  }
  return p.area ? `${p.area}, ${p.city}` : p.city;
}

/** Straight-line distance × 1.25 (roads are never straight). Used only for estimates. */
export function roadKm(a: { lat: number | null; lng: number | null } | null, b: { lat: number | null; lng: number | null } | null) {
  if (!a || !b || a.lat == null || b.lat == null || a.lng == null || b.lng == null) return 0;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(h)) * 1.25;
  return Math.max(3, Math.round(km));
}
/** Rough driving time in minutes (city traffic is slower than motorways). */
export const driveMinutes = (km: number) => Math.round(km < 25 ? km * 2.6 + 8 : km * 0.85 + 15);

/** Main Moroccan cities. Will be replaced by map address search when maps are added. */
export const CITIES = [
  { id: 'casablanca', name: { ar: 'الدار البيضاء', fr: 'Casablanca', en: 'Casablanca' }, lat: 33.5731, lng: -7.5898 },
  { id: 'rabat', name: { ar: 'الرباط', fr: 'Rabat', en: 'Rabat' }, lat: 34.0209, lng: -6.8416 },
  { id: 'sale', name: { ar: 'سلا', fr: 'Salé', en: 'Salé' }, lat: 34.0331, lng: -6.7985 },
  { id: 'mohammedia', name: { ar: 'المحمدية', fr: 'Mohammedia', en: 'Mohammedia' }, lat: 33.6866, lng: -7.3830 },
  { id: 'berrechid', name: { ar: 'برشيد', fr: 'Berrechid', en: 'Berrechid' }, lat: 33.2655, lng: -7.5875 },
  { id: 'settat', name: { ar: 'سطات', fr: 'Settat', en: 'Settat' }, lat: 33.0011, lng: -7.6166 },
  { id: 'eljadida', name: { ar: 'الجديدة', fr: 'El Jadida', en: 'El Jadida' }, lat: 33.2316, lng: -8.5007 },
  { id: 'kenitra', name: { ar: 'القنيطرة', fr: 'Kénitra', en: 'Kenitra' }, lat: 34.2610, lng: -6.5802 },
  { id: 'marrakech', name: { ar: 'مراكش', fr: 'Marrakech', en: 'Marrakesh' }, lat: 31.6295, lng: -7.9811 },
  { id: 'fes', name: { ar: 'فاس', fr: 'Fès', en: 'Fez' }, lat: 34.0181, lng: -5.0078 },
  { id: 'meknes', name: { ar: 'مكناس', fr: 'Meknès', en: 'Meknes' }, lat: 33.8935, lng: -5.5473 },
  { id: 'tanger', name: { ar: 'طنجة', fr: 'Tanger', en: 'Tangier' }, lat: 35.7595, lng: -5.8340 },
  { id: 'tetouan', name: { ar: 'تطوان', fr: 'Tétouan', en: 'Tetouan' }, lat: 35.5889, lng: -5.3626 },
  { id: 'agadir', name: { ar: 'أكادير', fr: 'Agadir', en: 'Agadir' }, lat: 30.4278, lng: -9.5981 },
  { id: 'safi', name: { ar: 'آسفي', fr: 'Safi', en: 'Safi' }, lat: 32.2994, lng: -9.2372 },
  { id: 'benimellal', name: { ar: 'بني ملال', fr: 'Béni Mellal', en: 'Beni Mellal' }, lat: 32.3373, lng: -6.3498 },
  { id: 'khouribga', name: { ar: 'خريبكة', fr: 'Khouribga', en: 'Khouribga' }, lat: 32.8811, lng: -6.9063 },
  { id: 'oujda', name: { ar: 'وجدة', fr: 'Oujda', en: 'Oujda' }, lat: 34.6814, lng: -1.9086 },
  { id: 'nador', name: { ar: 'الناظور', fr: 'Nador', en: 'Nador' }, lat: 35.1681, lng: -2.9335 },
  { id: 'essaouira', name: { ar: 'الصويرة', fr: 'Essaouira', en: 'Essaouira' }, lat: 31.5085, lng: -9.7595 },
  { id: 'laayoune', name: { ar: 'العيون', fr: 'Laâyoune', en: 'Laayoune' }, lat: 27.1253, lng: -13.1625 },
  { id: 'dakhla', name: { ar: 'الداخلة', fr: 'Dakhla', en: 'Dakhla' }, lat: 23.6848, lng: -15.9580 },
] as const;

export type CityId = (typeof CITIES)[number]['id'];

/** Default pickup city: the launch focus. */
export const DEFAULT_CITY: CityId = 'casablanca';

export function getCity(id: CityId) {
  return CITIES.find((city) => city.id === id) ?? CITIES[0];
}

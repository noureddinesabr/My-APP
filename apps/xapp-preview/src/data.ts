import room from './assets/room.jpg';
import movers from './assets/movers.jpg';
import smallVan from './assets/smallVan.webp';
import largeVan from './assets/largeVan.webp';
import pickup from './assets/pickup.webp';
import truck35 from './assets/truck35.webp';
import cityTruck from './assets/cityTruck.webp';
import triporteur from './assets/triporteur.webp';
import refrigerated from './assets/refrigerated.webp';
import truck7 from './assets/truck7.webp';

/** Words shown in the three languages: [English, French, Arabic (Darija-friendly)]. */
export type L3 = [string, string, string];
export type Lang = 'en' | 'fr' | 'ar';
export const pick = (l: L3, lang: Lang) => l[lang === 'en' ? 0 : lang === 'fr' ? 1 : 2];

export const PHOTOS = { room, movers };

// ---------------- Vehicles ----------------
export type VehicleId = 'triporteur' | 'smallVan' | 'pickup' | 'cityTruck' | 'largeVan' | 'truck35' | 'truck7' | 'fridgeTruck';
export type Vehicle = { id: VehicleId; name: L3; maxKg: number; img: string; base: number; perKm: number };
export const VEHICLES: Record<VehicleId, Vehicle> = {
  triporteur: { id: 'triporteur', name: ['Triporteur', 'Triporteur', 'تريبورتور'], maxKg: 500, img: triporteur, base: 60, perKm: 2 },
  smallVan: { id: 'smallVan', name: ['Small van', 'Petite fourgonnette', 'فورݣون صغير'], maxKg: 750, img: smallVan, base: 110, perKm: 3 },
  pickup: { id: 'pickup', name: ['Pickup', 'Pick-up', 'بيكاب'], maxKg: 1200, img: pickup, base: 140, perKm: 3.6 },
  cityTruck: { id: 'cityTruck', name: ['City truck', 'Camionnette', 'كاميونيت'], maxKg: 1300, img: cityTruck, base: 150, perKm: 3.8 },
  largeVan: { id: 'largeVan', name: ['Large van', 'Grand fourgon', 'فورݣون كبير'], maxKg: 1400, img: largeVan, base: 170, perKm: 4 },
  truck35: { id: 'truck35', name: ['3.5 t truck', 'Camion 3,5 t', 'كاميو 3.5 طن'], maxKg: 3500, img: truck35, base: 260, perKm: 5 },
  truck7: { id: 'truck7', name: ['7 t truck', 'Camion 7 t', 'كاميو 7 طن'], maxKg: 7000, img: truck7, base: 420, perKm: 7 },
  fridgeTruck: { id: 'fridgeTruck', name: ['Refrigerated truck', 'Camion frigorifique', 'كاميو مبرد'], maxKg: 5000, img: refrigerated, base: 600, perKm: 8 },
};
export const bestVehicle = (kg: number): VehicleId =>
  kg <= 120 ? 'triporteur' : (['smallVan', 'smallVan', 'pickup', 'largeVan', 'truck35', 'truck7'] as VehicleId[]).find((v) => VEHICLES[v].maxKg >= kg * 1.15) ?? 'truck7';

// ---------------- Places ----------------
/** `city` places sit on the Casablanca map (0–400 box); every place also has a spot on the Morocco map (0–400 box). */
export type Place = { id: string; name: L3; city: L3; cx?: number; cy?: number; mx: number; my: number; lat: number; lng: number };
const CASA: L3 = ['Casablanca', 'Casablanca', 'الدار البيضاء'];
export const PLACES: Place[] = [
  { id: 'maarif', name: ['Maarif', 'Maârif', 'المعاريف'], city: CASA, cx: 170, cy: 228, mx: 168, my: 128, lat: 33.586, lng: -7.632 },
  { id: 'gauthier', name: ['Gauthier', 'Gauthier', 'غوتييه'], city: CASA, cx: 196, cy: 188, mx: 169, my: 127, lat: 33.592, lng: -7.626 },
  { id: 'ainsebaa', name: ['Ain Sebaa', 'Aïn Sebaâ', 'عين السبع'], city: CASA, cx: 318, cy: 112, mx: 172, my: 124, lat: 33.606, lng: -7.534 },
  { id: 'hayhassani', name: ['Hay Hassani', 'Hay Hassani', 'الحي الحسني'], city: CASA, cx: 86, cy: 262, mx: 165, my: 130, lat: 33.567, lng: -7.668 },
  { id: 'sidimaarouf', name: ['Sidi Maarouf', 'Sidi Maârouf', 'سيدي معروف'], city: CASA, cx: 182, cy: 330, mx: 168, my: 132, lat: 33.53, lng: -7.643 },
  { id: 'darbouazza', name: ['Dar Bouazza', 'Dar Bouazza', 'دار بوعزة'], city: ['Casablanca region', 'Région de Casablanca', 'جهة الدار البيضاء'], cx: 22, cy: 318, mx: 160, my: 133, lat: 33.522, lng: -7.814 },
  { id: 'mohammedia', name: ['Mohammedia', 'Mohammedia', 'المحمدية'], city: ['Mohammedia', 'Mohammedia', 'المحمدية'], cx: 392, cy: 40, mx: 180, my: 118, lat: 33.686, lng: -7.383 },
  { id: 'berrechid', name: ['Berrechid', 'Berrechid', 'برشيد'], city: ['Berrechid', 'Berrechid', 'برشيد'], mx: 172, my: 146, lat: 33.265, lng: -7.587 },
  { id: 'rabat', name: ['Rabat · Agdal', 'Rabat · Agdal', 'الرباط · أكدال'], city: ['Rabat', 'Rabat', 'الرباط'], mx: 204, my: 98, lat: 34.0, lng: -6.85 },
  { id: 'temara', name: ['Temara', 'Témara', 'تمارة'], city: ['Temara', 'Témara', 'تمارة'], mx: 199, my: 103, lat: 33.928, lng: -6.906 },
  { id: 'marrakech', name: ['Marrakech · Gueliz', 'Marrakech · Guéliz', 'مراكش · جليز'], city: ['Marrakech', 'Marrakech', 'مراكش'], mx: 142, my: 222, lat: 31.634, lng: -7.999 },
  { id: 'tangier', name: ['Tangier', 'Tanger', 'طنجة'], city: ['Tangier', 'Tanger', 'طنجة'], mx: 246, my: 30, lat: 35.759, lng: -5.834 },
  { id: 'agadir', name: ['Agadir', 'Agadir', 'أكادير'], city: ['Agadir', 'Agadir', 'أكادير'], mx: 86, my: 292, lat: 30.427, lng: -9.598 },
  { id: 'fes', name: ['Fes', 'Fès', 'فاس'], city: ['Fes', 'Fès', 'فاس'], mx: 286, my: 104, lat: 34.033, lng: -5.0 },
  { id: 'eljadida', name: ['El Jadida', 'El Jadida', 'الجديدة'], city: ['El Jadida', 'El Jadida', 'الجديدة'], mx: 140, my: 150, lat: 33.254, lng: -8.508 },
];
export const placeById = (id: string) => PLACES.find((p) => p.id === id)!;

/** Road distance (km) and drive time (min) between two places: straight line × 1.3, town or road speed. */
export function routeOf(a: Place, b: Place) {
  const r = Math.PI / 180;
  const d = 2 * 6371 * Math.asin(Math.sqrt(Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2));
  const km = Math.max(3, Math.round(d * 1.3));
  const min = Math.round(km > 40 ? (km / 75) * 60 + 15 : (km / 24) * 60 + 8);
  return { km, min, city: a.cx !== undefined && b.cx !== undefined };
}

/** A fair price range from the vehicle, distance and extras. A reference only: drivers may offer other prices. */
export function fairPrice(vehicle: VehicleId, km: number, helpers: number, stairs: number) {
  const v = VEHICLES[vehicle];
  const mid = Math.round((v.base + v.perKm * km + helpers * 70 + stairs * 15) / 10) * 10;
  return { low: Math.round((mid * 0.88) / 10) * 10, mid, high: Math.round((mid * 1.15) / 10) * 10 };
}

// ---------------- Cargo ----------------
export type Conf = 'high' | 'medium' | 'low';
export type Item = { id: string; name: L3; qty: number; kg: number; conf: Conf; box?: { x: number; y: number; w: number; h: number }; photo?: number };
/** What the sample room photo shows (boxes are where the objects are in the picture, 0–1). */
export const SAMPLE_ROOM_ITEMS: Item[] = [
  { id: 'sofa', name: ['Sofa (3 seats)', 'Canapé 3 places', 'صالون (3 بلايص)'], qty: 1, kg: 55, conf: 'high', box: { x: 0.13, y: 0.42, w: 0.48, h: 0.42 }, photo: 0 },
  { id: 'boxes', name: ['Cardboard boxes', 'Cartons', 'كراطن'], qty: 7, kg: 12, conf: 'high', box: { x: 0.57, y: 0.22, w: 0.22, h: 0.42 }, photo: 0 },
  { id: 'table', name: ['Side table', 'Table basse', 'طبلة صغيرة'], qty: 1, kg: 8, conf: 'medium', box: { x: 0.51, y: 0.68, w: 0.25, h: 0.3 }, photo: 0 },
  { id: 'shelf', name: ['Shelving unit', 'Étagère', 'رفوف'], qty: 1, kg: 18, conf: 'medium', box: { x: 0.0, y: 0.0, w: 0.28, h: 0.36 }, photo: 0 },
  { id: 'fridge', name: ['Fridge?', 'Frigo ?', 'تلاجة؟'], qty: 1, kg: 65, conf: 'low', box: { x: 0.8, y: 0.3, w: 0.16, h: 0.5 }, photo: 0 },
];
export const SUGGESTIONS: L3[] = [
  ['Washing machine', 'Machine à laver', 'ماشينة الصابون'],
  ['Television', 'Télévision', 'تلفاز'],
  ['Dining table', 'Table à manger', 'طبلة ديال الماكلة'],
  ['Chairs', 'Chaises', 'كراسا'],
  ['Mattress', 'Matelas', 'ماطلة'],
  ['Wardrobe', 'Armoire', 'خزانة'],
  ['Cement bags', 'Sacs de ciment', 'شكاير ديال السيمة'],
  ['Gas cooker', 'Cuisinière', 'كوزينيرة'],
];
export const SUGGEST_KG = [70, 30, 35, 5, 25, 60, 50, 40];

// ---------------- People ----------------
export type Driver = { id: string; name: string; nameAr: string; initials: string; color: string; rating: number; trips: number; years: number; vehicle: VehicleId; plate: string; helpers: boolean; verified: boolean; city: string };
export const DRIVERS: Driver[] = [
  { id: 'youssef', name: 'Youssef A.', nameAr: 'يوسف', initials: 'YA', color: 'linear-gradient(135deg,#0EA5E9,#2563EB)', rating: 4.9, trips: 128, years: 4, vehicle: 'smallVan', plate: '48213-A-6', helpers: true, verified: true, city: 'Casablanca' },
  { id: 'hamza', name: 'Hamza B.', nameAr: 'حمزة', initials: 'HB', color: 'linear-gradient(135deg,#F59E0B,#EA580C)', rating: 4.8, trips: 86, years: 3, vehicle: 'largeVan', plate: '7720-B-1', helpers: true, verified: true, city: 'Casablanca' },
  { id: 'karim', name: 'Karim E.', nameAr: 'كريم', initials: 'KE', color: 'linear-gradient(135deg,#10B981,#047857)', rating: 4.6, trips: 12, years: 1, vehicle: 'pickup', plate: '30914-D-6', helpers: false, verified: true, city: 'Mohammedia' },
];
/** The driver using the driver side of the preview. */
export const ME: Driver = { id: 'me', name: 'Hamid Benali', nameAr: 'حميد بنعلي', initials: 'HB', color: 'linear-gradient(135deg,#334155,#0F172A)', rating: 4.9, trips: 214, years: 6, vehicle: 'largeVan', plate: '55102-A-1', helpers: true, verified: true, city: 'Casablanca' };
/** A driver's name in the reading language (Arabic letters in Arabic). */
export const nm = (d: Pick<Driver, 'name' | 'nameAr'>, lang: Lang) => (lang === 'ar' ? d.nameAr : d.name);
export const firstName = (d: Pick<Driver, 'name' | 'nameAr'>, lang: Lang) => nm(d, lang).split(' ')[0];
export const driverById = (id: string) => (id === 'me' ? ME : DRIVERS.find((d) => d.id === id)!);
export const CUSTOMER = { nameAr: 'سلمى الإدريسي', name: 'Salma Idrissi', initials: 'SI', phone: '06 •• •• 41 27' };

// ---------------- Sample loads other customers posted (what the driver sees) ----------------
export type LoadSeed = { id: string; from: string; to: string; items: Item[]; vehicle: VehicleId; price: number; when: L3; helpers: number; shared: boolean; photo: string; customer: string; ageMin: number; floors?: L3 };
export const OTHER_LOADS: LoadSeed[] = [
  { id: 'L1', from: 'maarif', to: 'berrechid', vehicle: 'largeVan', price: 380, when: ['Today 14:30', "Aujourd'hui 14:30", 'اليوم 14:30'], helpers: 2, shared: false, photo: room, customer: 'Nadia', ageMin: 4, floors: ['3rd floor, no lift', '3e étage, sans ascenseur', 'الطابق 3، بلا مصعد'],
    items: [{ id: 'a', name: ['Sofa', 'Canapé', 'صالون'], qty: 1, kg: 55, conf: 'high' }, { id: 'b', name: ['Fridge', 'Frigo', 'تلاجة'], qty: 1, kg: 65, conf: 'high' }, { id: 'c', name: ['Boxes', 'Cartons', 'كراطن'], qty: 8, kg: 12, conf: 'high' }] },
  { id: 'L2', from: 'gauthier', to: 'ainsebaa', vehicle: 'smallVan', price: 140, when: ['Now', 'Maintenant', 'دابا'], helpers: 1, shared: false, photo: movers, customer: 'Omar', ageMin: 9, floors: ['2nd floor, lift', '2e étage, ascenseur', 'الطابق 2، فيه مصعد'],
    items: [{ id: 'a', name: ['Washing machine', 'Machine à laver', 'ماشينة الصابون'], qty: 1, kg: 70, conf: 'high' }] },
  { id: 'L3', from: 'tangier', to: 'maarif', vehicle: 'largeVan', price: 900, when: ['Thursday 08:00', 'Jeudi 08:00', 'الخميس 08:00'], helpers: 0, shared: true, photo: room, customer: 'Atlas Déco', ageMin: 30,
    items: [{ id: 'a', name: ['Shop goods (boxes)', 'Marchandise (cartons)', 'سلعة ديال الحانوت'], qty: 14, kg: 18, conf: 'high' }] },
  { id: 'L4', from: 'ainsebaa', to: 'mohammedia', vehicle: 'pickup', price: 220, when: ['Today 17:00', "Aujourd'hui 17:00", 'اليوم 17:00'], helpers: 0, shared: true, photo: movers, customer: 'BTP Lamrani', ageMin: 15,
    items: [{ id: 'a', name: ['Cement bags', 'Sacs de ciment', 'شكاير ديال السيمة'], qty: 20, kg: 50, conf: 'high' }] },
  { id: 'L5', from: 'marrakech', to: 'maarif', vehicle: 'largeVan', price: 1100, when: ['Sunday 10:00', 'Dimanche 10:00', 'الحد 10:00'], helpers: 1, shared: false, photo: room, customer: 'Fatima Zahra', ageMin: 42,
    items: [{ id: 'a', name: ['Fridge', 'Frigo', 'تلاجة'], qty: 1, kg: 65, conf: 'high' }, { id: 'b', name: ['Bed frame', 'Lit', 'ناموسية'], qty: 2, kg: 40, conf: 'high' }, { id: 'c', name: ['Boxes', 'Cartons', 'كراطن'], qty: 10, kg: 12, conf: 'high' }] },
  { id: 'L6', from: 'hayhassani', to: 'marrakech', vehicle: 'largeVan', price: 850, when: ['Tomorrow 07:30', 'Demain 07:30', 'غدا 07:30'], helpers: 0, shared: true, photo: movers, customer: 'Meubles Atlas', ageMin: 22,
    items: [{ id: 'a', name: ['Dining chairs', 'Chaises', 'كراسا'], qty: 12, kg: 6, conf: 'high' }, { id: 'b', name: ['Dining table', 'Table à manger', 'طبلة ديال الماكلة'], qty: 2, kg: 35, conf: 'high' }] },
  { id: 'L7', from: 'ainsebaa', to: 'temara', vehicle: 'smallVan', price: 300, when: ['Today 18:00', "Aujourd'hui 18:00", 'اليوم 18:00'], helpers: 1, shared: false, photo: movers, customer: 'Youness', ageMin: 6,
    items: [{ id: 'a', name: ['Fridge', 'Frigo', 'تلاجة'], qty: 1, kg: 65, conf: 'high' }, { id: 'b', name: ['Gas cooker', 'Cuisinière', 'كوزينيرة'], qty: 1, kg: 40, conf: 'high' }] },
];

// ---------------- Earnings (driver) ----------------
/** Trips Hamid already did this week (gross cash collected, DH). */
export const WEEK_TRIPS = [
  { day: ['Mon', 'Lun', 'الإثنين'] as L3, route: 'Maarif → Bouskoura', gross: 260 },
  { day: ['Mon', 'Lun', 'الإثنين'] as L3, route: 'Ain Diab → Hay Hassani', gross: 180 },
  { day: ['Tue', 'Mar', 'الثلاثاء'] as L3, route: 'Casablanca → Rabat', gross: 650 },
  { day: ['Wed', 'Mer', 'الأربعاء'] as L3, route: 'Derb Omar → Ain Sebaa', gross: 220 },
  { day: ['Thu', 'Jeu', 'الخميس'] as L3, route: 'Casablanca → El Jadida', gross: 590 },
  { day: ['Fri', 'Ven', 'الجمعة'] as L3, route: 'Gauthier → Sidi Maarouf', gross: 210 },
  { day: ['Fri', 'Ven', 'الجمعة'] as L3, route: 'Maarif → Mohammedia', gross: 290 },
];
export const DAY_BARS = [440, 650, 220, 590, 500, 0, 0];
export const INVOICES = [
  { id: 'INV-2026-45', period: ['3–9 Nov', '3–9 nov.', '3–9 نونبر'] as L3, trips: 11, gross: 3120, paid: true },
  { id: 'INV-2026-44', period: ['27 Oct–2 Nov', '27 oct.–2 nov.', '27 أكتوبر–2 نونبر'] as L3, trips: 9, gross: 2640, paid: true },
  { id: 'INV-2026-43', period: ['20–26 Oct', '20–26 oct.', '20–26 أكتوبر'] as L3, trips: 12, gross: 3380, paid: true },
];

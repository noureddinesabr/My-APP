import room from './assets/room.jpg';
import smallVan from './assets/smallVan.webp';
import largeVan from './assets/largeVan.webp';
import pickup from './assets/pickup.webp';
import truck35 from './assets/truck35.webp';
import truck7 from './assets/truck7.webp';
import triporteur from './assets/triporteur.webp';
import type { L3 } from './places';

export const SAMPLE_PHOTO = room;

export type Conf = 'high' | 'medium' | 'low';
export type Item = { id: string; name: L3; qty: number; kg: number; conf: Conf; box?: { x: number; y: number; w: number; h: number } };

/** Everyday things to move, with the words people use and a typical weight per piece (kg). */
export const THINGS: { name: L3; kg: number; words: string[] }[] = [
  { name: ['Sofa', 'Canapé', 'صالون'], kg: 55, words: ['sofa', 'couch', 'canape', 'salon', 'صالون', 'صالونات', 'كنبة', 'فوتوي', 'salon'] },
  { name: ['Fridge', 'Frigo', 'تلاجة'], kg: 65, words: ['fridge', 'frigo', 'refrigerateur', 'تلاجة', 'تلاجه', 'ثلاجة', 'ثلاجه', 'فريجيدير', 'تلاجات', 'tlaja', 'tellaja'] },
  { name: ['Washing machine', 'Machine à laver', 'ماشينة الصابون'], kg: 70, words: ['washing machine', 'machine a laver', 'machine', 'ماشينة الصابون', 'ماشينه', 'غسالة', 'غساله', 'machina', 'sabon'] },
  { name: ['Boxes', 'Cartons', 'كراطن'], kg: 12, words: ['box', 'boxes', 'carton', 'cartons', 'كرطونة', 'كرطونه', 'كراطن', 'كارطون', 'صناديق'] },
  { name: ['Bed', 'Lit', 'ناموسية'], kg: 40, words: ['bed', 'lit', 'ناموسية', 'ناموسيه', 'سرير', 'فراش'] },
  { name: ['Mattress', 'Matelas', 'ماطلة'], kg: 25, words: ['mattress', 'matelas', 'ماطلة', 'ماطله', 'مطرح'] },
  { name: ['Wardrobe', 'Armoire', 'خزانة'], kg: 60, words: ['wardrobe', 'armoire', 'خزانة', 'خزانه', 'دولاب', 'بلاكار'] },
  { name: ['Table', 'Table', 'طبلة'], kg: 30, words: ['table', 'طبلة', 'طبله', 'طاولة', 'ميدة'] },
  { name: ['Chairs', 'Chaises', 'كراسا'], kg: 5, words: ['chair', 'chairs', 'chaise', 'chaises', 'كراسا', 'كرسي', 'كراسي'] },
  { name: ['Television', 'Télévision', 'تلفازة'], kg: 15, words: ['tv', 'television', 'tele', 'تلفاز', 'تلفازة', 'تلفزة', 'تيليفيزيون'] },
  { name: ['Gas cooker', 'Cuisinière', 'كوزينيرة'], kg: 40, words: ['cooker', 'cuisiniere', 'كوزينيرة', 'كوزينيره', 'فرن'] },
  { name: ['Cement bags', 'Sacs de ciment', 'شكاير ديال السيمة'], kg: 50, words: ['cement', 'ciment', 'سيمة', 'سيمه', 'شكاير', 'اسمنت'] },
  { name: ['Shop goods', 'Marchandise', 'سلعة ديال الحانوت'], kg: 20, words: ['goods', 'marchandise', 'stock', 'سلعة', 'سلعه', 'البضاعة', 'بضاعة'] },
  { name: ['Home items (full move)', 'Affaires de maison (déménagement)', 'حوايج ديال الدار (رحيل)'], kg: 1000, words: ['move house', 'moving house', 'demenagement', 'déménagement', 'حوايج ديال الدار', 'الرحيل', 'رحيل', 'نرحل', 'الدار كاملة'] },
];

/** What the sample room photo shows (boxes are where the objects are in the picture, 0–1). */
export const SAMPLE_ITEMS: Item[] = [
  { id: 'sofa', name: ['Sofa (3 seats)', 'Canapé 3 places', 'صالون (3 بلايص)'], qty: 1, kg: 55, conf: 'high', box: { x: 0.13, y: 0.42, w: 0.48, h: 0.42 } },
  { id: 'boxes', name: ['Cardboard boxes', 'Cartons', 'كراطن'], qty: 7, kg: 12, conf: 'high', box: { x: 0.57, y: 0.22, w: 0.22, h: 0.42 } },
  { id: 'table', name: ['Side table', 'Table basse', 'طبلة صغيرة'], qty: 1, kg: 8, conf: 'medium', box: { x: 0.51, y: 0.68, w: 0.25, h: 0.3 } },
  { id: 'shelf', name: ['Shelving unit', 'Étagère', 'رفوف'], qty: 1, kg: 18, conf: 'medium', box: { x: 0.0, y: 0.02, w: 0.28, h: 0.34 } },
  { id: 'fridge', name: ['Fridge?', 'Frigo ?', 'تلاجة؟'], qty: 1, kg: 65, conf: 'low', box: { x: 0.8, y: 0.3, w: 0.16, h: 0.5 } },
];

export type VehicleId = 'triporteur' | 'smallVan' | 'pickup' | 'largeVan' | 'truck35' | 'truck7';
export const VEHICLES: Record<VehicleId, { name: L3; maxKg: number; img: string; base: number; perKm: number }> = {
  triporteur: { name: ['Triporteur', 'Triporteur', 'تريبورتور'], maxKg: 500, img: triporteur, base: 60, perKm: 2 },
  smallVan: { name: ['Small van', 'Petite fourgonnette', 'فورݣون صغير'], maxKg: 750, img: smallVan, base: 110, perKm: 3 },
  pickup: { name: ['Pickup', 'Pick-up', 'بيكاب'], maxKg: 1200, img: pickup, base: 140, perKm: 3.6 },
  largeVan: { name: ['Large van', 'Grand fourgon', 'فورݣون كبير'], maxKg: 1400, img: largeVan, base: 170, perKm: 4 },
  truck35: { name: ['3.5 t truck', 'Camion 3,5 t', 'كاميو 3.5 طن'], maxKg: 3500, img: truck35, base: 260, perKm: 5 },
  truck7: { name: ['7 t truck', 'Camion 7 t', 'كاميو 7 طن'], maxKg: 7000, img: truck7, base: 420, perKm: 7 },
};
export const bestVehicle = (kg: number): VehicleId =>
  kg <= 120 ? 'triporteur' : (['smallVan', 'pickup', 'largeVan', 'truck35', 'truck7'] as VehicleId[]).find((v) => VEHICLES[v].maxKg >= kg * 1.15) ?? 'truck7';

/** A fair price range from the vehicle, distance and helpers: a market reference only, drivers may offer other prices. */
export function fairPrice(v: VehicleId, km: number, helpers: number) {
  const x = VEHICLES[v];
  const mid = Math.round((x.base + x.perKm * km + helpers * 70) / 10) * 10;
  return { low: Math.round((mid * 0.88) / 10) * 10, mid, high: Math.round((mid * 1.15) / 10) * 10 };
}

export type Driver = { id: string; name: string; nameAr: string; initials: string; color: string; rating: number; trips: number; vehicle: VehicleId; plate: string; helpers: boolean };
export const DRIVERS: Driver[] = [
  { id: 'youssef', name: 'Youssef A.', nameAr: 'يوسف', initials: 'YA', color: '#2F8A7A', rating: 4.9, trips: 128, vehicle: 'smallVan', plate: '48213-A-6', helpers: true },
  { id: 'hamza', name: 'Hamza B.', nameAr: 'حمزة', initials: 'HB', color: '#F07A3A', rating: 4.8, trips: 86, vehicle: 'largeVan', plate: '7720-B-1', helpers: true },
  { id: 'karim', name: 'Karim E.', nameAr: 'كريم', initials: 'KE', color: '#4F6D7A', rating: 4.6, trips: 12, vehicle: 'truck35', plate: '30914-D-6', helpers: false },
];
/** The driver using the driver side of the preview. */
export const ME: Driver = { id: 'me', name: 'Hamid Benali', nameAr: 'حميد بنعلي', initials: 'HB', color: '#163F3A', rating: 4.9, trips: 214, vehicle: 'largeVan', plate: '55102-A-1', helpers: true };
export const driverById = (id: string) => (id === 'me' ? ME : DRIVERS.find((d) => d.id === id)!);

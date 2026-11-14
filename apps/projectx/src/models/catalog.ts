import type { Booking, Category, Lang, VehicleType } from './booking';

/** Everyday cargo the assistant knows, with the words people use (Darija, Arabic, French, English, Arabizi). */
export type Thing = {
  key: string;
  cat: Category;
  /** Typical weight range of one piece, kg. Only an estimate: the customer can always correct it. */
  kg: [number, number];
  fragile?: boolean;
  cold?: boolean;
  label: { en: string; fr: string; ar: string; da: string };
  words: string[];
};

export const THINGS: Thing[] = [
  { key: 'fridge', cat: 'appliance', kg: [60, 90], fragile: true, label: { en: 'refrigerator', fr: 'réfrigérateur', ar: 'ثلاجة', da: 'تلاجة' }, words: ['fridge', 'fridges', 'refrigerator', 'refrigerators', 'frigo', 'frigos', 'refrigerateur', 'refrigerateurs', 'تلاجه', 'تلاجات', 'ثلاجه', 'ثلاجات', 'فريجيدير', 'فريجو', 'tlaja', 'tellaja', 'tlajat', 'frigidaire'] },
  { key: 'freezer', cat: 'appliance', kg: [45, 80], label: { en: 'freezer', fr: 'congélateur', ar: 'مجمّد', da: 'كونجيلاتور' }, words: ['freezer', 'congelateur', 'كونجيلاتور', 'مجمد', 'فريزر'] },
  { key: 'washer', cat: 'appliance', kg: [60, 80], label: { en: 'washing machine', fr: 'machine à laver', ar: 'غسالة', da: 'ماشينة الصابون' }, words: ['washing machine', 'washer', 'machine a laver', 'lave linge', 'lave-linge', 'ماشينه ديال الصابون', 'ماشينه الصابون', 'ماشينة الصابون', 'غساله', 'machina dyal sabon', 'machina sabon', 'machine sabon'] },
  { key: 'cooker', cat: 'appliance', kg: [35, 55], label: { en: 'cooker', fr: 'cuisinière', ar: 'موقد', da: 'كوزينيرة' }, words: ['cooker', 'oven', 'stove', 'cuisiniere', 'gaziniere', 'four', 'كوزينيره', 'فرن', 'بوتاجي', 'cuzinira'] },
  { key: 'tv', cat: 'appliance', kg: [10, 25], fragile: true, label: { en: 'TV', fr: 'télévision', ar: 'تلفاز', da: 'تلفازة' }, words: ['tv', 'television', 'tele', 'televiseur', 'تلفاز', 'تلفازه', 'تلفزه', 'تلفزيون', 'tilfaza'] },
  { key: 'ac', cat: 'appliance', kg: [30, 50], label: { en: 'air conditioner', fr: 'climatiseur', ar: 'مكيّف', da: 'كليماتيزور' }, words: ['air conditioner', 'ac unit', 'climatiseur', 'clim', 'مكيف', 'كليماتيزور', 'كليم'] },
  { key: 'appliance', cat: 'appliance', kg: [30, 80], label: { en: 'household appliance', fr: 'électroménager', ar: 'جهاز منزلي', da: 'اليكتروميناجي' }, words: ['appliance', 'appliances', 'electromenager', 'electro menager', 'اليكتروميناجي', 'الاجهزه المنزليه', 'اجهزه منزليه', 'جهاز منزلي'] },
  { key: 'sofa', cat: 'furniture', kg: [40, 80], label: { en: 'sofa', fr: 'canapé', ar: 'أريكة', da: 'صالون' }, words: ['sofa', 'sofas', 'couch', 'canape', 'canapes', 'salon', 'صالون', 'صالونات', 'كنبه', 'اريكه', 'فوتوي', 'fauteuil'] },
  { key: 'bed', cat: 'furniture', kg: [40, 70], label: { en: 'bed', fr: 'lit', ar: 'سرير', da: 'ناموسية' }, words: ['bed', 'beds', 'lit', 'lits', 'سرير', 'ناموسيه', 'ناموسيات', 'namousiya'] },
  { key: 'mattress', cat: 'furniture', kg: [15, 30], label: { en: 'mattress', fr: 'matelas', ar: 'مرتبة', da: 'ماطلة' }, words: ['mattress', 'mattresses', 'matelas', 'ماطله', 'مطرح', 'مرتبه'] },
  { key: 'wardrobe', cat: 'furniture', kg: [50, 100], label: { en: 'wardrobe', fr: 'armoire', ar: 'خزانة', da: 'دولاب' }, words: ['wardrobe', 'closet', 'armoire', 'placard', 'دولاب', 'خزانه', 'بلاكار', 'doulab'] },
  { key: 'table', cat: 'furniture', kg: [15, 40], label: { en: 'table', fr: 'table', ar: 'طاولة', da: 'طبلة' }, words: ['table', 'tables', 'طبله', 'طاوله', 'ميده', 'tabla'] },
  { key: 'chair', cat: 'furniture', kg: [4, 8], label: { en: 'chair', fr: 'chaise', ar: 'كرسي', da: 'كرسي' }, words: ['chair', 'chairs', 'chaise', 'chaises', 'كرسي', 'كراسي', 'كراسا'] },
  { key: 'desk', cat: 'furniture', kg: [25, 50], label: { en: 'desk', fr: 'bureau', ar: 'مكتب', da: 'بيرو' }, words: ['desk', 'bureau', 'مكتب', 'بيرو'] },
  { key: 'piano', cat: 'furniture', kg: [180, 300], fragile: true, label: { en: 'piano', fr: 'piano', ar: 'بيانو', da: 'بيانو' }, words: ['piano', 'بيانو'] },
  { key: 'meuble', cat: 'furniture', kg: [20, 60], label: { en: 'piece of furniture', fr: 'meuble', ar: 'قطعة أثاث', da: 'موبل' }, words: ['furniture', 'meuble', 'meubles', 'mobilier', 'موبل', 'اثاث', 'فرنيتير', 'موبيليا'] },
  { key: 'boxes', cat: 'boxes', kg: [8, 15], label: { en: 'boxes', fr: 'cartons', ar: 'صناديق', da: 'كراطن' }, words: ['box', 'boxes', 'carton', 'cartons', 'colis', 'parcel', 'parcels', 'package', 'packages', 'كرطونه', 'كرطونات', 'كراطن', 'كارطون', 'صناديق', 'صندوق', 'كولي', 'karton', 'kraten'] },
  { key: 'home_move', cat: 'home_move', kg: [800, 1500], label: { en: 'home contents (house move)', fr: 'affaires de la maison (déménagement)', ar: 'أغراض المنزل (انتقال)', da: 'حوايج الدار (رحيل)' }, words: ['move house', 'moving house', 'house move', 'home move', 'moving out', 'demenagement', 'demenager', 'حوايج ديال الدار', 'حوايج الدار', 'الرحيل', 'رحيل', 'نرحل', 'الدار كامله', 'اثاث المنزل', 'الانتقال', 'nrahal', 'rhil'] },
  { key: 'cement', cat: 'construction', kg: [50, 50], label: { en: 'cement bags', fr: 'sacs de ciment', ar: 'أكياس إسمنت', da: 'شكاير السيمة' }, words: ['cement', 'ciment', 'سيمه', 'اسمنت', 'الاسمنت', 'السيمه', 'شكاير', 'شكاره'] },
  { key: 'bricks', cat: 'construction', kg: [2, 3], label: { en: 'bricks', fr: 'briques', ar: 'طوب', da: 'ياجور' }, words: ['brick', 'bricks', 'brique', 'briques', 'ياجور', 'طوب', 'بريك'] },
  { key: 'sand', cat: 'construction', kg: [1000, 1000], label: { en: 'sand (tons)', fr: 'sable (tonnes)', ar: 'رمل (طن)', da: 'رملة (طن)' }, words: ['sand', 'sable', 'gravel', 'gravier', 'رمله', 'الرمل', 'رمل', 'كياس', 'حصى'] },
  { key: 'rebar', cat: 'construction', kg: [1000, 1000], label: { en: 'steel bars (tons)', fr: 'fer à béton (tonnes)', ar: 'حديد البناء (طن)', da: 'الحديد (طن)' }, words: ['rebar', 'steel bars', 'fer a beton', 'ferraille', 'حديد', 'الحديد'] },
  { key: 'tiles', cat: 'construction', kg: [20, 30], label: { en: 'tile boxes', fr: 'cartons de carrelage', ar: 'صناديق زليج', da: 'كراطن الزليج' }, words: ['tiles', 'tile', 'carrelage', 'zellige', 'زليج', 'الزليج', 'كارو'] },
  { key: 'materials', cat: 'construction', kg: [1000, 1000], label: { en: 'construction materials', fr: 'matériaux de construction', ar: 'مواد البناء', da: 'مواد البني' }, words: ['construction materials', 'building materials', 'materiaux', 'materiaux de construction', 'مواد البناء', 'مواد البني', 'سلعة البني', 'البني'] },
  { key: 'pallets', cat: 'goods', kg: [300, 800], label: { en: 'pallets', fr: 'palettes', ar: 'منصات', da: 'باليطات' }, words: ['pallet', 'pallets', 'palette', 'palettes', 'باليط', 'باليطات', 'بالات'] },
  { key: 'goods', cat: 'goods', kg: [10, 30], label: { en: 'goods', fr: 'marchandise', ar: 'بضاعة', da: 'سلعة' }, words: ['goods', 'merchandise', 'stock', 'marchandise', 'marchandises', 'سلعه', 'السلعه', 'البضاعه', 'بضاعه', 'sel3a', 'sal3a'] },
  { key: 'produce', cat: 'refrigerated', kg: [20, 30], cold: true, label: { en: 'fresh produce crates', fr: 'caisses de produits frais', ar: 'صناديق خضر وفواكه', da: 'قراعي ديال الخضرة' }, words: ['vegetables', 'fruit', 'fruits', 'produce', 'legumes', 'fruits et legumes', 'خضره', 'الخضره', 'فواكه', 'الفواكه', 'خضر'] },
  { key: 'cold_food', cat: 'refrigerated', kg: [20, 30], cold: true, label: { en: 'chilled food', fr: 'produits réfrigérés', ar: 'مواد غذائية مبردة', da: 'ماكلة باردة' }, words: ['meat', 'fish', 'dairy', 'milk', 'yogurt', 'frozen', 'viande', 'poisson', 'lait', 'yaourt', 'surgele', 'surgeles', 'لحم', 'اللحم', 'حوت', 'الحوت', 'حليب', 'الحليب', 'دانون', 'مجمدات'] },
  { key: 'machine', cat: 'equipment', kg: [100, 800], label: { en: 'machine / equipment', fr: 'machine / équipement', ar: 'آلة / معدات', da: 'ماكينة' }, words: ['machine', 'machinery', 'equipment', 'generator', 'compressor', 'equipement', 'groupe electrogene', 'compresseur', 'ماكينه', 'ماكينات', 'جنيراتور', 'موتور', 'معدات', 'الة'] },
  { key: 'motorbike', cat: 'vehicle', kg: [90, 160], label: { en: 'motorbike', fr: 'moto', ar: 'دراجة نارية', da: 'موطور' }, words: ['motorbike', 'motorcycle', 'scooter', 'moto', 'موطور', 'دراجه ناريه', 'سكوتر'] },
];
export const thingByKey = (k: string) => THINGS.find((t) => t.key === k);

export const itemLabel = (key: string, lang: Lang, fallback?: string) => {
  const t = thingByKey(key);
  if (!t) return fallback ?? key;
  return lang === 'darija' ? t.label.da : lang === 'ar' ? t.label.ar : t.label[lang];
};

/** The overall category of a list of items (the "heaviest" kind wins). */
export function categoryOf(keys: string[]): Category | null {
  const cats = keys.map((k) => thingByKey(k)?.cat).filter(Boolean) as Category[];
  if (!cats.length) return null;
  for (const c of ['home_move', 'refrigerated', 'construction', 'equipment', 'vehicle', 'appliance', 'furniture', 'goods', 'boxes'] as Category[]) if (cats.includes(c)) return c;
  return cats[0];
}

/** A fair estimate (kg) from the items, using the middle of each typical range. */
export function estimateKg(items: { key: string; qty: number }[]) {
  let kg = 0;
  for (const it of items) {
    const t = thingByKey(it.key);
    kg += (t ? (t.kg[0] + t.kg[1]) / 2 : 30) * it.qty;
  }
  return Math.round(kg / 5) * 5;
}
export function typicalRange(items: { key: string; qty: number }[]): [number, number] {
  let lo = 0;
  let hi = 0;
  for (const it of items) {
    const t = thingByKey(it.key);
    lo += (t ? t.kg[0] : 5) * it.qty;
    hi += (t ? t.kg[1] : 60) * it.qty;
  }
  return [lo, hi];
}

// ---------------------------------------------------------------- vehicles and prices

export const VEHICLES: Record<VehicleType, { label: { en: string; fr: string; ar: string }; maxKg: number; base: number; perKm: number; seats: number }> = {
  triporteur: { label: { en: 'Triporteur', fr: 'Triporteur', ar: 'تريبورتور' }, maxKg: 400, base: 70, perKm: 2.2, seats: 0 },
  smallVan: { label: { en: 'Small van', fr: 'Petit fourgon', ar: 'فورݣون صغير' }, maxKg: 800, base: 120, perKm: 3, seats: 2 },
  pickup: { label: { en: 'Pickup', fr: 'Pick-up', ar: 'بيكاب' }, maxKg: 1100, base: 140, perKm: 3.4, seats: 2 },
  largeVan: { label: { en: 'Large van', fr: 'Grand fourgon', ar: 'فورݣون كبير' }, maxKg: 1500, base: 180, perKm: 4, seats: 2 },
  cityTruck: { label: { en: 'Light truck', fr: 'Camionnette', ar: 'كاميونيت' }, maxKg: 2500, base: 230, perKm: 4.6, seats: 2 },
  truck35: { label: { en: '3.5 t truck', fr: 'Camion 3,5 t', ar: 'كاميو 3.5 طن' }, maxKg: 3500, base: 280, perKm: 5.2, seats: 2 },
  truck7: { label: { en: '7 t truck', fr: 'Camion 7 t', ar: 'كاميو 7 طن' }, maxKg: 7000, base: 450, perKm: 7.5, seats: 1 },
  refrigerated: { label: { en: 'Refrigerated truck', fr: 'Camion frigorifique', ar: 'شاحنة مبرّدة' }, maxKg: 3000, base: 320, perKm: 6, seats: 1 },
};

export function suggestVehicle(b: Booking): VehicleType {
  if (b.cargo.temperature_control || b.cargo.category === 'refrigerated') return 'refrigerated';
  const kg = b.cargo.estimated_weight_kg ?? estimateKg(b.cargo.items);
  const bulky = b.cargo.category === 'furniture' || b.cargo.category === 'home_move' || b.cargo.category === 'appliance';
  const order: VehicleType[] = ['triporteur', 'smallVan', 'pickup', 'largeVan', 'cityTruck', 'truck35', 'truck7'];
  for (const v of order) {
    if (v === 'triporteur' && (bulky || kg > 250)) continue;
    if (VEHICLES[v].maxKg >= kg * 1.15) return v;
  }
  return 'truck7';
}

/** Reference price range in MAD. Drivers make the real offers. */
export function priceRange(b: Booking, km: number) {
  const v = b.vehicle.required ?? suggestVehicle(b);
  const x = VEHICLES[v];
  const helpers = b.assistance.helpers ?? 0;
  const stairs = [b.pickup, b.destination].reduce((s, p) => s + (p && p.floor && !p.elevator ? p.floor * 25 : 0), 0);
  const mid = x.base + x.perKm * km + helpers * 80 + stairs;
  const r = (n: number) => Math.round(n / 10) * 10;
  return { vehicle: v, low: r(mid * 0.88), mid: r(mid), high: r(mid * 1.15) };
}

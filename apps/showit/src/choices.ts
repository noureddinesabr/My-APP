// The quick choices a customer taps; the AI pre-selects them and the customer can change any.

export const GOODS = ['furniture', 'appliances', 'boxes', 'building', 'food', 'machines', 'move', 'other'] as const;
export type Goods = (typeof GOODS)[number];

export const GOODS_ICON: Record<Goods, string> = {
  furniture: 'bed-outline',
  appliances: 'snow-outline',
  boxes: 'cube-outline',
  building: 'construct-outline',
  food: 'nutrition-outline',
  machines: 'cog-outline',
  move: 'home-outline',
  other: 'ellipsis-horizontal',
};

/** Weight choices in kg, with the label shown. */
export const WEIGHTS: { kg: number; label: string }[] = [
  { kg: 250, label: '≈ 250 kg' },
  { kg: 500, label: '≈ 500 kg' },
  { kg: 1000, label: '≈ 1 t' },
  { kg: 1500, label: '≈ 1.5 t' },
  { kg: 3000, label: '≈ 3 t' },
  { kg: 5000, label: '≈ 5 t' },
  { kg: 10000, label: '≈ 10 t' },
  { kg: 20000, label: '20 t +' },
];

/** The weight choice closest to an estimate. */
export function nearestWeight(kg: number) {
  if (!kg) return 0;
  return WEIGHTS.reduce((best, w) => (Math.abs(w.kg - kg) < Math.abs(best - kg) ? w.kg : best), WEIGHTS[0].kg);
}

export const NOTE_TAGS = ['lift', 'noLift', 'ground', 'upstairs', 'fragile', 'heavy', 'narrow', 'strap', 'upright', 'cover'] as const;
export type NoteTag = (typeof NOTE_TAGS)[number];

/** Things people often move, for adding by hand, with a typical weight each (kg). */
export const COMMON_ITEMS = [
  { id: 'sofa', icon: 'bed-outline', kg: 60 },
  { id: 'bed', icon: 'bed-outline', kg: 50 },
  { id: 'mattress', icon: 'square-outline', kg: 25 },
  { id: 'wardrobe', icon: 'file-tray-stacked-outline', kg: 70 },
  { id: 'fridge', icon: 'snow-outline', kg: 70 },
  { id: 'washer', icon: 'water-outline', kg: 70 },
  { id: 'table', icon: 'grid-outline', kg: 25 },
  { id: 'chairs', icon: 'person-outline', kg: 5 },
  { id: 'boxes', icon: 'cube-outline', kg: 12 },
  { id: 'tv', icon: 'tv-outline', kg: 15 },
  { id: 'sacks', icon: 'bag-outline', kg: 50 },
  { id: 'plants', icon: 'leaf-outline', kg: 6 },
] as const;
export type CommonItem = (typeof COMMON_ITEMS)[number]['id'];

/** More things people move, for suggestions while typing (name in each language, typical kg). */
export const MORE_ITEMS: { en: string; fr: string; ar: string; kg: number }[] = [
  { en: 'Wardrobe', fr: 'Armoire', ar: 'خزانة ملابس', kg: 70 },
  { en: 'Double bed', fr: 'Lit double', ar: 'سرير مزدوج', kg: 60 },
  { en: 'Single bed', fr: 'Lit simple', ar: 'سرير فردي', kg: 35 },
  { en: 'Mattress', fr: 'Matelas', ar: 'مرتبة', kg: 25 },
  { en: 'Sofa (3 seats)', fr: 'Canapé 3 places', ar: 'كنبة 3 مقاعد', kg: 60 },
  { en: 'Corner sofa', fr: 'Canapé d\'angle', ar: 'كنبة زاوية', kg: 90 },
  { en: 'Moroccan salon (sedari)', fr: 'Salon marocain', ar: 'صالون مغربي', kg: 120 },
  { en: 'Armchair', fr: 'Fauteuil', ar: 'كرسي بذراعين', kg: 20 },
  { en: 'Dining table', fr: 'Table à manger', ar: 'طاولة طعام', kg: 30 },
  { en: 'Coffee table', fr: 'Table basse', ar: 'طاولة صغيرة', kg: 12 },
  { en: 'Chair', fr: 'Chaise', ar: 'كرسي', kg: 5 },
  { en: 'Desk', fr: 'Bureau', ar: 'مكتب', kg: 30 },
  { en: 'Bookcase', fr: 'Bibliothèque', ar: 'مكتبة', kg: 35 },
  { en: 'Chest of drawers', fr: 'Commode', ar: 'خزانة أدراج', kg: 40 },
  { en: 'TV cabinet', fr: 'Meuble TV', ar: 'طاولة تلفاز', kg: 25 },
  { en: 'Fridge', fr: 'Réfrigérateur', ar: 'ثلاجة', kg: 70 },
  { en: 'Freezer', fr: 'Congélateur', ar: 'مجمد', kg: 60 },
  { en: 'Washing machine', fr: 'Lave-linge', ar: 'غسالة', kg: 70 },
  { en: 'Dishwasher', fr: 'Lave-vaisselle', ar: 'غسالة صحون', kg: 50 },
  { en: 'Cooker / oven', fr: 'Cuisinière', ar: 'فرن', kg: 45 },
  { en: 'Gas bottle', fr: 'Bouteille de gaz', ar: 'قنينة غاز', kg: 25 },
  { en: 'Air conditioner', fr: 'Climatiseur', ar: 'مكيف هواء', kg: 35 },
  { en: 'Water heater', fr: 'Chauffe-eau', ar: 'سخان ماء', kg: 25 },
  { en: 'TV', fr: 'Télévision', ar: 'تلفاز', kg: 15 },
  { en: 'Piano', fr: 'Piano', ar: 'بيانو', kg: 220 },
  { en: 'Carpet / rug', fr: 'Tapis', ar: 'زربية', kg: 15 },
  { en: 'Mirror', fr: 'Miroir', ar: 'مرآة', kg: 10 },
  { en: 'Boxes', fr: 'Cartons', ar: 'صناديق كرتون', kg: 12 },
  { en: 'Suitcases', fr: 'Valises', ar: 'حقائب', kg: 15 },
  { en: 'Bicycle', fr: 'Vélo', ar: 'دراجة', kg: 15 },
  { en: 'Motorbike', fr: 'Moto', ar: 'دراجة نارية', kg: 120 },
  { en: 'Cement bags', fr: 'Sacs de ciment', ar: 'أكياس إسمنت', kg: 50 },
  { en: 'Bricks (pallet)', fr: 'Briques (palette)', ar: 'آجور (منصة)', kg: 1000 },
  { en: 'Tiles (boxes)', fr: 'Carrelage (cartons)', ar: 'زليج (صناديق)', kg: 25 },
  { en: 'Pallet of goods', fr: 'Palette de marchandise', ar: 'منصة سلع', kg: 500 },
  { en: 'Sacks of flour', fr: 'Sacs de farine', ar: 'أكياس دقيق', kg: 50 },
  { en: 'Crates of vegetables', fr: 'Caisses de légumes', ar: 'صناديق خضر', kg: 20 },
  { en: 'Office printer', fr: 'Imprimante', ar: 'طابعة', kg: 25 },
  { en: 'Safe', fr: 'Coffre-fort', ar: 'خزنة', kg: 150 },
];

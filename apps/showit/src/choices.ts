// The quick choices a customer taps; the AI pre-selects them and the customer can change any.

/**
 * The kinds of load, in the order the customer sees them (the user's own list), then "other things".
 * The AI's photo reading uses the same kinds.
 */
export const GOODS = ['household', 'office', 'food', 'industrial', 'building', 'commercial', 'auto', 'farm', 'medical', 'chemical', 'cold', 'other'] as const;
export type Goods = (typeof GOODS)[number];

export const GOODS_ICON: Record<Goods, string> = {
  household: 'home-outline',
  office: 'briefcase-outline',
  food: 'fast-food-outline',
  industrial: 'cog-outline',
  building: 'construct-outline',
  commercial: 'storefront-outline',
  auto: 'car-sport-outline',
  farm: 'leaf-outline',
  medical: 'medkit-outline',
  chemical: 'flask-outline',
  cold: 'snow-outline',
  other: 'add-circle-outline',
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

/** The kinds a customer taps (all but "other", which opens a box to write in). */
export const LOAD_CATS = GOODS.filter((g) => g !== 'other') as Exclude<Goods, 'other'>[];
export type LoadCat = Exclude<Goods, 'other'>;
export const LOAD_CAT_ICON = GOODS_ICON;

/**
 * Things people move, with a typical weight each (kg), their kind, and the names people
 * type: Arabic as used in Morocco first, the Darija word in brackets when that is what
 * people say, and `alt` spellings (Darija in Arabic and Latin letters, French) for searching.
 */
export type Thing = { id: string; cat: LoadCat; en: string; fr: string; ar: string; alt: string[]; kg: number };
export const THINGS: Thing[] = [
  // Furniture
  { id: 'salon', cat: 'household', en: 'Moroccan salon (sedari)', fr: 'Salon marocain (sedari)', ar: 'صالون مغربي (سدّاري)', alt: ['سداري', 'صالون', 'sdari', 'sedari', 'salon beldi'], kg: 120 },
  { id: 'sofa', cat: 'household', en: 'Sofa', fr: 'Canapé', ar: 'أريكة (كنابي)', alt: ['كنابي', 'كانابي', 'canape', 'kanape', 'couch'], kg: 60 },
  { id: 'armchair', cat: 'household', en: 'Armchair', fr: 'Fauteuil', ar: 'كرسي بذراعين (فوطاي)', alt: ['فوطاي', 'فوطوي', 'fotay', 'fauteuil'], kg: 20 },
  { id: 'bed2', cat: 'household', en: 'Double bed', fr: 'Lit double', ar: 'سرير مزدوج (ناموسية)', alt: ['ناموسية', 'فراش', 'سرير', 'namousia', 'lit'], kg: 60 },
  { id: 'bed1', cat: 'household', en: 'Single bed', fr: 'Lit simple', ar: 'سرير فردي (ناموسية)', alt: ['ناموسية صغيرة', 'سرير صغير', 'namousia'], kg: 35 },
  { id: 'mattress', cat: 'household', en: 'Mattress', fr: 'Matelas', ar: 'مطرح (ماطلة)', alt: ['ماطلة', 'ماطلا', 'مطارح', 'matela', 'matelas', 'mattress'], kg: 25 },
  { id: 'wardrobe', cat: 'household', en: 'Wardrobe', fr: 'Armoire', ar: 'خزانة الملابس (ماريو)', alt: ['ماريو', 'دولاب', 'mario', 'armoire', 'placard'], kg: 70 },
  { id: 'drawers', cat: 'household', en: 'Chest of drawers', fr: 'Commode', ar: 'خزانة بأدراج (كوميضة)', alt: ['كوميضة', 'كومود', 'commode'], kg: 40 },
  { id: 'dining', cat: 'household', en: 'Dining table', fr: 'Table à manger', ar: 'طاولة الأكل (طبلة)', alt: ['طبلة', 'طابلة', 'مائدة', 'tabla', 'table'], kg: 30 },
  { id: 'lowtable', cat: 'household', en: 'Low / coffee table', fr: 'Table basse', ar: 'مائدة صغيرة (طيفور)', alt: ['طيفور', 'مايدة', 'tifour', 'table basse'], kg: 12 },
  { id: 'chairs', cat: 'household', en: 'Chair', fr: 'Chaise', ar: 'كرسي', alt: ['كراسي', 'شيز', 'chaise', 'korsi'], kg: 5 },
  { id: 'desk', cat: 'household', en: 'Desk', fr: 'Bureau', ar: 'مكتب (بيرو)', alt: ['بيرو', 'bureau', 'biro'], kg: 30 },
  { id: 'bookcase', cat: 'household', en: 'Bookcase / shelves', fr: 'Bibliothèque', ar: 'مكتبة (رفوف)', alt: ['بيبليوتيك', 'رفوف', 'bibliotheque', 'etagere'], kg: 35 },
  { id: 'tvstand', cat: 'household', en: 'TV cabinet', fr: 'Meuble TV', ar: 'طاولة التلفاز (موبل تيفي)', alt: ['موبل', 'meuble tv', 'meuble'], kg: 25 },
  { id: 'carpet', cat: 'household', en: 'Carpet / rug', fr: 'Tapis', ar: 'زربية', alt: ['زرابي', 'tapis', 'zerbia', 'zarbia'], kg: 15 },
  { id: 'mirror', cat: 'household', en: 'Mirror', fr: 'Miroir', ar: 'مرآة (مراية)', alt: ['مراية', 'miroir', 'mraya'], kg: 10 },
  { id: 'babybed', cat: 'household', en: 'Baby cot', fr: 'Lit bébé', ar: 'سرير الرضيع', alt: ['ناموسية الدري', 'lit bebe'], kg: 15 },
  // Home appliances
  { id: 'fridge', cat: 'household', en: 'Fridge', fr: 'Réfrigérateur', ar: 'ثلاجة (فريجيدير)', alt: ['فريجيدير', 'تلاجة', 'frigo', 'frigidaire', 'refrigerateur'], kg: 70 },
  { id: 'freezer', cat: 'household', en: 'Freezer', fr: 'Congélateur', ar: 'مجمّد (كونجيلاتور)', alt: ['كونجيلاتور', 'congelateur', 'mojamid'], kg: 60 },
  { id: 'washer', cat: 'household', en: 'Washing machine', fr: 'Lave-linge', ar: 'آلة الغسيل (لافوز)', alt: ['لافوز', 'ماشينة', 'ماشينة ديال الصابون', 'machine a laver', 'lavoz', 'machina'], kg: 70 },
  { id: 'dishwasher', cat: 'household', en: 'Dishwasher', fr: 'Lave-vaisselle', ar: 'آلة غسل الأواني', alt: ['لافيسيل', 'lave vaisselle'], kg: 50 },
  { id: 'cooker', cat: 'household', en: 'Cooker / oven', fr: 'Cuisinière', ar: 'فرن الطهي (كوزينيير)', alt: ['كوزينيير', 'فورنو', 'فران', 'cuisiniere', 'four', 'forno'], kg: 45 },
  { id: 'gas', cat: 'household', en: 'Gas bottle', fr: 'Bouteille de gaz', ar: 'قنينة الغاز (البوطة)', alt: ['بوطة', 'البوطة', 'bouta', 'butane', 'gaz'], kg: 25 },
  { id: 'ac', cat: 'household', en: 'Air conditioner', fr: 'Climatiseur', ar: 'مكيّف الهواء (كليما)', alt: ['كليما', 'كليماتيزور', 'clim', 'climatiseur'], kg: 35 },
  { id: 'heater', cat: 'household', en: 'Water heater', fr: 'Chauffe-eau', ar: 'سخان الماء (شوفو)', alt: ['شوفو', 'شوفاج', 'chauffe eau', 'chauffo'], kg: 25 },
  { id: 'tv', cat: 'household', en: 'TV', fr: 'Télévision', ar: 'تلفاز (تلفزة)', alt: ['تلفزة', 'تيليفيزيون', 'tv', 'tele', 'television'], kg: 15 },
  { id: 'microwave', cat: 'household', en: 'Microwave', fr: 'Micro-ondes', ar: 'فرن الميكروويف (ميكروند)', alt: ['ميكروند', 'micro onde', 'microonde'], kg: 15 },
  // Boxes and belongings
  { id: 'boxes', cat: 'household', en: 'Boxes', fr: 'Cartons', ar: 'كراتين', alt: ['كرطونة', 'كارطونة', 'صناديق', 'cartons', 'karton'], kg: 12 },
  { id: 'suitcases', cat: 'household', en: 'Suitcases', fr: 'Valises', ar: 'حقائب (فاليزات)', alt: ['فاليزة', 'فاليزات', 'شنطة', 'valise'], kg: 15 },
  { id: 'clothes', cat: 'household', en: 'Bags of clothes', fr: 'Sacs de vêtements', ar: 'أكياس الملابس (خناشي)', alt: ['خنشة', 'خناشي', 'حوايج', 'sacs', 'hwayej'], kg: 10 },
  { id: 'kitchen', cat: 'household', en: 'Kitchen things', fr: 'Ustensiles de cuisine', ar: 'أواني المطبخ (الماعون)', alt: ['ماعون', 'الماعون', 'ustensiles', 'maoun'], kg: 15 },
  { id: 'bicycle', cat: 'household', en: 'Bicycle', fr: 'Vélo', ar: 'دراجة (بشكليط)', alt: ['بشكليط', 'velo', 'bichklit'], kg: 15 },
  { id: 'motorbike', cat: 'household', en: 'Motorbike', fr: 'Moto', ar: 'دراجة نارية (موطور)', alt: ['موطور', 'موتور', 'moto', 'motor'], kg: 120 },
  { id: 'plants', cat: 'household', en: 'Plants', fr: 'Plantes', ar: 'نباتات', alt: ['غراس', 'plantes'], kg: 6 },
  // Building materials
  { id: 'cement', cat: 'building', en: 'Cement bags', fr: 'Sacs de ciment', ar: 'أكياس الإسمنت (السيما)', alt: ['سيما', 'السيما', 'اسمنت', 'ciment', 'sima'], kg: 50 },
  { id: 'sand', cat: 'building', en: 'Sand (1 m³)', fr: 'Sable (1 m³)', ar: 'رمل (رملة) · متر مكعب', alt: ['رملة', 'رمل', 'sable', 'remla'], kg: 1500 },
  { id: 'gravel', cat: 'building', en: 'Gravel (1 m³)', fr: 'Gravier (1 m³)', ar: 'حصى (كرافيط) · متر مكعب', alt: ['كرافيط', 'گرافيط', 'gravette', 'gravier'], kg: 1500 },
  { id: 'bricks', cat: 'building', en: 'Bricks (pallet)', fr: 'Briques (palette)', ar: 'آجور (البريك) · منصة', alt: ['بريك', 'البريك', 'brique', 'brik'], kg: 1000 },
  { id: 'tiles', cat: 'building', en: 'Tiles (boxes)', fr: 'Carrelage (cartons)', ar: 'زليج وبلاط (كارو)', alt: ['زليج', 'كارو', 'بلاط', 'carrelage', 'zellige', 'karo'], kg: 25 },
  { id: 'iron', cat: 'building', en: 'Iron bars', fr: 'Fer à béton', ar: 'حديد البناء (الفيرايا)', alt: ['فيرايا', 'الحديد', 'ferraille', 'fer'], kg: 300 },
  { id: 'wood', cat: 'building', en: 'Wood planks', fr: 'Planches de bois', ar: 'ألواح الخشب (لوح)', alt: ['لوح', 'خشب', 'bois', 'planche'], kg: 100 },
  { id: 'paint', cat: 'building', en: 'Paint buckets', fr: 'Pots de peinture', ar: 'سطول الصباغة', alt: ['صباغة', 'peinture', 'sbagha'], kg: 25 },
  { id: 'sanitary', cat: 'building', en: 'Sanitary ware', fr: 'Sanitaire', ar: 'أدوات صحية (سانيتير)', alt: ['سانيتير', 'sanitaire', 'toilette'], kg: 40 },
  // Food and cold goods
  { id: 'flour', cat: 'food', en: 'Flour sacks', fr: 'Sacs de farine', ar: 'أكياس الدقيق (الفارينة)', alt: ['فارينة', 'دقيق', 'farine', 'farina'], kg: 50 },
  { id: 'veg', cat: 'food', en: 'Vegetable crates', fr: 'Caisses de légumes', ar: 'صناديق الخضر (الخضرة)', alt: ['خضرة', 'الخضرة', 'legumes', 'khodra'], kg: 20 },
  { id: 'fruit', cat: 'food', en: 'Fruit crates', fr: 'Caisses de fruits', ar: 'صناديق الفواكه', alt: ['فواكه', 'fruits', 'fakia', 'فاكية'], kg: 20 },
  { id: 'water', cat: 'food', en: 'Water / drinks (packs)', fr: 'Eau / boissons (packs)', ar: 'قنينات الماء والمشروبات', alt: ['قراعي', 'قرعة', 'eau', 'boissons', 'qar3a'], kg: 10 },
  { id: 'frozen', cat: 'food', en: 'Frozen goods (keep cold)', fr: 'Surgelés (froid)', ar: 'مواد مجمّدة (تحتاج تبريد)', alt: ['مجمد', 'surgele', 'congele'], kg: 20 },
  { id: 'meat', cat: 'food', en: 'Meat / fish (cold)', fr: 'Viande / poisson (froid)', ar: 'لحوم وأسماك (مبرّدة)', alt: ['لحم', 'حوت', 'viande', 'poisson', 'hout'], kg: 20 },
  { id: 'dairy', cat: 'food', en: 'Dairy (cold)', fr: 'Produits laitiers (froid)', ar: 'مشتقات الحليب (مبرّدة)', alt: ['حليب', 'لبن', 'lait', 'yaourt'], kg: 15 },
  { id: 'sugar', cat: 'food', en: 'Sugar / oil (boxes)', fr: 'Sucre / huile (cartons)', ar: 'السكر والزيت (كراتين)', alt: ['سكر', 'قالب', 'زيت', 'sucre', 'huile'], kg: 25 },
  // Shop goods
  { id: 'pallet', cat: 'commercial', en: 'Pallet of goods', fr: 'Palette de marchandise', ar: 'منصة سلع (باليط)', alt: ['باليط', 'پاليط', 'palette', 'paleta'], kg: 500 },
  { id: 'stock', cat: 'commercial', en: 'Shop stock (boxes)', fr: 'Stock de magasin (cartons)', ar: 'سلع المحل (كراتين)', alt: ['سلعة', 'السلعة', 'marchandise', 'sel3a'], kg: 15 },
  { id: 'bales', cat: 'commercial', en: 'Bales of clothes', fr: 'Balles de vêtements', ar: 'بالات الملابس (البال)', alt: ['بال', 'البال', 'balle', 'friperie'], kg: 50 },
  { id: 'shelves', cat: 'commercial', en: 'Shop shelves', fr: 'Étagères de magasin', ar: 'رفوف المحل (إيطاجير)', alt: ['إيطاجير', 'ايطاجير', 'etagere', 'rayonnage'], kg: 40 },
  { id: 'fridgeshop', cat: 'commercial', en: 'Shop fridge / display', fr: 'Frigo vitrine', ar: 'ثلاجة المحل (فيترين)', alt: ['فيترين', 'vitrine', 'frigo magasin'], kg: 120 },
  { id: 'machine', cat: 'commercial', en: 'Machine / equipment', fr: 'Machine / équipement', ar: 'آلة ومعدات (ماشينة)', alt: ['ماشينة', 'معدات', 'machine', 'equipement'], kg: 200 },
  { id: 'safe', cat: 'commercial', en: 'Safe', fr: 'Coffre-fort', ar: 'خزنة (كوفر)', alt: ['كوفر', 'coffre', 'coffre fort'], kg: 150 },
  { id: 'printer', cat: 'commercial', en: 'Office printer', fr: 'Imprimante', ar: 'طابعة', alt: ['امبريمونت', 'imprimante'], kg: 25 },
];
/** Kept for older callers. */
export const MORE_ITEMS = THINGS;

/** For matching what people type: no Arabic vowel marks, one form of alif / ya / ta marbuta, no accents. */
export function fold(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/گ/g, 'ك')
    .replace(/پ/g, 'ب')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Things matching what was typed, in any language or spelling; names starting with it come first. */
export function findThings(text: string, limit = 8): Thing[] {
  const q = fold(text);
  if (!q) return [];
  const scored: { t: Thing; score: number }[] = [];
  for (const t of THINGS) {
    const names = [t.ar, t.fr, t.en, ...t.alt].map(fold);
    let score = 0;
    for (const n of names) {
      if (n.startsWith(q)) score = Math.max(score, 3);
      else if (n.split(/[\s()·/]+/).some((w) => w.startsWith(q))) score = Math.max(score, 2);
      else if (n.includes(q)) score = Math.max(score, 1);
    }
    if (score) scored.push({ t, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.t);
}

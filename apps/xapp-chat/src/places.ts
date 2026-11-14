/** Words shown in three languages: [English, French, Arabic]. */
export type L3 = [string, string, string];
export type Lang = 'en' | 'fr' | 'ar';
export const pick = (l: L3, lang: Lang) => l[lang === 'en' ? 0 : lang === 'fr' ? 1 : 2];

/**
 * Places the assistant understands, with the names people really say (Darija, Arabic, French,
 * English, common spellings). `city` groups neighbourhoods; `x`/`y` place it on the drawn Morocco map (0–400).
 */
export type Place = { id: string; name: L3; city: string; lat: number; lng: number; x: number; y: number; alias: string[] };

const P = (id: string, name: L3, city: string, lat: number, lng: number, x: number, y: number, alias: string[]): Place => ({ id, name, city, lat, lng, x, y, alias });
export const PLACES: Place[] = [
  // Casablanca neighbourhoods
  P('maarif', ['Maarif, Casablanca', 'Maârif, Casablanca', 'المعاريف، الدار البيضاء'], 'casa', 33.586, -7.632, 168, 128, ['maarif', 'maârif', 'المعاريف', 'معاريف']),
  P('gauthier', ['Gauthier, Casablanca', 'Gauthier, Casablanca', 'غوتييه، الدار البيضاء'], 'casa', 33.592, -7.626, 168, 128, ['gauthier', 'غوتييه', 'غوتيي']),
  P('ainsebaa', ['Ain Sebaa, Casablanca', 'Aïn Sebaâ, Casablanca', 'عين السبع، الدار البيضاء'], 'casa', 33.606, -7.534, 170, 126, ['ain sebaa', 'aïn sebaâ', 'عين السبع']),
  P('hayhassani', ['Hay Hassani, Casablanca', 'Hay Hassani, Casablanca', 'الحي الحسني، الدار البيضاء'], 'casa', 33.567, -7.668, 166, 129, ['hay hassani', 'الحي الحسني', 'حي حسني']),
  P('sidimaarouf', ['Sidi Maarouf, Casablanca', 'Sidi Maârouf, Casablanca', 'سيدي معروف، الدار البيضاء'], 'casa', 33.53, -7.643, 168, 131, ['sidi maarouf', 'سيدي معروف']),
  P('derbomar', ['Derb Omar, Casablanca', 'Derb Omar, Casablanca', 'درب عمر، الدار البيضاء'], 'casa', 33.597, -7.607, 168, 127, ['derb omar', 'درب عمر']),
  P('casa', ['Casablanca', 'Casablanca', 'الدار البيضاء'], 'casa', 33.573, -7.589, 168, 128, ['casablanca', 'casa', 'كازا', 'كازابلانكا', 'الدار البيضاء', 'البيضاء', 'الدارالبيضاء', 'dar lbida', 'darbida']),
  // Cities
  P('rabat', ['Rabat', 'Rabat', 'الرباط'], 'rabat', 34.02, -6.84, 204, 98, ['rabat', 'الرباط', 'رباط', 'rbat']),
  P('sale', ['Salé', 'Salé', 'سلا'], 'sale', 34.05, -6.8, 206, 96, ['sale', 'salé', 'سلا', 'sla']),
  P('temara', ['Temara', 'Témara', 'تمارة'], 'temara', 33.928, -6.906, 200, 102, ['temara', 'témara', 'تمارة', 'تماره']),
  P('kenitra', ['Kenitra', 'Kénitra', 'القنيطرة'], 'kenitra', 34.26, -6.58, 214, 84, ['kenitra', 'kénitra', 'القنيطرة', 'قنيطرة', 'لقنيطرة']),
  P('mohammedia', ['Mohammedia', 'Mohammedia', 'المحمدية'], 'mohammedia', 33.686, -7.383, 180, 118, ['mohammedia', 'المحمدية', 'محمدية', 'fdala', 'فضالة']),
  P('berrechid', ['Berrechid', 'Berrechid', 'برشيد'], 'berrechid', 33.265, -7.587, 172, 146, ['berrechid', 'برشيد']),
  P('settat', ['Settat', 'Settat', 'سطات'], 'settat', 33.0, -7.62, 170, 158, ['settat', 'سطات']),
  P('eljadida', ['El Jadida', 'El Jadida', 'الجديدة'], 'eljadida', 33.254, -8.508, 140, 150, ['el jadida', 'jadida', 'الجديدة', 'جديدة', 'لجديدة']),
  P('safi', ['Safi', 'Safi', 'آسفي'], 'safi', 32.3, -9.24, 118, 190, ['safi', 'آسفي', 'اسفي', 'سافي', 'asfi']),
  P('marrakech', ['Marrakech', 'Marrakech', 'مراكش'], 'marrakech', 31.63, -8.0, 142, 222, ['marrakech', 'marrakesh', 'مراكش', 'مراكوش', 'mrakch']),
  P('essaouira', ['Essaouira', 'Essaouira', 'الصويرة'], 'essaouira', 31.51, -9.77, 100, 232, ['essaouira', 'الصويرة', 'صويرة', 'swira']),
  P('agadir', ['Agadir', 'Agadir', 'أكادير'], 'agadir', 30.43, -9.6, 86, 292, ['agadir', 'أكادير', 'اكادير', 'كادير']),
  P('beni-mellal', ['Beni Mellal', 'Béni Mellal', 'بني ملال'], 'beni-mellal', 32.34, -6.36, 196, 186, ['beni mellal', 'béni mellal', 'بني ملال']),
  P('khouribga', ['Khouribga', 'Khouribga', 'خريبكة'], 'khouribga', 32.88, -6.91, 186, 166, ['khouribga', 'خريبكة', 'خريبكه']),
  P('meknes', ['Meknes', 'Meknès', 'مكناس'], 'meknes', 33.9, -5.55, 262, 108, ['meknes', 'meknès', 'مكناس', 'mknas']),
  P('fes', ['Fes', 'Fès', 'فاس'], 'fes', 34.03, -5.0, 286, 104, ['fes', 'fès', 'fez', 'فاس']),
  P('tangier', ['Tangier', 'Tanger', 'طنجة'], 'tangier', 35.76, -5.83, 246, 30, ['tangier', 'tanger', 'طنجة', 'طنجه', 'tanja']),
  P('tetouan', ['Tetouan', 'Tétouan', 'تطوان'], 'tetouan', 35.57, -5.37, 262, 36, ['tetouan', 'tétouan', 'تطوان', 'tetwan']),
  P('oujda', ['Oujda', 'Oujda', 'وجدة'], 'oujda', 34.68, -1.91, 372, 76, ['oujda', 'وجدة', 'وجده', 'wjda']),
  P('nador', ['Nador', 'Nador', 'الناظور'], 'nador', 35.17, -2.93, 344, 52, ['nador', 'الناظور', 'ناظور']),
  P('alhoceima', ['Al Hoceima', 'Al Hoceïma', 'الحسيمة'], 'alhoceima', 35.25, -3.94, 312, 46, ['hoceima', 'al hoceima', 'الحسيمة', 'حسيمة']),
  P('errachidia', ['Errachidia', 'Errachidia', 'الراشيدية'], 'errachidia', 31.93, -4.42, 290, 214, ['errachidia', 'الراشيدية', 'رشيدية']),
  P('ouarzazate', ['Ouarzazate', 'Ouarzazate', 'ورزازات'], 'ouarzazate', 30.92, -6.89, 196, 262, ['ouarzazate', 'ورزازات']),
  P('guelmim', ['Guelmim', 'Guelmim', 'كلميم'], 'guelmim', 28.99, -10.06, 70, 332, ['guelmim', 'كلميم', 'gulmim']),
  P('laayoune', ['Laayoune', 'Laâyoune', 'العيون'], 'laayoune', 27.15, -13.2, 40, 362, ['laayoune', 'laâyoune', 'العيون', 'لعيون']),
  P('dakhla', ['Dakhla', 'Dakhla', 'الداخلة'], 'dakhla', 23.68, -15.96, 14, 396, ['dakhla', 'الداخلة', 'داخلة', 'دخلة', 'الدخلة']),
];
export const placeById = (id: string) => PLACES.find((p) => p.id === id)!;

/** Lowercase, no French accents, Arabic letters unified, Arabic digits → 0-9. */
export function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٕ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[?!.,؟،:;«»"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every place named in a sentence, in the order they appear (neighbourhoods before their city). */
export function placesIn(text: string): { place: Place; at: number }[] {
  const t = ` ${norm(text)} `;
  const found: { place: Place; at: number }[] = [];
  for (const p of PLACES) {
    let best = -1;
    for (const a of p.alias) {
      const w = norm(a);
      const latin = /^[a-z0-9 ]+$/.test(w);
      const re = latin ? new RegExp(`[^a-z]${w}[^a-z]`) : null;
      const i = re ? t.search(re) : Math.max(t.indexOf(` ${w}`), t.indexOf(`ل${w}`), t.indexOf(`ف${w}`), t.indexOf(`ب${w}`), t.indexOf(`و${w}`));
      if (i >= 0 && (best < 0 || i < best)) best = i;
    }
    if (best >= 0) found.push({ place: p, at: best });
  }
  // A neighbourhood wins over the bare city it belongs to.
  const keep = found.filter((f) => !(f.place.id === f.place.city && found.some((g) => g.place.city === f.place.city && g.place.id !== g.place.city)));
  return keep.sort((a, b) => a.at - b.at);
}

/** Road distance (km) and drive time (min): straight line × 1.3. */
export function routeOf(a: Place, b: Place) {
  const r = Math.PI / 180;
  const d = 2 * 6371 * Math.asin(Math.sqrt(Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2));
  const km = Math.max(4, Math.round(d * 1.3));
  const min = Math.round(km > 40 ? (km / 75) * 60 + 15 : (km / 24) * 60 + 8);
  return { km, min };
}

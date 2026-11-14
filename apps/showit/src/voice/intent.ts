/**
 * The driver's voice commands (simple design preview): what was said → one command. Pure, with no
 * imports, so it is tested with plain Node (scripts/voice-test.ts). Understands English, French,
 * Arabic and Moroccan Darija (Arabic letters, and the Latin "Arabizi" spellings drivers type, e.g.
 * "chno kayn", "zid 50"), with numbers said as digits or words.
 */

export type Intent =
  | { kind: 'list' }
  | { kind: 'next' }
  | { kind: 'repeat' }
  | { kind: 'accept' }
  | { kind: 'decline' }
  | { kind: 'more'; n?: number }
  | { kind: 'less'; n?: number }
  | { kind: 'price'; n: number }
  | { kind: 'yes' }
  | { kind: 'no' }
  | { kind: 'take' }
  | { kind: 'onway' }
  | { kind: 'arrived' }
  | { kind: 'loaded' }
  | { kind: 'handed' }
  | { kind: 'online' }
  | { kind: 'offline' }
  | { kind: 'help' }
  | { kind: 'stop' }
  | { kind: 'unknown' };

/** Lower case, no Arabic vowel marks or tatweel, one form of alef / yeh / teh marbuta, Arabic digits → 0-9. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[éèêë]/g, 'e')
    .replace(/[àâä]/g, 'a')
    .replace(/[ç]/g, 'c')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/[îï]/g, 'i')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Number words in the four ways drivers speak, keyed after `normalize`. */
const NUMBER_WORDS: Record<string, number> = {
  // English
  ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  // French
  dix: 10, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, cents: 100,
  // Arabic and Darija
  عشره: 10, عشرين: 20, ثلاثين: 30, تلاتين: 30, تلاثين: 30, اربعين: 40, ربعين: 40, خمسين: 50, ستين: 60, سبعين: 70, ثمانين: 80, تمانين: 80, تسعين: 90,
  ميه: 100, مايه: 100, ماه: 100, مئه: 100, مية: 100, ميتين: 200, مييتين: 200, مئتين: 200, مائتين: 200,
  // Arabizi
  achra: 10, '3achra': 10, achrin: 20, '3achrin': 20, tlatin: 30, rb3in: 40, khamsin: 50, mya: 100, myatin: 200,
};
/** Hundreds said as one word: «تلتمية», «خمسمية», «trois cents»… */
const HUNDREDS: [RegExp, number][] = [
  [/(تلت|ثلاث|تلاث)ميه|(تلت|ثلاث)مايه|ثلاثمائه/, 300],
  [/(ربع|اربع)ميه|(ربع|اربع)مايه|اربعمائه/, 400],
  [/خمس ?ميه|خمس ?مايه|خمسمائه/, 500],
  [/ست ?ميه|ستمائه/, 600],
  [/سبع ?ميه|سبعمائه/, 700],
  [/تمن ?ميه|ثمن ?ميه|ثمانمائه/, 800],
  [/تسع ?ميه|تسعمائه/, 900],
  [/\b(deux|two) (cents?|hundred)\b/, 200],
  [/\b(trois|three) (cents?|hundred)\b/, 300],
  [/\b(quatre|four) (cents?|hundred)\b/, 400],
  [/\b(cinq|five) (cents?|hundred)\b/, 500],
  [/\b(six) (cents?|hundred)\b/, 600],
  [/\b(sept|seven) (cents?|hundred)\b/, 700],
  [/\b(huit|eight) (cents?|hundred)\b/, 800],
  [/\b(neuf|nine) (cents?|hundred)\b/, 900],
  [/\bmille\b|\bthousand\b|الف\b|الاف/, 1000],
];

/** The amount said, if any: digits first, then hundreds and number words added up ("مية و خمسين" = 150). */
export function numberIn(text: string): number | undefined {
  const t = normalize(text);
  const digits = t.match(/\d+/);
  if (digits) return parseInt(digits[0], 10);
  let total = 0;
  let rest = t;
  for (const [re, v] of HUNDREDS) {
    if (re.test(rest)) {
      total += v;
      rest = rest.replace(re, ' ');
      break;
    }
  }
  for (const w of rest.split(' ')) {
    const word = w.replace(/^و/, '');
    if (NUMBER_WORDS[word] !== undefined) total += NUMBER_WORDS[word];
  }
  return total || undefined;
}

const has = (t: string, words: string[]) => words.some((w) => (w.includes(' ') ? t.includes(w) : new RegExp(`(^|\\s)${w}($|\\s)`).test(t)));
const starts = (t: string, words: string[]) => words.some((w) => new RegExp(`(^|\\s)${w}`).test(t));

// Each list is matched after `normalize` (so «أقبل» is written «اقبل» here).
const W = {
  stop: ['stop', 'silence', 'quiet', 'arrete', 'tais toi', 'سكت', 'اسكت', 'بركا', 'safi', 'skt', 'توقف'],
  help: ['help', 'what can i say', 'aide', 'que dire', 'مساعده', 'عاوني', 'عاونى', 'شنو نقدر نقول', 'chno ngol', 'شنو نقول'],
  list: ['offers', 'offer', 'loads', 'load', 'jobs', 'what s new', 'whats new', 'list', 'read', 'demandes', 'offres', 'charges', 'missions', 'quoi de neuf', 'العروض', 'عروض', 'الطلبات', 'طلبات', 'الحمولات', 'شنو كاين', 'اش كاين', 'واش كاين', 'شو كاين', 'chno kayn', 'ach kayn', 'chnou kayn', 'wach kayn', 'كاين شي', 'اقرا'],
  next: ['next', 'another', 'suivant', 'suivante', 'autre', 'التالي', 'الموالي', 'اللي موراه', 'من بعد', 'لخر', 'الاخر', 'واحد اخر', 'jaya', 'lmowali', 'التاليه'],
  repeat: ['repeat', 'again', 'say again', 'repete', 'encore', 'عاود', 'كرر', 'اعد', 'عاودها', 'aawd', '3awd'],
  accept: ['accept', 'accepted', 'take it', 'i take it', 'i ll take it', 'yes take', 'book it', 'accepte', 'accepter', 'j accepte', 'je prends', 'je le prends', 'قبل', 'اقبل', 'قبلت', 'نقبل', 'موافق', 'واخا نقبل', 'غادي ناخدها', 'ناخدها', 'خديتها', 'نديها', 'ndiha', 'nakhodha', 'qbel', 'nqbel'],
  decline: ['decline', 'refuse', 'reject', 'skip', 'pass', 'no thanks', 'not interested', 'refuser', 'je refuse', 'passer', 'non merci', 'رفض', 'نرفض', 'ارفض', 'ما بغيتش', 'مابغيتش', 'ماشي هادي', 'دوز', 'خليها', 'لا شكرا', 'mabghitch', 'douz', 'khliha'],
  more: ['more', 'raise', 'increase', 'add', 'up', 'plus', 'augmente', 'ajoute', 'monte', 'زيد', 'زيدو', 'زيادة', 'زياده', 'زيد ف', 'اكثر', 'ارفع', 'طلع', 'zid'],
  less: ['less', 'lower', 'decrease', 'minus', 'down', 'reduce', 'moins', 'baisse', 'diminue', 'نقص', 'ناقص', 'قلل', 'نزل', 'نقصو', 'n9es', 'na9es', 'nqes'],
  yes: ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'oui', 'd accord', 'bien sur', 'نعم', 'اه', 'ايه', 'واخا', 'وخا', 'اكيد', 'صافي', 'wakha', 'ah', 'iyeh', 'oui oui'],
  no: ['no', 'nope', 'non', 'لا', 'لالا', 'لا لا', 'ماشي', 'la', 'lla'],
  // During a job these mean "I take this trip" (out of a job they accept a load).
  take: ['i take this trip', 'i take the trip', 'i take it', 'take it', 'i ll take it', 'confirm the trip', 'confirm', 'je confirme', 'je prends le trajet', 'je le prends', 'je prends', 'اكد الرحله', 'كنأكد', 'نأكد', 'ناكد', 'اكد', 'اخذها', 'ناخدها', 'غادي ناخدها', 'نديها', 'nakhodha', 'ndiha'],
  onway: ['on my way', 'leaving now', 'i m going', 'going now', 'en route', 'je pars', 'j y vais', 'في الطريق', 'فالطريق', 'انطلقت', 'غادي', 'راني جاي', 'جاي', 'مشيت', 'ghadi', 'jay', 'rani jay'],
  arrived: ['arrived', 'i m here', 'i am here', 'here', 'arrive', 'je suis arrive', 'je suis la', 'وصلت', 'راني وصلت', 'انا هنا', 'وصلنا', 'wselt', 'wsalt'],
  loaded: ['loaded', 'everything is loaded', 'charge', 'tout est charge', 'شحنت', 'حملت', 'تم التحميل', 'عمرت', 'سالينا التحميل', 'chrhnt', 'hmlt'],
  handed: ['handed over', 'delivered', 'done', 'livre', 'c est livre', 'remis', 'سلمت', 'سلمتها', 'تم التسليم', 'وصلتها', 'سالينا', 'slemt', 'salina'],
  online: ['go online', 'online', 'en ligne', 'متصل', 'شغل', 'خدام', 'khdam'],
  offline: ['go offline', 'offline', 'hors ligne', 'غير متصل', 'طفي', 'وقف الطلبات', 'mamkhdamch'],
};

/**
 * One command from the words heard. `context` changes the meaning of short words: while a question
 * waits (yes/no) "yes" answers it; during a job «وصلت» is "arrived".
 */
export function parseIntent(text: string, context: { awaitingYesNo?: boolean; onJob?: boolean } = {}): Intent {
  const t = normalize(text);
  if (!t) return { kind: 'unknown' };
  if (has(t, W.stop)) return { kind: 'stop' };
  if (context.awaitingYesNo) {
    if (has(t, W.no) && !has(t, W.yes)) return { kind: 'no' };
    if (has(t, W.yes) || has(t, W.accept)) return { kind: 'yes' };
  }
  const n = numberIn(t);
  // "more 50", «زيد 50», "plus cinquante"
  if (starts(t, W.more) || has(t, W.more)) return { kind: 'more', n };
  if (starts(t, W.less) || has(t, W.less)) return { kind: 'less', n };
  if (context.onJob) {
    if (has(t, W.take)) return { kind: 'take' };
    if (has(t, W.handed)) return { kind: 'handed' };
    if (has(t, W.loaded)) return { kind: 'loaded' };
    if (has(t, W.arrived)) return { kind: 'arrived' };
    if (has(t, W.onway)) return { kind: 'onway' };
  }
  if (has(t, W.decline)) return { kind: 'decline' };
  if (has(t, W.accept)) return { kind: 'accept' };
  if (has(t, W.next)) return { kind: 'next' };
  if (has(t, W.repeat)) return { kind: 'repeat' };
  if (has(t, W.offline)) return { kind: 'offline' };
  if (has(t, W.online)) return { kind: 'online' };
  if (has(t, W.help)) return { kind: 'help' };
  if (has(t, W.list)) return { kind: 'list' };
  // A price said alone: «بـ 300», "300 dirhams", "trois cents".
  if (n && n >= 20) return { kind: 'price', n };
  if (has(t, W.yes)) return { kind: 'yes' };
  if (has(t, W.no)) return { kind: 'no' };
  return { kind: 'unknown' };
}

import { placeById, VEHICLES, WEEK_TRIPS, type L3 } from './data';
import { isReturn, kgOf, myActiveTrip, myOffer, myTrips, onRoute, openLoads, type Req, type Stage, type State, type VoiceLang, type VoiceMsg } from './store';

/**
 * The driver's voice assistant brain: understands Darija, Arabic, French and English (also mixed,
 * as people really speak), answers in the chosen language, and never does anything involving money
 * or a booking without asking "yes / no" first.
 */

export type Intent =
  | { k: 'loads'; filter: 'all' | 'route' | 'near' | 'return' | 'shared'; to?: string[] }
  | { k: 'raise'; n: number | null; delta: number }
  | { k: 'status' }
  | { k: 'tripEarn'; n: number | null }
  | { k: 'read'; n: number | null }
  | { k: 'summary' }
  | { k: 'earnings' }
  | { k: 'accept'; n: number | null }
  | { k: 'counter'; n: number | null; price: number }
  | { k: 'stage'; stage: Stage }
  | { k: 'trip' }
  | { k: 'cancel' }
  | { k: 'online'; on: boolean }
  | { k: 'yes' }
  | { k: 'no' }
  | { k: 'help' };

/** Lowercase, no French accents, Arabic letters unified (أ إ آ → ا, ة → ه, ى → ي), Arabic digits → 0-9. */
export function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ٓ-ٕ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ٰٕ]/g, '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[?!.,؟،]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const has = (t: string, words: string[]) => words.some((w) => (/^[a-z0-9' ]+$/.test(w) ? new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(t) : t.includes(w)));

const ORD: [string[], number][] = [
  [['first', 'one', '1st', 'premier', 'premiere', 'un', 'الاول', 'اللول', 'لول', 'واحد', 'الاولى'], 1],
  [['second', 'two', '2nd', 'deuxieme', 'deux', 'second', 'الثاني', 'التاني', 'تاني', 'جوج', 'زوج', 'الثانيه'], 2],
  [['third', 'three', '3rd', 'troisieme', 'trois', 'الثالث', 'التالت', 'تالت', 'تلاته'], 3],
  [['fourth', 'four', '4th', 'quatrieme', 'quatre', 'الرابع', 'رابع', 'ربعه'], 4],
];
const ordinal = (t: string) => {
  for (const [w, n] of ORD) if (has(t, w)) return n;
  const m = t.match(/(?:number|numero|n°|رقم|نمره)\s*(\d)/);
  return m ? Number(m[1]) : null;
};
const money = (t: string) => {
  const m = t.match(/(\d{2,5})/);
  if (m) return Number(m[1]);
  const words: [string[], number][] = [[['مية', 'ميه', 'cent', 'hundred'], 100], [['ميتين', 'two hundred', 'deux cents'], 200], [['تلت مية', 'تلتميه', 'three hundred', 'trois cents'], 300], [['ربع مية', 'ربعميه', 'four hundred', 'quatre cents'], 400], [['خمسميه', 'خمس مية', 'five hundred', 'cinq cents'], 500]];
  let best = 0;
  for (const [w, n] of words) if (has(t, w)) best = Math.max(best, n);
  return best || null;
};

const TENS: [string[], number][] = [[['عشرين', 'twenty', 'vingt'], 20], [['تلاتين', 'ثلاثين', 'thirty', 'trente'], 30], [['ربعين', 'اربعين', 'forty', 'quarante'], 40], [['خمسين', 'fifty', 'cinquante'], 50], [['ستين', 'sixty', 'soixante'], 60], [['مية', 'ميه', 'hundred', 'cent'], 100]];
const delta = (t: string) => {
  const m = t.match(/(\d{1,4})/);
  if (m) return Number(m[1]);
  for (const [w, n] of TENS) if (has(t, w)) return n;
  return null;
};
/** Places the driver names ("to Temara", "back to Casa"). */
const ALIASES: [string[], string[]][] = [
  [['كازا', 'casa', 'casablanca', 'الدار البيضاء', 'البيضاء'], ['maarif', 'gauthier', 'ainsebaa', 'hayhassani', 'sidimaarouf', 'darbouazza']],
  [['تماره', 'temara'], ['temara']], [['الرباط', 'رباط', 'rabat'], ['rabat']], [['برشيد', 'berrechid'], ['berrechid']], [['مراكش', 'marrakech'], ['marrakech']],
  [['طنجه', 'tanger', 'tangier'], ['tangier']], [['اكادير', 'agadir'], ['agadir']], [['المحمديه', 'محمديه', 'mohammedia'], ['mohammedia']], [['فاس', 'fes'], ['fes']], [['الجديده', 'jadida'], ['eljadida']],
];
const placesIn = (t: string) => ALIASES.filter(([w]) => has(t, w)).flatMap(([, ids]) => ids);

const LOADW = ['load', 'loads', 'job', 'jobs', 'work', 'deliveries', 'anything', 'chargement', 'chargements', 'travail', 'course', 'courses', 'colis', 'سلعه', 'نقل', 'خدمه', 'طلب', 'طلبات', 'كاين شي', 'شي حاجه', 'كورسه', 'حموله', 'حمولات'];

export function parse(raw: string, pending: boolean): Intent {
  const t = norm(raw);
  if (pending) {
    if (has(t, ['yes', 'yeah', 'ok', 'okay', 'confirm', 'sure', 'do it', 'oui', 'ouais', 'vas y', 'daccord', "d'accord", 'confirme', 'ايه', 'اه', 'نعم', 'واخا', 'صافي', 'اكد', 'موافق', 'يالاه', 'ديرها'])) return { k: 'yes' };
    if (has(t, ['no', 'nope', 'cancel', 'stop', 'non', 'annule', 'لا', 'بلاش', 'لالا', 'خليها', 'سمح'])) return { k: 'no' };
  }
  if (has(t, ['offline', 'hors ligne', 'deconnecte', 'طفي', 'غير متصل'])) return { k: 'online', on: false };
  if (has(t, ['go online', 'online', 'en ligne', 'connecte', 'متصل', 'شعل'])) return { k: 'online', on: true };

  const loadish = has(t, LOADW);
  // trip stages (not when the driver is asking about loads: "any load on my way?")
  if (!loadish) {
  if (t.includes("j'arrive") || t.includes('j arrive')) return { k: 'stage', stage: 1 };
  if (has(t, ['delivered', 'dropped', 'livre', 'livraison faite', 'سلمت', 'وصلت السلعه', 'وصلتها', 'خويت', 'فرغت'])) return { k: 'stage', stage: 5 };
  if (has(t, ['loaded', 'charge', 'شحنت', 'حملت', 'عمرت', 'ركبت السلعه'])) return { k: 'stage', stage: 4 };
  if (has(t, ['start loading', 'commence le chargement', 'commencer', 'نبدا التحميل', 'بدا التحميل', 'نحمل'])) return { k: 'stage', stage: 3 };
  if (has(t, ['arrived', 'i am here', "i'm here", 'je suis arrive', 'je suis la', 'arrive', 'وصلت', 'راني هنا', 'انا هنا'])) return { k: 'stage', stage: 2 };
  if (has(t, ['on my way', 'leaving now', 'en route', 'je pars', 'راني جاي', 'جاي', 'خرجت', 'غادي نجي'])) return { k: 'stage', stage: 1 };
  }

  const n = ordinal(t);
  const price = money(t);
  if (has(t, ['الزبون قبل', 'قبل العرض', 'قبل ولا', 'accepted my', 'did the customer', 'customer answer', 'customer reply', 'a accepte mon', 'a repondu', 'le client a', 'جاوب', 'رد عليا', 'واش قبل'])) return { k: 'status' };
  if (has(t, ['زيد', 'add', 'raise', 'ajoute', 'augmente', 'rajoute', 'plus'])) { const dl = delta(t); if (dl) return { k: 'raise', n, delta: dl }; }
  if (has(t, ['earn', 'gagner', 'gagne', 'نربح', 'غادي نربح', 'شحال']) && has(t, ['هاد', 'هادي', 'this', 'ce trajet', 'cette course', 'ce chargement']) && !has(t, ['week', 'month', 'today', 'semaine', 'mois', 'aujourd', 'السيمانه', 'الشهر', 'اليوم', 'الاسبوع'])) return { k: 'tripEarn', n };
  if (has(t, ['cancel', 'withdraw', 'annule', 'retire', 'لغي', 'لغا', 'حيد العرض', 'بلاش العرض'])) return { k: 'cancel' };
  if (has(t, ['accept', 'take it', 'i take', 'i will take', "j'accepte", 'accepte', 'je prends', 'je la prends', 'قبل', 'نقبل', 'ناخد', 'ناخدها', 'خديتها', 'نديها', 'غادي نديها'])) return { k: 'accept', n };
  if (price && (has(t, ['offer', 'propose', 'price', 'counter', 'ask', 'for', 'dh', 'dirham', 'prix', 'proposer', 'contre', 'demande', 'درهم', 'دراهم', 'ثمن', 'نقترح', 'قترح', 'بغيت', 'عرض', 'قول ليه', 'صيفط']) || /^\d+$/.test(t))) return { k: 'counter', n, price };
  if (has(t, ['earn', 'earning', 'money', 'made', 'income', 'commission', 'gagne', 'gains', 'argent', 'combien', 'commission', 'شحال', 'ربحت', 'فلوس', 'مدخول', 'دخلت', 'العموله', 'الكوميسيون'])) return { k: 'earnings' };
  if (has(t, ['summary', 'summarize', 'my day', 'today', 'resume', 'resumer', 'ma journee', 'لخص', 'ملخص', 'النهار', 'اليوم ديالي', 'شنو عندي'])) return { k: 'summary' };
  if (has(t, ['read', 'details', 'tell me about', 'more about', 'lis', 'detail', 'details', 'parle moi', 'قرا', 'عاود', 'تفاصيل', 'شنو فيها', 'عطيني تفاصيل'])) return { k: 'read', n };
  if (has(t, ['booking', 'my trip', 'next trip', 'status', 'reservation', 'mon trajet', 'prochain', 'الرحله', 'الحجز', 'الرحله ديالي', 'فين وصلت'])) return { k: 'trip' };
  if (has(t, ['return', 'way back', 'retour', 'رجوع', 'الرجوع', 'راجع'])) return { k: 'loads', filter: 'return', to: placesIn(t).length ? placesIn(t) : undefined };
  if (has(t, ['on my way', 'on my route', 'my route', 'along', 'sur ma route', 'sur mon chemin', 'en chemin', 'فطريقي', 'فالطريق', 'طريقي'])) return { k: 'loads', filter: 'route' };
  if (has(t, ['near', 'nearby', 'close', 'around', 'proche', 'pres', 'autour', 'قريب', 'حدايا', 'هنا'])) return { k: 'loads', filter: 'near' };
  if (has(t, ['shared', 'partage', 'مشترك', 'مشتركه'])) return { k: 'loads', filter: 'shared' };
  const to = placesIn(t);
  if (loadish || has(t, ['search', 'find', 'cherche', 'trouve', 'قلب', 'وريني'])) return { k: 'loads', filter: 'all', to: to.length ? to : undefined };
  if (n) return { k: 'read', n };
  return { k: 'help' };
}

// ---------------- Replies ----------------
type V4 = { en: string; fr: string; da: string; msa: string };
export const say = (l: VoiceLang, v: V4) => (l === 'en' ? v.en : l === 'fr' ? v.fr : l === 'darija' ? v.da : v.msa);
const P = (l: VoiceLang, x: L3) => (l === 'en' ? x[0] : l === 'fr' ? x[1] : x[2]);
const ORDW: Record<VoiceLang, string[]> = {
  en: ['First', 'Second', 'Third', 'Fourth', 'Fifth'],
  fr: ['Premier', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième'],
  darija: ['اللول', 'التاني', 'التالت', 'الرابع', 'الخامس'],
  msa: ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'],
};

export function loadsFor(s: State, f: 'all' | 'route' | 'near' | 'return' | 'shared', to?: string[]) {
  const all = openLoads(s).filter((r) => !myOffer(s, r.id) && (!to || to.includes(r.to)));
  const list = f === 'route' ? all.filter((r) => onRoute(s, r)) : f === 'return' ? all.filter((r) => isReturn(s, r)) : f === 'near' ? all.filter((r) => placeById(r.from).cx !== undefined) : f === 'shared' ? all.filter((r) => r.shared) : all;
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

function describe(l: VoiceLang, r: Req, i?: number) {
  const a = P(l, placeById(r.from).name), b = P(l, placeById(r.to).name);
  const what = r.items.map((x) => `${x.qty > 1 ? x.qty + ' ' : ''}${P(l, x.name)}`).join(l === 'en' || l === 'fr' ? ', ' : '، ');
  const pre = i !== undefined ? ORDW[l][i] + ': ' : '';
  return say(l, {
    en: `${pre}${a} to ${b}, ${r.km} km. ${what}, about ${kgOf(r)} kg. ${P(l, r.when)}. The customer offers ${r.price} dirhams.`,
    fr: `${pre}${a} vers ${b}, ${r.km} km. ${what}, environ ${kgOf(r)} kg. ${P(l, r.when)}. Le client propose ${r.price} dirhams.`,
    da: `${pre}من ${a} لـ ${b}، ${r.km} كيلومتر. ${what}، تقريباً ${kgOf(r)} كيلو. ${P(l, r.when)}. الزبون عطا ${r.price} درهم.`,
    msa: `${pre}من ${a} إلى ${b}، ${r.km} كيلومتر. ${what}، حوالي ${kgOf(r)} كيلوغرام. ${P(l, r.when)}. يقترح الزبون ${r.price} درهم.`,
  });
}

export type Answer = { text: string; confirm?: VoiceMsg['confirm']; focus?: string | null; act?: { t: 'online'; on: boolean }; listIds?: string[] };

/** Works out the answer. `focus` is the load the driver last heard about ("accept it"). */
export function answer(s: State, intent: Intent, focus: string | null, lastList: string[]): Answer {
  const l = s.voiceLang;
  const pick = (n: number | null) => (n ? lastList[n - 1] ?? null : focus ?? lastList[0] ?? null);
  switch (intent.k) {
    case 'help':
      return { text: say(l, { en: 'I can find loads on your route, read one aloud, tell your earnings, or send an offer. Try: “any load on my way?”', fr: 'Je peux trouver des chargements sur votre route, en lire un, donner vos gains ou envoyer une offre. Essayez : « un chargement sur ma route ? »', da: 'نقدر نقلب ليك على السلعة فطريقك، نقرا ليك شي طلب، نقول ليك شحال ربحتي، ولا نصيفط عرض. جرّب: «واش كاين شي نقل فطريقي؟»', msa: 'يمكنني البحث عن الحمولات في طريقك، وقراءة طلب، وإخبارك بأرباحك، أو إرسال عرض. جرّب: «هل توجد حمولة في طريقي؟»' }) };
    case 'online':
      return { text: intent.on ? say(l, { en: 'You are online. Customers can see you.', fr: 'Vous êtes en ligne. Les clients vous voient.', da: 'راك متصل دابا. الزبناء كيشوفوك.', msa: 'أنت متصل الآن. يمكن للزبائن رؤيتك.' }) : say(l, { en: 'You are offline. No new loads until you go online.', fr: 'Vous êtes hors ligne. Plus de nouveaux chargements.', da: 'راك غير متصل. ما غاديش توصلك طلبات جديدة.', msa: 'أنت غير متصل. لن تصلك طلبات جديدة.' }), act: { t: 'online', on: intent.on } };
    case 'loads': {
      if (!s.driverOnline) return { text: say(l, { en: 'You are offline. Say “go online” first.', fr: 'Vous êtes hors ligne. Dites « en ligne » d’abord.', da: 'راك غير متصل. قول «شعل» الأول.', msa: 'أنت غير متصل. قل «متصل» أولاً.' }) };
      // "back to Casa": a load heading there counts even without an announced trip
      const list = intent.filter === 'return' && intent.to ? loadsFor(s, 'all', intent.to) : loadsFor(s, intent.filter, intent.to);
      if (!list.length) return { text: say(l, { en: 'Nothing like that right now. I will tell you when one comes.', fr: 'Rien pour le moment. Je vous préviens dès qu’il y en a un.', da: 'ما كاين والو دابا. غادي نعلمك ملي يجي شي واحد.', msa: 'لا يوجد شيء الآن. سأخبرك عند وصول طلب.' }), focus: null };
      const top = list.slice(0, 3);
      const head = say(l, {
        en: `${list.length} load${list.length > 1 ? 's' : ''}${intent.filter === 'route' ? ' on your route' : intent.filter === 'return' ? ' for your return' : intent.filter === 'near' ? ' near you' : ''}. `,
        fr: `${list.length} chargement${list.length > 1 ? 's' : ''}${intent.filter === 'route' ? ' sur votre route' : intent.filter === 'return' ? ' pour le retour' : intent.filter === 'near' ? ' près de vous' : ''}. `,
        da: `${list.length > 1 ? `كاين ${list.length} طلبات` : 'كاين طلب واحد'}${intent.filter === 'route' ? ' فطريقك' : intent.filter === 'return' ? ' فالرجوع' : intent.filter === 'near' ? ' قراب ليك' : ''}. `,
        msa: `${list.length > 1 ? `توجد ${list.length} طلبات` : 'يوجد طلب واحد'}${intent.filter === 'route' ? ' في طريقك' : intent.filter === 'return' ? ' في طريق العودة' : intent.filter === 'near' ? ' قريبة منك' : ''}. `,
      });
      const lines = top.map((r, i) => `${ORDW[l][i]}: ${P(l, placeById(r.from).name)} → ${P(l, placeById(r.to).name)}${l === 'en' || l === 'fr' ? ', ' + r.price + ' DH' : '، ' + r.price + ' درهم'}`).join('. ');
      const tail = say(l, { en: ' Say “read the first” or “accept the first”.', fr: ' Dites « lis le premier » ou « j’accepte le premier ».', da: ' قول «قرا اللول» ولا «نقبل اللول».', msa: ' قل «اقرأ الأول» أو «أقبل الأول».' });
      return { text: head + lines + '.' + tail, focus: top[0].id, listIds: top.map((r) => r.id) };
    }
    case 'read': {
      const id = pick(intent.n);
      const r = id && s.reqs.find((x) => x.id === id);
      if (!r) return { text: say(l, { en: 'Which load? Ask me “any loads?” first.', fr: 'Quel chargement ? Demandez « des chargements ? » d’abord.', da: 'أشمن طلب؟ سولني «واش كاين شي نقل؟» الأول.', msa: 'أي طلب؟ اسألني «هل توجد حمولات؟» أولاً.' }) };
      const ix = lastList.indexOf(r.id);
      const extra = say(l, {
        en: `${r.helpers ? ` ${r.helpers} helper${r.helpers > 1 ? 's' : ''} needed.` : ''}${r.floors.pickup.floor ? ` Floor ${r.floors.pickup.floor}${r.floors.pickup.lift === 'no' ? ', no lift' : ''}.` : ''} Accept, or name your price?`,
        fr: `${r.helpers ? ` ${r.helpers} aide${r.helpers > 1 ? 's' : ''} demandé${r.helpers > 1 ? 's' : ''}.` : ''}${r.floors.pickup.floor ? ` ${r.floors.pickup.floor}e étage${r.floors.pickup.lift === 'no' ? ', sans ascenseur' : ''}.` : ''} Vous acceptez ou vous proposez un prix ?`,
        da: `${r.helpers ? ` خاص ${r.helpers} ديال المساعدين.` : ''}${r.floors.pickup.floor ? ` الطابق ${r.floors.pickup.floor}${r.floors.pickup.lift === 'no' ? '، بلا مصعد' : ''}.` : ''} تقبل ولا تقول الثمن ديالك؟`,
        msa: `${r.helpers ? ` مطلوب ${r.helpers} مساعد.` : ''}${r.floors.pickup.floor ? ` الطابق ${r.floors.pickup.floor}${r.floors.pickup.lift === 'no' ? '، بدون مصعد' : ''}.` : ''} هل تقبل أم تقترح ثمنك؟`,
      });
      return { text: describe(l, r, ix >= 0 ? ix : undefined) + extra, focus: r.id };
    }
    case 'accept': {
      const id = pick(intent.n);
      const r = id && s.reqs.find((x) => x.id === id);
      const mo = r ? myOffer(s, r.id) : undefined;
      if (r && mo && mo.awaiting === 'driver') {
        const rt = `${P(l, placeById(r.from).name)} → ${P(l, placeById(r.to).name)}`;
        return { focus: r.id, text: say(l, { en: `Accept the customer's ${mo.price} dirhams for ${rt}? Yes or no?`, fr: `Accepter les ${mo.price} dirhams du client pour ${rt} ? Oui ou non ?`, da: `نقبلو ${mo.price} درهم ديال الزبون على ${rt}؟ إيه ولا لا؟`, msa: `هل تقبل ${mo.price} درهم من الزبون لـ ${rt}؟ نعم أم لا؟` }), confirm: { kind: 'accept', reqId: r.id, price: mo.price, label: `${rt} · ${mo.price} DH` } };
      }
      if (!r || r.status !== 'open') return { text: say(l, { en: 'Which load? Ask me for loads first.', fr: 'Quel chargement ? Demandez-moi d’abord.', da: 'أشمن طلب؟ سولني على الطلبات الأول.', msa: 'أي طلب؟ اسألني عن الطلبات أولاً.' }) };
      const route = `${P(l, placeById(r.from).name)} → ${P(l, placeById(r.to).name)}`;
      return {
        focus: r.id,
        text: say(l, { en: `Accept ${route} for ${r.price} dirhams? Say yes or no.`, fr: `Accepter ${route} pour ${r.price} dirhams ? Dites oui ou non.`, da: `نقبلو ${route} بـ ${r.price} درهم؟ قول إيه ولا لا.`, msa: `هل تقبل ${route} بـ ${r.price} درهم؟ قل نعم أو لا.` }),
        confirm: { kind: 'accept', reqId: r.id, price: r.price, label: `${route} · ${r.price} DH` },
      };
    }
    case 'counter': {
      const id = pick(intent.n);
      const r = id && s.reqs.find((x) => x.id === id);
      if (!r || r.status !== 'open') return { text: say(l, { en: 'For which load? Ask me for loads first.', fr: 'Pour quel chargement ? Demandez-moi d’abord.', da: 'على أشمن طلب؟ سولني على الطلبات الأول.', msa: 'لأي طلب؟ اسألني عن الطلبات أولاً.' }) };
      const route = `${P(l, placeById(r.from).name)} → ${P(l, placeById(r.to).name)}`;
      const net = Math.round(intent.price * (1 - s.commission));
      return {
        focus: r.id,
        text: say(l, { en: `Send ${intent.price} dirhams for ${route}? You keep about ${net}. Yes or no?`, fr: `Envoyer ${intent.price} dirhams pour ${route} ? Il vous reste environ ${net}. Oui ou non ?`, da: `نصيفطو ${intent.price} درهم على ${route}؟ غادي يبقى ليك تقريباً ${net}. إيه ولا لا؟`, msa: `هل أرسل ${intent.price} درهم لـ ${route}؟ يبقى لك حوالي ${net}. نعم أم لا؟` }),
        confirm: { kind: 'counter', reqId: r.id, price: intent.price, label: `${route} · ${intent.price} DH` },
      };
    }
    case 'raise': {
      const id = pick(intent.n);
      const r = id && s.reqs.find((x) => x.id === id);
      if (!r) return answer(s, { k: 'counter', n: intent.n, price: 0 }, focus, lastList);
      const base = myOffer(s, r.id)?.price ?? r.price;
      return answer(s, { k: 'counter', n: intent.n, price: base + intent.delta }, focus, lastList);
    }
    case 'tripEarn': {
      const id = pick(intent.n) ?? myActiveTrip(s)?.id ?? null;
      const r = id && s.reqs.find((x) => x.id === id);
      if (!r) return { text: say(l, { en: 'Which trip? Ask me for loads first.', fr: 'Quel trajet ? Demandez-moi d’abord.', da: 'أشمن رحلة؟ سولني على الطلبات الأول.', msa: 'أي رحلة؟ اسألني عن الطلبات أولاً.' }) };
      const price = r.booked?.price ?? myOffer(s, r.id)?.price ?? r.price;
      const fee = Math.round(price * s.commission);
      return { focus: r.id, text: say(l, { en: `For ${price} dirhams cash, Xapp's ${Math.round(s.commission * 100)}% is ${fee}. You keep ${price - fee} dirhams, about ${r.km} km.`, fr: `Pour ${price} dirhams en espèces, la commission Xapp de ${Math.round(s.commission * 100)} % fait ${fee}. Il vous reste ${price - fee} dirhams, pour environ ${r.km} km.`, da: `على ${price} درهم كاش، العمولة ديال Xapp ${Math.round(s.commission * 100)}% هي ${fee}. كيبقى ليك ${price - fee} درهم، فـ ${r.km} كيلومتر تقريباً.`, msa: `مقابل ${price} درهم نقداً، عمولة Xapp بنسبة ${Math.round(s.commission * 100)}% هي ${fee}. يبقى لك ${price - fee} درهم، لمسافة ${r.km} كيلومتر تقريباً.` }) };
    }
    case 'status': {
      const mine = s.offers.filter((o) => o.driverId === 'me' && o.reqId !== 'B1').sort((a, b) => b.at - a.at);
      const o = mine[0];
      if (!o) return { text: say(l, { en: 'You have not sent any offer yet.', fr: 'Vous n’avez encore envoyé aucune offre.', da: 'باقي ما صيفطتي حتى عرض.', msa: 'لم ترسل أي عرض بعد.' }) };
      const r = s.reqs.find((x) => x.id === o.reqId)!;
      const route = `${P(l, placeById(r.from).name)} → ${P(l, placeById(r.to).name)}`;
      if (o.status === 'accepted') return { focus: r.id, text: say(l, { en: `Yes! ${route} is booked at ${o.price} dirhams.`, fr: `Oui ! ${route} est réservé à ${o.price} dirhams.`, da: `إيه! ${route} تحجز بـ ${o.price} درهم.`, msa: `نعم! تم حجز ${route} بـ ${o.price} درهم.` }) };
      if (o.status === 'declined') return { text: say(l, { en: `${route}: the customer chose another driver.`, fr: `${route} : le client a choisi un autre chauffeur.`, da: `${route}: الزبون ختار شيفور آخر.`, msa: `${route}: اختار الزبون سائقاً آخر.` }) };
      if (o.awaiting === 'driver') return { focus: r.id, text: say(l, { en: `The customer proposes ${o.price} dirhams for ${route}. Say “accept” or name your price.`, fr: `Le client propose ${o.price} dirhams pour ${route}. Dites « j’accepte » ou donnez votre prix.`, da: `الزبون كيقترح ${o.price} درهم على ${route}. قول «نقبل» ولا قول الثمن ديالك.`, msa: `يقترح الزبون ${o.price} درهم لـ ${route}. قل «أقبل» أو اقترح ثمنك.` }) };
      return { focus: r.id, text: say(l, { en: `Not yet. Your ${o.price} dirham offer for ${route} is waiting. I will tell you.`, fr: `Pas encore. Votre offre de ${o.price} dirhams pour ${route} attend. Je vous préviens.`, da: `باقي. العرض ديالك ديال ${o.price} درهم على ${route} كيتسنى. غادي نعلمك.`, msa: `ليس بعد. عرضك بـ ${o.price} درهم لـ ${route} قيد الانتظار. سأخبرك.` }) };
    }
    case 'cancel': {
      const o = s.offers.find((x) => x.driverId === 'me' && (x.status === 'pending' || x.status === 'countered'));
      if (!o) return { text: say(l, { en: 'You have no offer waiting to cancel.', fr: 'Aucune offre en attente à annuler.', da: 'ما عندك حتى عرض كيتسنى باش تلغيه.', msa: 'ليس لديك عرض معلق لإلغائه.' }) };
      const r = s.reqs.find((x) => x.id === o.reqId)!;
      const route = `${P(l, placeById(r.from).name)} → ${P(l, placeById(r.to).name)}`;
      return { text: say(l, { en: `Withdraw your ${o.price} dirham offer for ${route}? Yes or no?`, fr: `Retirer votre offre de ${o.price} dirhams pour ${route} ? Oui ou non ?`, da: `نحيدو العرض ديالك ديال ${o.price} درهم على ${route}؟ إيه ولا لا؟`, msa: `هل تسحب عرضك بـ ${o.price} درهم لـ ${route}؟ نعم أم لا؟` }), confirm: { kind: 'cancel', reqId: r.id, price: o.price, label: `${route} · ${o.price} DH` } };
    }
    case 'stage': {
      const trip = myActiveTrip(s);
      if (!trip) return { text: say(l, { en: 'You have no active trip right now.', fr: 'Aucun trajet en cours.', da: 'ما عندك حتى رحلة جارية دابا.', msa: 'ليست لديك رحلة جارية الآن.' }) };
      const want = intent.stage;
      if (want !== trip.stage + 1) {
        const next = (trip.stage + 1) as Stage;
        return { text: say(l, { en: `Next step is “${STG.en[next]}”.`, fr: `L’étape suivante est « ${STG.fr[next]} ».`, da: `الخطوة الجاية هي «${STG.darija[next]}».`, msa: `الخطوة التالية هي «${STG.msa[next]}».` }) };
      }
      return { text: say(l, { en: `Mark “${STG.en[want]}”? The customer will be told. Yes or no?`, fr: `Marquer « ${STG.fr[want]} » ? Le client sera prévenu. Oui ou non ?`, da: `نديرو «${STG.darija[want]}»؟ الزبون غادي يتعلم. إيه ولا لا؟`, msa: `هل أسجل «${STG.msa[want]}»؟ سيتم إبلاغ الزبون. نعم أم لا؟` }), confirm: { kind: 'stage', reqId: trip.id, stage: want, label: STG[l][want] } };
    }
    case 'trip': {
      const trip = myActiveTrip(s);
      if (!trip) return { text: say(l, { en: 'No active trip. Want me to look for loads?', fr: 'Aucun trajet en cours. Je cherche des chargements ?', da: 'ما كاين حتى رحلة. نقلب ليك على شي طلب؟', msa: 'لا توجد رحلة جارية. هل أبحث لك عن حمولات؟' }) };
      const route = `${P(l, placeById(trip.from).name)} → ${P(l, placeById(trip.to).name)}`;
      return { text: say(l, { en: `Your trip: ${route}, ${P(l, trip.when)}, ${trip.booked!.price} dirhams cash. Now: ${STG.en[trip.stage]}.`, fr: `Votre trajet : ${route}, ${P(l, trip.when)}, ${trip.booked!.price} dirhams en espèces. Étape : ${STG.fr[trip.stage]}.`, da: `الرحلة ديالك: ${route}، ${P(l, trip.when)}، ${trip.booked!.price} درهم كاش. دابا: ${STG.darija[trip.stage]}.`, msa: `رحلتك: ${route}، ${P(l, trip.when)}، ${trip.booked!.price} درهم نقداً. الآن: ${STG.msa[trip.stage]}.` }) };
    }
    case 'earnings': {
      const e = earnings(s);
      const pct = Math.round(s.commission * 100);
      return { text: say(l, { en: `Today ${e.today} dirhams. This week ${e.week} dirhams collected in cash, ${e.trips} trips. Xapp commission at ${pct}% is ${e.fee}; you keep ${e.week - e.fee}.`, fr: `Aujourd’hui ${e.today} dirhams. Cette semaine ${e.week} dirhams encaissés, ${e.trips} trajets. Commission Xapp à ${pct} % : ${e.fee} ; il vous reste ${e.week - e.fee}.`, da: `اليوم ${e.today} درهم. هاد السيمانة ${e.week} درهم كاش، ${e.trips} رحلات. العمولة ديال Xapp ${pct}% هي ${e.fee}، كيبقى ليك ${e.week - e.fee}.`, msa: `اليوم ${e.today} درهم. هذا الأسبوع ${e.week} درهم نقداً، ${e.trips} رحلات. عمولة Xapp بنسبة ${pct}% هي ${e.fee}، ويبقى لك ${e.week - e.fee}.` }) };
    }
    case 'summary': {
      const e = earnings(s);
      const trip = myActiveTrip(s);
      const route = loadsFor(s, 'route').length;
      const waiting = s.offers.filter((o) => o.driverId === 'me' && (o.status === 'pending' || o.status === 'countered')).length;
      const tr = trip ? `${P(l, placeById(trip.from).name)} → ${P(l, placeById(trip.to).name)} ${P(l, trip.when)}` : '';
      return { text: say(l, { en: `${trip ? `Next trip: ${tr}. ` : 'No trip booked. '}${route} loads fit your route, ${waiting} offer${waiting === 1 ? '' : 's'} waiting. Today ${e.today} dirhams.`, fr: `${trip ? `Prochain trajet : ${tr}. ` : 'Aucun trajet réservé. '}${route} chargements sur votre route, ${waiting} offre${waiting > 1 ? 's' : ''} en attente. Aujourd’hui ${e.today} dirhams.`, da: `${trip ? `الرحلة الجاية: ${tr}. ` : 'ما عندك حتى رحلة. '}كاين ${route} طلبات فطريقك، و${waiting} عروض كيتسناو. اليوم ${e.today} درهم.`, msa: `${trip ? `الرحلة القادمة: ${tr}. ` : 'لا توجد رحلة محجوزة. '}توجد ${route} طلبات في طريقك، و${waiting} عروض معلقة. اليوم ${e.today} درهم.` }) };
    }
    default:
      return { text: '' };
  }
}

const STG: Record<VoiceLang, string[]> = {
  en: ['Booked', 'On my way', 'Arrived', 'Loading', 'On the way', 'Delivered'],
  fr: ['Réservé', 'En route', 'Arrivé', 'Chargement', 'En route vers la livraison', 'Livré'],
  darija: ['محجوز', 'راني جاي', 'وصلت', 'كنحمّل', 'فالطريق', 'سلّمت'],
  msa: ['محجوز', 'في الطريق إليك', 'وصلت', 'جارٍ التحميل', 'في الطريق', 'تم التسليم'],
};

export function earnings(s: State) {
  const done = myTrips(s).filter((r) => r.status === 'delivered' && r.stageAt > Date.now() - 86400000);
  const today = done.reduce((n, r) => n + r.booked!.price, 0);
  const week = WEEK_TRIPS.reduce((n, x) => n + x.gross, 0) + today;
  const trips = WEEK_TRIPS.length + done.length;
  return { today, todayTrips: done.length, week, trips, fee: Math.round(week * s.commission) };
}

export const vehicleName = (l: VoiceLang, id: keyof typeof VEHICLES) => P(l, VEHICLES[id].name);

/** Spoken language for each choice (Darija and Arabic both use the Arabic voice). */
export const speechLang = (l: VoiceLang) => (l === 'en' ? 'en' : l === 'fr' ? 'fr' : 'ar') as 'en' | 'fr' | 'ar';

export const SUGGEST: Record<VoiceLang, string[]> = {
  en: ['Any load on my way?', 'Read the first one', 'Accept the first', 'Offer 400 dirhams', 'How much did I earn this week?', 'Summarize my day', "I've arrived"],
  fr: ['Un chargement sur ma route ?', 'Lis le premier', "J'accepte le premier", 'Propose 400 dirhams', "Combien j'ai gagné cette semaine ?", 'Résume ma journée', 'Je suis arrivé'],
  darija: ['واش كاين شي نقل فطريقي؟', 'قرا اللول', 'نقبل اللول', 'قترح 400 درهم', 'شحال ربحت هاد السيمانة؟', 'لخص ليا النهار', 'وصلت'],
  msa: ['هل توجد حمولة في طريقي؟', 'اقرأ الأول', 'أقبل الأول', 'اقترح 400 درهم', 'كم ربحت هذا الأسبوع؟', 'لخص يومي', 'وصلت'],
};
export const LANG_LABEL: Record<VoiceLang, string> = { darija: 'الدارجة', msa: 'العربية', fr: 'Français', en: 'English' };

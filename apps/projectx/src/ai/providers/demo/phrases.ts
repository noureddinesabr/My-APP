import type { Lang } from '../../../models/booking';

/** Demo-mode wording in the four supported languages (Darija in Arabic letters). */
export type P = { en: string; fr: string; ar: string; da: string };
export const say = (l: Lang, p: P, vars: Record<string, string | number> = {}) => {
  let s = l === 'darija' ? p.da : l === 'ar' ? p.ar : p[l];
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
};
export const list = (l: Lang, parts: string[]) => {
  if (parts.length <= 1) return parts.join('');
  const and = l === 'en' ? ' and ' : l === 'fr' ? ' et ' : ' و';
  const sep = l === 'darija' || l === 'ar' ? '، ' : ', ';
  return parts.slice(0, -1).join(sep) + and + parts[parts.length - 1];
};

export const PH = {
  greet: { en: 'Hello! I’m X, your transport assistant.', fr: 'Bonjour ! Je suis X, votre assistant transport.', ar: 'مرحباً! أنا X، مساعدك في النقل.', da: 'السلام! أنا X، المساعد ديالك فالنقل.' },
  askCargo: { en: 'What would you like to transport? You can describe it, say it, or send a photo.', fr: 'Que souhaitez-vous transporter ? Décrivez-le, dites-le ou envoyez une photo.', ar: 'ماذا تريد أن تنقل؟ يمكنك وصفه أو قوله أو إرسال صورة.', da: 'شنو بغيتي تنقل؟ وصفو ليا، قولو، ولا صيفط تصويرة.' },
  sawPhoto: { en: 'I can see {items} in your photo.', fr: 'Je vois {items} sur votre photo.', ar: 'أرى في صورتك {items}.', da: 'كنشوف فالتصويرة {items}.' },
  sawMany: { en: 'From your photos I can see {items}.', fr: 'Sur vos photos, je vois {items}.', ar: 'في صورك أرى {items}.', da: 'فالتصاور ديالك كنشوف {items}.' },
  cantSee: {
    en: 'I’m in demo mode, so I can’t actually look at your photo. Could you tell me what’s in it?',
    fr: 'Je suis en mode démo, je ne peux donc pas vraiment voir votre photo. Pouvez-vous me dire ce qu’elle montre ?',
    ar: 'أنا في وضع العرض التجريبي، لذا لا أستطيع رؤية صورتك فعلاً. هل يمكنك إخباري بما فيها؟',
    da: 'أنا فوضع تجريبي، ما نقدرش نشوف التصويرة بصح. قول ليا شنو فيها؟',
  },
  onlyThese: { en: 'Is that everything you’re moving?', fr: 'Est-ce tout ce que vous transportez ?', ar: 'هل هذا كل ما تريد نقله؟', da: 'واش هادشي كلشي اللي غادي تنقل؟' },
  onlyThis: { en: 'Is this the only item you’re moving?', fr: 'Est-ce le seul objet à transporter ?', ar: 'هل هذه القطعة الوحيدة التي تريد نقلها؟', da: 'واش غير هادي اللي غادي تنقل؟' },
  whatElse: { en: 'Sure — what else should I add?', fr: 'D’accord — que dois-je ajouter ?', ar: 'حسناً — ماذا أضيف أيضاً؟', da: 'واخا — شنو نزيد؟' },
  askPickup: { en: 'Where should we pick it up?', fr: 'Où devons-nous le récupérer ?', ar: 'من أين نستلمه؟', da: 'منين غادي نهزوه؟' },
  askPickupMany: { en: 'Where should we pick them up?', fr: 'Où devons-nous les récupérer ?', ar: 'من أين نستلمها؟', da: 'منين غادي نهزوهم؟' },
  askDest: { en: 'And where would you like it delivered?', fr: 'Et où souhaitez-vous le faire livrer ?', ar: 'وإلى أين تريد توصيله؟', da: 'وفين بغيتي نوصلوه؟' },
  askDestMany: { en: 'And where would you like them delivered?', fr: 'Et où souhaitez-vous les faire livrer ?', ar: 'وإلى أين تريد توصيلها؟', da: 'وفين بغيتي نوصلوهم؟' },
  samePlace: { en: 'Pickup and delivery are both {p}. Is that right — a move within the same place?', fr: 'Le départ et l’arrivée sont tous deux {p}. C’est bien ça, un trajet au même endroit ?', ar: 'الاستلام والتوصيل كلاهما {p}. هل هذا صحيح؟', da: 'الاستلام والتوصيل بجوج ف{p}. واش هادشي صحيح؟' },
  sameCityOk: { en: 'Got it, a move within {p}. Which neighbourhood is the delivery in?', fr: 'Compris, un trajet dans {p}. Dans quel quartier se fait la livraison ?', ar: 'فهمت، نقل داخل {p}. في أي حي سيكون التوصيل؟', da: 'فهمت، داخل {p}. فأشمن حي غادي يكون التوصيل؟' },
  askWeight: { en: 'Do you know roughly how much {it} weighs, or should I use a typical estimate ({lo}–{hi} kg) to pick the right vehicle?', fr: 'Connaissez-vous à peu près le poids {it}, ou dois-je utiliser une estimation habituelle ({lo}–{hi} kg) pour choisir le bon véhicule ?', ar: 'هل تعرف وزن {it} تقريباً، أم أستخدم تقديراً معتاداً ({lo}–{hi} كغ) لاختيار المركبة المناسبة؟', da: 'واش كتعرف شحال كيوزن {it} تقريباً، ولا نستعمل تقدير عادي ({lo}–{hi} كيلو) باش نختارو الطوموبيل المناسبة؟' },
  askWeightFree: { en: 'Roughly how heavy is it all? A guess is fine.', fr: 'À peu près combien pèse l’ensemble ? Une estimation suffit.', ar: 'كم يزن الكل تقريباً؟ التقدير يكفي.', da: 'شحال كيوزن كلشي تقريباً؟ غير بالتقريب.' },
  askQuantity: { en: 'How much is there — number of bags, tons, or pallets?', fr: 'Quelle quantité — nombre de sacs, tonnes ou palettes ?', ar: 'ما الكمية — عدد الأكياس أو الأطنان أو المنصات؟', da: 'شحال كاين — شحال من شكارة، شحال من طن، ولا باليطات؟' },
  weightOdd: { en: '{w} kg seems {dir} for {it} — it’s usually {lo}–{hi} kg. Should I keep {w} kg?', fr: '{w} kg me semble {dir} pour {it} — c’est généralement {lo}–{hi} kg. Je garde {w} kg ?', ar: '{w} كغ يبدو {dir} بالنسبة لـ{it} — عادةً {lo}–{hi} كغ. هل أبقي {w} كغ؟', da: '{w} كيلو كتبان ليا {dir} ل{it} — عادة {lo}–{hi} كيلو. نخليو {w} كيلو؟' },
  light: { en: 'light', fr: 'léger', ar: 'قليلاً', da: 'خفيف' },
  heavy: { en: 'heavy', fr: 'lourd', ar: 'كثيراً', da: 'تقيل' },
  usingEstimate: { en: 'No problem — I’ll use about {w} kg as an estimate. The driver can confirm on site.', fr: 'Pas de souci — je compte environ {w} kg à titre d’estimation. Le chauffeur pourra confirmer sur place.', ar: 'لا مشكلة — سأعتمد تقريباً {w} كغ كتقدير. يمكن للسائق التأكد في المكان.', da: 'ماشي مشكل — غادي نحسب تقريباً {w} كيلو. الشيفور يقدر يتأكد فالبلاصة.' },
  askTemp: { en: 'Does it need to stay cold during transport (refrigerated truck)?', fr: 'Doit-il rester au froid pendant le transport (camion frigorifique) ?', ar: 'هل يجب أن يبقى مبرداً أثناء النقل (شاحنة مبردة)؟', da: 'واش خاصو يبقى بارد فالطريق (كاميو فريكو)؟' },
  askWhen: { en: 'When should the pickup be?', fr: 'Quand souhaitez-vous l’enlèvement ?', ar: 'متى تريد موعد الاستلام؟', da: 'إمتى بغيتي يكون الاستلام؟' },
  askTime: { en: 'What time works best on {d}?', fr: 'Quelle heure vous convient le {d} ?', ar: 'ما الوقت المناسب يوم {d}؟', da: 'شمن ساعة مناسبة ليك {d}؟' },
  askHelp: { en: 'Will you need help loading or unloading?', fr: 'Aurez-vous besoin d’aide pour charger ou décharger ?', ar: 'هل تحتاج مساعدة في التحميل أو التفريغ؟', da: 'واش محتاج شي حد يعاونك فالتحميل ولا التفريغ؟' },
  askHelpers: { en: 'How many helpers would you like? For about {w} kg I’d suggest {n}.', fr: 'Combien de manutentionnaires souhaitez-vous ? Pour environ {w} kg, je conseille {n}.', ar: 'كم مساعداً تريد؟ لحوالي {w} كغ أقترح {n}.', da: 'شحال من واحد بغيتي يعاونك؟ ل{w} كيلو تقريباً كنقترح {n}.' },
  askFloorP: { en: 'Which floor is the pickup on, and is there an elevator?', fr: 'À quel étage se trouve le départ, et y a-t-il un ascenseur ?', ar: 'في أي طابق مكان الاستلام، وهل يوجد مصعد؟', da: 'فأشمن طابق الاستلام، وواش كاين السانسور؟' },
  askFloorD: { en: 'And at the delivery address — which floor, and is there an elevator?', fr: 'Et à l’arrivée — quel étage, et y a-t-il un ascenseur ?', ar: 'وفي عنوان التوصيل — أي طابق، وهل يوجد مصعد؟', da: 'وفين غادي نوصلو — أشمن طابق، وواش كاين السانسور؟' },
  askElev: { en: 'Is there an elevator there?', fr: 'Y a-t-il un ascenseur ?', ar: 'هل يوجد مصعد؟', da: 'واش كاين السانسور؟' },
  stairsWarn: { en: 'Heads-up: {w} kg up {f} floors without an elevator is hard work — I’d add at least {n} helpers. Shall I?', fr: 'À noter : {w} kg sur {f} étages sans ascenseur, c’est éprouvant — je conseille au moins {n} manutentionnaires. Je les ajoute ?', ar: 'تنبيه: {w} كغ إلى الطابق {f} بلا مصعد عمل شاق — أنصح بـ{n} مساعدين على الأقل. هل أضيفهم؟', da: 'رد البال: {w} كيلو ف{f} طوابق بلا سانسور صعيبة — كنقترح على الأقل {n} ديال الناس يعاونو. نزيدهم؟' },
  askFragile: { en: 'Is anything fragile or does anything need special care?', fr: 'Y a-t-il quelque chose de fragile ou qui demande une attention particulière ?', ar: 'هل يوجد شيء قابل للكسر أو يحتاج عناية خاصة؟', da: 'واش كاين شي حاجة كتهرس ولا خاصها عناية؟' },
  fridgeUpright: { en: 'I’ll note that the refrigerator must travel upright.', fr: 'Je note que le réfrigérateur doit voyager debout.', ar: 'سأسجل أن الثلاجة يجب أن تُنقل واقفة.', da: 'غادي نكتب بلي التلاجة خاصها تمشي واقفة.' },
  askPassengers: { en: 'Will you or someone else ride along with the cargo?', fr: 'Vous ou quelqu’un d’autre accompagnerez-vous le chargement ?', ar: 'هل سترافق الشحنة أنت أو شخص آخر؟', da: 'واش غادي تمشي مع السلعة نتا ولا شي حد آخر؟' },
  paxLimit: { en: 'Most trucks seat at most {n} passenger(s), so drivers will see that request.', fr: 'La plupart des camions n’ont que {n} place(s) passager, les chauffeurs verront cette demande.', ar: 'معظم الشاحنات تتسع لـ{n} راكب فقط، وسيرى السائقون هذا الطلب.', da: 'أغلب الكاميوات فيهم غير {n} بلاصة، الشيفورات غادي يشوفو هاد الطلب.' },
  askSavings: { en: 'To lower the price, are you open to a shared vehicle (with other customers’ cargo) or a driver on a return trip? Both can take a bit longer.', fr: 'Pour réduire le prix, accepteriez-vous un véhicule partagé (avec d’autres clients) ou un chauffeur en trajet retour ? Cela peut prendre un peu plus de temps.', ar: 'لتخفيض السعر، هل تقبل مركبة مشتركة (مع شحنات أخرى) أو سائقاً في رحلة عودة؟ قد يستغرق ذلك وقتاً أطول قليلاً.', da: 'باش ينقص الثمن، واش تقبل طوموبيل مشتركة (مع سلعة ديال ناس آخرين) ولا شيفور راجع خاوي؟ يقدر ياخد شوية ديال الوقت كثر.' },
  askInstr: { en: 'Anything else the driver should know — access, parking, a code, a contact person?', fr: 'Autre chose que le chauffeur devrait savoir — accès, stationnement, digicode, personne à contacter ?', ar: 'هل هناك شيء آخر يجب أن يعرفه السائق — الدخول، الوقوف، رمز، شخص للتواصل؟', da: 'كاين شي حاجة خاص الشيفور يعرفها — الدخلة، الباركينغ، كود، شي واحد يتاصل بيه؟' },
  ready: { en: 'Perfect, I have everything I need. Here’s your request — check it, and I’ll find the right transport.', fr: 'Parfait, j’ai tout ce qu’il me faut. Voici votre demande — vérifiez-la et je trouve le bon transport.', ar: 'ممتاز، لدي كل ما أحتاجه. هذا طلبك — راجعه وسأجد النقل المناسب.', da: 'مزيان، عندي كلشي. هاهو الطلب ديالك — شوفو، ومن بعد نلقا ليك النقل المناسب.' },
  changed: { en: 'Got it — I changed {what} from {a} to {b}.', fr: 'C’est noté — j’ai changé {what} : {a} → {b}.', ar: 'تم — غيّرت {what} من {a} إلى {b}.', da: 'واخا — بدلت {what} من {a} ل{b}.' },
  noted: { en: 'Noted.', fr: 'C’est noté.', ar: 'تم التسجيل.', da: 'تسجل.' },
  sorry: { en: 'Sorry, I didn’t quite catch that.', fr: 'Pardon, je n’ai pas bien compris.', ar: 'عذراً، لم أفهم جيداً.', da: 'سمح ليا، ما فهمتش مزيان.' },
  whatPickup: { en: 'the pickup', fr: 'le départ', ar: 'مكان الاستلام', da: 'بلاصة الاستلام' },
  whatDest: { en: 'the delivery place', fr: 'la destination', ar: 'مكان التوصيل', da: 'بلاصة التوصيل' },
  whatWeight: { en: 'the weight', fr: 'le poids', ar: 'الوزن', da: 'الوزن' },
  whatWhen: { en: 'the pickup time', fr: 'l’horaire', ar: 'الموعد', da: 'الوقت' },
  whatHelpers: { en: 'the helpers', fr: 'les manutentionnaires', ar: 'عدد المساعدين', da: 'عدد اللي يعاونو' },
  addedItems: { en: 'Added {items}.', fr: 'J’ai ajouté {items}.', ar: 'أضفت {items}.', da: 'زدت {items}.' },
  removedItems: { en: 'Removed {items}.', fr: 'J’ai retiré {items}.', ar: 'حذفت {items}.', da: 'حيدت {items}.' },
  nowLabel: { en: 'as soon as possible', fr: 'dès que possible', ar: 'في أقرب وقت', da: 'دابا' },
  today: { en: 'today', fr: 'aujourd’hui', ar: 'اليوم', da: 'اليوم' },
  tomorrow: { en: 'tomorrow', fr: 'demain', ar: 'غداً', da: 'غدا' },
  // trip assistant
  tripStatus: { en: 'Your booking with {d} is at this step: {s}.', fr: 'Votre réservation avec {d} en est à : {s}.', ar: 'حجزك مع {d} في هذه المرحلة: {s}.', da: 'الحجز ديالك مع {d} وصل لهاد المرحلة: {s}.' },
  tripWhere: { en: 'Live GPS isn’t connected in this prototype, so I can’t see {d}’s exact position. The latest status is: {s}.', fr: 'Le GPS en direct n’est pas connecté dans ce prototype, je ne vois donc pas la position exacte de {d}. Dernier statut : {s}.', ar: 'تتبع GPS المباشر غير متصل في هذا النموذج، لذا لا أرى موقع {d} بدقة. آخر حالة: {s}.', da: 'الـGPS المباشر ماشي مربوط فهاد النسخة، ما نقدرش نشوف فين {d} بالضبط. آخر حالة: {s}.' },
  tripEta: { en: 'The driver’s estimate was pickup {p} and delivery around {e}. Current step: {s}.', fr: 'L’estimation du chauffeur : enlèvement {p}, livraison vers {e}. Étape actuelle : {s}.', ar: 'تقدير السائق: الاستلام {p} والتوصيل حوالي {e}. المرحلة الحالية: {s}.', da: 'التقدير ديال الشيفور: الاستلام {p} والتوصيل تقريباً {e}. المرحلة دابا: {s}.' },
  tripInstr: { en: 'Done — I added this to your pickup instructions and sent it to {d}: “{i}”.', fr: 'C’est fait — j’ai ajouté ceci aux instructions et l’ai envoyé à {d} : « {i} ».', ar: 'تم — أضفت هذا إلى التعليمات وأرسلته إلى {d}: «{i}».', da: 'تم — زدت هادشي فالتعليمات وصيفطتو ل{d}: «{i}».' },
  tripInstrAsk: { en: 'Sure. What should I tell the driver?', fr: 'Bien sûr. Que dois-je transmettre au chauffeur ?', ar: 'بالتأكيد. ماذا أبلغ السائق؟', da: 'واخا. شنو نقول للشيفور؟' },
  tripSupport: { en: 'I’ve opened a support request for this booking. In this prototype no human agent is connected, but in the real app our team would reply here. You can also message the driver directly.', fr: 'J’ai ouvert une demande d’assistance pour cette réservation. Dans ce prototype aucun agent n’est connecté, mais dans l’application réelle notre équipe répondrait ici. Vous pouvez aussi écrire au chauffeur.', ar: 'فتحت طلب دعم لهذا الحجز. في هذا النموذج لا يوجد موظف متصل، لكن في التطبيق الحقيقي سيرد فريقنا هنا. يمكنك أيضاً مراسلة السائق.', da: 'حليت طلب ديال الدعم لهاد الحجز. فهاد النسخة ما كاينش موظف مربوط، ولكن فالتطبيق الحقيقي الفريق ديالنا غادي يجاوبك هنا. تقدر حتى تكتب للشيفور.' },
  tripNew: { en: 'Of course — tap “New transport” below and we’ll start a fresh request. Your current booking stays saved.', fr: 'Bien sûr — touchez « Nouveau transport » ci-dessous pour une nouvelle demande. La réservation actuelle reste enregistrée.', ar: 'بالطبع — اضغط «نقل جديد» بالأسفل لبدء طلب جديد. حجزك الحالي يبقى محفوظاً.', da: 'أكيد — ضغط على «نقل جديد» لتحت ونبداو طلب جديد. الحجز ديالك كيبقى محفوظ.' },
  tripContact: { en: 'You can message {d} from the chat button on the booking card.', fr: 'Vous pouvez écrire à {d} via le bouton de discussion sur la carte de réservation.', ar: 'يمكنك مراسلة {d} من زر المحادثة في بطاقة الحجز.', da: 'تقدر تكتب ل{d} من زر الشات فبطاقة الحجز.' },
  tripHelp: { en: 'I can tell you the booking status, the driver’s estimated times, pass instructions to the driver, contact support, or start a new transport.', fr: 'Je peux vous donner le statut, les horaires estimés, transmettre des instructions au chauffeur, contacter l’assistance ou démarrer un nouveau transport.', ar: 'يمكنني إخبارك بحالة الحجز، والأوقات التقديرية، وتمرير تعليمات للسائق، والتواصل مع الدعم، أو بدء نقل جديد.', da: 'نقدر نقول ليك فين وصل الحجز، الأوقات المتوقعة، نوصل تعليمات للشيفور، نتاصل بالدعم، ولا نبداو نقل جديد.' },
} satisfies Record<string, P>;

/** Quick-reply chips per question, in each language. Each chip, when tapped, is understood by the demo brain. */
export const CHIPS: Record<string, Record<Lang, string[]>> = {
  cargo: { en: ['Home move', 'Furniture', 'A refrigerator', 'Boxes', 'Construction materials'], fr: ['Déménagement', 'Meubles', 'Un frigo', 'Des cartons', 'Matériaux de construction'], ar: ['أثاث المنزل', 'أثاث', 'ثلاجة', 'صناديق', 'مواد البناء'], darija: ['حوايج الدار', 'موبل', 'تلاجة', 'كراطن', 'مواد البني'] },
  confirm: { en: ['Yes, that’s all', 'I have more'], fr: ['Oui, c’est tout', 'Il y a autre chose'], ar: ['نعم، هذا كل شيء', 'لدي أشياء أخرى'], darija: ['ايه، هادشي', 'كاين حتى حوايج خرين'] },
  city: { en: ['Casablanca', 'Rabat', 'Mohammedia', 'Marrakech', 'Settat'], fr: ['Casablanca', 'Rabat', 'Mohammedia', 'Marrakech', 'Settat'], ar: ['الدار البيضاء', 'الرباط', 'المحمدية', 'مراكش', 'سطات'], darija: ['كازا', 'الرباط', 'المحمدية', 'مراكش', 'سطات'] },
  weight: { en: ['Use the estimate', 'About 100 kg', 'About 500 kg', 'Over 1 ton'], fr: ['Utilisez l’estimation', 'Environ 100 kg', 'Environ 500 kg', 'Plus d’une tonne'], ar: ['استخدم التقدير', 'حوالي 100 كغ', 'حوالي 500 كغ', 'أكثر من طن'], darija: ['دير التقدير', 'تقريباً 100 كيلو', 'تقريباً 500 كيلو', 'كثر من طن'] },
  quantity: { en: ['20 bags', '1 ton', '3 tons', '2 pallets'], fr: ['20 sacs', '1 tonne', '3 tonnes', '2 palettes'], ar: ['20 كيس', '1 طن', '3 طن', '2 باليط'], darija: ['20 شكارة', '1 طن', '3 طن', '2 باليط'] },
  yesno: { en: ['Yes', 'No'], fr: ['Oui', 'Non'], ar: ['نعم', 'لا'], darija: ['ايه', 'لا'] },
  when: { en: ['Now', 'Today afternoon', 'Tomorrow morning', 'Saturday'], fr: ['Maintenant', 'Cet après-midi', 'Demain matin', 'Samedi'], ar: ['الآن', 'اليوم بعد الظهر', 'غداً صباحاً', 'السبت'], darija: ['دابا', 'اليوم العشية', 'غدا الصباح', 'السبت'] },
  time: { en: ['8:00', '10:00', '14:00', '17:00'], fr: ['8h', '10h', '14h', '17h'], ar: ['8:00', '10:00', '14:00', '17:00'], darija: ['8:00', '10:00', '14:00', '17:00'] },
  help: { en: ['Loading and unloading', 'Loading only', 'Unloading only', 'No help needed'], fr: ['Chargement et déchargement', 'Chargement seulement', 'Déchargement seulement', 'Pas besoin d’aide'], ar: ['التحميل والتفريغ', 'التحميل فقط', 'التفريغ فقط', 'لا أحتاج مساعدة'], darija: ['التحميل والتفريغ', 'غير التحميل', 'غير التفريغ', 'ما محتاجش مساعدة'] },
  helpers: { en: ['1 helper', '2 helpers', '3 helpers'], fr: ['1 porteur', '2 porteurs', '3 porteurs'], ar: ['1 مساعدين', '2 مساعدين', '3 مساعدين'], darija: ['1 خدامة', '2 خدامة', '3 خدامة'] },
  floor: { en: ['Ground floor', '2nd floor, elevator', '3rd floor, no elevator'], fr: ['Rez-de-chaussée', '2e étage, ascenseur', '3e étage, sans ascenseur'], ar: ['الطابق الأرضي', 'الطابق 2 مع مصعد', 'الطابق 3 بلا مصعد'], darija: ['الطابق الأرضي', 'الطابق 2 كاين السانسور', 'الطابق 3 ماكاينش السانسور'] },
  passengers: { en: ['No one', 'I’ll ride along', '2 people'], fr: ['Personne', 'Je viens avec', '2 personnes'], ar: ['لا أحد', 'سأرافقه', '2 أشخاص'], darija: ['حتى واحد', 'غادي نمشي معاه', '2 ناس'] },
  savings: { en: ['Both are fine', 'Shared only', 'Return trip only', 'Neither'], fr: ['Les deux me vont', 'Partagé seulement', 'Retour seulement', 'Aucun des deux'], ar: ['كلاهما مناسب', 'المشترك فقط', 'رحلة العودة فقط', 'لا هذا ولا ذاك'], darija: ['بجوج مزيانين', 'غير المشترك', 'غير الرجوع', 'حتى واحد فيهم'] },
  instr: { en: ['Nothing else', 'Call me on arrival', 'Narrow street'], fr: ['Rien d’autre', 'Appelez-moi en arrivant', 'Rue étroite'], ar: ['لا شيء آخر', 'اتصل بي عند الوصول', 'الشارع ضيق'], darija: ['والو', 'عيط ليا ملي توصل', 'الزنقة ضيقة'] },
  fragile: { en: ['Nothing fragile', 'Yes, handle with care'], fr: ['Rien de fragile', 'Oui, avec précaution'], ar: ['لا شيء قابل للكسر', 'نعم، بعناية'], darija: ['حتى حاجة ما كتهرس', 'ايه، بشوية عليه'] },
  temp: { en: ['Yes, keep it cold', 'No'], fr: ['Oui, au froid', 'Non'], ar: ['نعم، يجب تبريده', 'لا'], darija: ['ايه، خاصو البرد', 'لا'] },
  trip: { en: ['Where is my driver?', 'When will they arrive?', 'Change pickup instructions', 'Contact support'], fr: ['Où est mon chauffeur ?', 'Quand arrive-t-il ?', 'Modifier les instructions', 'Contacter l’assistance'], ar: ['أين السائق؟', 'متى يصل؟', 'تعديل التعليمات', 'التواصل مع الدعم'], darija: ['فين الشيفور؟', 'إمتى يوصل؟', 'بدل التعليمات', 'تاصل بالدعم'] },
};

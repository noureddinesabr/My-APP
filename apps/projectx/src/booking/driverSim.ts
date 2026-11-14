import type { Booking, Lang } from '../models/booking';
import { say } from '../ai/providers/demo/phrases';
import { norm, hasAny } from '../ai/providers/demo/nlu';

/** SAMPLE driver: automatic, clearly-labelled replies so the in-app driver chat can be tested. */

export function driverStatusLine(i: number, lang: Lang, b: Booking): string {
  const lines = [
    { en: 'Hello! I’ve received your booking. I’ll keep you posted here.', fr: 'Bonjour ! J’ai bien reçu votre réservation. Je vous tiens au courant ici.', ar: 'مرحباً! استلمت حجزك. سأبقيك على اطلاع هنا.', da: 'السلام! توصلت بالحجز ديالك. غادي نبقى نخبرك هنا.' },
    { en: 'Preparing the vehicle and straps now.', fr: 'Je prépare le véhicule et les sangles.', ar: 'أجهز المركبة والأحزمة الآن.', da: 'كنوجد الطوموبيل والحبال دابا.' },
    { en: 'On my way to the pickup.', fr: 'Je suis en route vers le point de départ.', ar: 'أنا في الطريق إلى نقطة الاستلام.', da: 'راني جاي للاستلام.' },
    { en: 'I’ve arrived. I’m downstairs.', fr: 'Je suis arrivé, je suis en bas.', ar: 'وصلت، أنا في الأسفل.', da: 'وصلت، راني لتحت.' },
    { en: 'Everything is loaded and secured.', fr: 'Tout est chargé et bien attaché.', ar: 'تم تحميل كل شيء وتثبيته.', da: 'كلشي تحمل ومزيان مربوط.' },
    { en: `Heading to ${b.destination?.city ?? 'the destination'} now.`, fr: `En route vers ${b.destination?.city ?? 'la destination'}.`, ar: 'في الطريق إلى مكان التوصيل الآن.', da: 'غادي دابا لبلاصة التوصيل.' },
    { en: 'Delivered! Thank you for choosing X.', fr: 'Livré ! Merci d’avoir choisi X.', ar: 'تم التوصيل! شكراً لاختيارك X.', da: 'وصلناها! شكراً حيث اخترتي X.' },
    { en: '', fr: '', ar: '', da: '' },
  ];
  return say(lang, lines[i] ?? lines[7]);
}

export function driverReply(text: string, lang: Lang, status: number): string {
  const t = norm(text);
  if (hasAny(t, ['where', 'ou etes', 'ou es', 'فين', 'اين', 'fin']))
    return say(lang, status < 3
      ? { en: 'I’m on the way — I’ll message you when I’m close.', fr: 'Je suis en route, je vous écris quand j’approche.', ar: 'أنا في الطريق، سأراسلك عندما أقترب.', da: 'راني فالطريق، نكتب ليك ملي نقرب.' }
      : { en: 'I’m with your cargo now, all good.', fr: 'Je suis avec votre chargement, tout va bien.', ar: 'أنا مع شحنتك الآن، كل شيء بخير.', da: 'راني مع السلعة ديالك، كلشي مزيان.' });
  if (hasAny(t, ['call', 'appel', 'عيط', 'اتصل', 'telephone', 'phone']))
    return say(lang, { en: 'Sure, noted — I’ll call you when I arrive.', fr: 'Bien noté, je vous appelle en arrivant.', ar: 'حسناً، سأتصل بك عند الوصول.', da: 'واخا، غادي نعيط ليك ملي نوصل.' });
  if (hasAny(t, ['careful', 'fragile', 'attention', 'precaution', 'بشوية', 'رد البال', 'كيتهرس', 'انتبه']))
    return say(lang, { en: 'Don’t worry, I’ll handle it with care.', fr: 'Ne vous inquiétez pas, j’y ferai attention.', ar: 'لا تقلق، سأتعامل معها بعناية.', da: 'ما تخافش، غادي نرد البال مزيان.' });
  if (hasAny(t, ['thank', 'merci', 'شكرا', 'الله يخليك', 'baraka']))
    return say(lang, { en: 'You’re welcome!', fr: 'Avec plaisir !', ar: 'على الرحب والسعة!', da: 'مرحبا بيك!' });
  return say(lang, { en: 'Got it, thanks for letting me know.', fr: 'Bien reçu, merci de m’avoir prévenu.', ar: 'وصلت الرسالة، شكراً على التنبيه.', da: 'وصلات، شكراً حيث قلتيها ليا.' });
}

/**
 * What the claude.ai page can do for the preview, when it runs there: read photos (`sample` with
 * images), listen (`dictation`) and speak (`tts`). Each one is optional: the preview works without
 * them (sample results, typing, text answers) and says so honestly.
 */
type Sample = ((input: string, o?: unknown) => Promise<{ text: string }>) & { json: (input: string, o?: unknown) => Promise<unknown>; limits?: () => Promise<{ images?: { maxCount?: number } | boolean }> };
type Dictation = {
  start: (o?: { language?: string }) => Promise<void>;
  stop: () => Promise<void>;
  onPartial: (h: (e: { text: string }) => void) => () => void;
  onFinal: (h: (e: { text: string }) => void) => () => void;
  onState: (h: (e: { state: string; reason?: string }) => void) => () => void;
};
type Tts = { speak: (text: string, o?: { language?: string }) => Promise<void>; stop: () => void };
type W = { claude?: { use?: (n: string) => Promise<unknown> } };

const w = (typeof window !== 'undefined' ? window : {}) as W;
let sample: Sample | null = null;
let dictation: Dictation | null = null;
let tts: Tts | null = null;
let ready = false;
const waiters: (() => void)[] = [];

/** Asks the page once, at start, so a tap can start listening straight away. */
export function prepareClaude() {
  if (!w.claude?.use) {
    ready = true;
    return;
  }
  Promise.allSettled([
    w.claude.use('sample').then((x) => (sample = (x as Sample) ?? null)),
    w.claude.use('dictation').then((x) => (dictation = (x as Dictation) ?? null)),
    w.claude.use('tts').then((x) => (tts = (x as Tts) ?? null)),
  ]).then(() => {
    ready = true;
    waiters.splice(0).forEach((f) => f());
  });
  setTimeout(() => {
    ready = true;
    waiters.splice(0).forEach((f) => f());
  }, 6000);
}
const whenReady = () => (ready ? Promise.resolve() : new Promise<void>((r) => waiters.push(r)));
type SR = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const SRClass = (): (new () => SR) | null => {
  const g = (typeof window !== 'undefined' ? window : {}) as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
};
export const canListen = () => !!dictation || !!SRClass();
export const realVoice = () => !!dictation && !!tts;
export const canSee = () => !!sample;

// ---------------- Photos → items (real AI when available) ----------------
export type SeenItem = { name_en: string; name_fr: string; name_ar: string; qty: number; kg_each: number; confidence: 'high' | 'medium' | 'low'; x: number; y: number };
const b64ToBlob = (b64: string) => {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: 'image/jpeg' });
};
export async function readPhotos(b64s: string[]): Promise<SeenItem[] | null> {
  await whenReady();
  if (!sample || !b64s.length) return null;
  try {
    const out = (await sample.json(
      `You help a Moroccan moving app. Look at these photos of things a customer wants transported. List each distinct object to move (not walls, floors, people, plants that stay), counting each object once across photos. For each give English, French and Moroccan Darija (Arabic letters) names, a quantity, an honest estimated weight in kg per piece, your confidence (high/medium/low; use low when unsure what it is), and where its centre is in the FIRST photo it appears in as x and y between 0 and 1. Reply as JSON: {"items":[{"name_en":"","name_fr":"","name_ar":"","qty":1,"kg_each":10,"confidence":"high","x":0.5,"y":0.5}]}`,
      { images: b64s.slice(0, 4).map(b64ToBlob), modelTier: 'default' },
    )) as { items?: SeenItem[] };
    return Array.isArray(out?.items) ? out.items.slice(0, 12) : null;
  } catch {
    return null;
  }
}

// ---------------- Voice ----------------
export async function speak(text: string, lang: 'en' | 'fr' | 'ar') {
  await whenReady();
  if (tts) {
    try {
      await tts.speak(text, { language: lang });
    } catch {
      // not allowed / stopped
    }
    return;
  }
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : 'en-US';
    synth.speak(u);
  } catch {
    // no voice
  }
}
export function stopSpeaking() {
  try {
    tts?.stop();
    window.speechSynthesis?.cancel();
  } catch {
    // nothing
  }
}
/** Starts from the tap itself; resolves with what was said once the driver pauses. */
export function listen(lang: 'en' | 'fr' | 'ar', onHeard: (t: string) => void): Promise<string> {
  const dct = dictation;
  if (!dct) {
    const C = SRClass();
    if (!C) return Promise.resolve('');
    return new Promise((resolve) => {
      let text = '';
      try {
        const r = new C();
        r.lang = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : 'en-US';
        r.interimResults = true;
        r.continuous = false;
        r.onresult = (e) => {
          text = Array.from(e.results).map((x) => x[0].transcript).join(' ');
          onHeard(text);
        };
        r.onend = () => resolve(text.trim());
        r.onerror = () => resolve(text.trim());
        r.start();
        setTimeout(() => r.stop(), 12000);
      } catch {
        resolve('');
      }
    });
  }
  return new Promise((resolve) => {
    let text = '';
    let done = false;
    let pause: ReturnType<typeof setTimeout> | undefined;
    const offs: (() => void)[] = [];
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(limit);
      if (pause) clearTimeout(pause);
      dct.stop().catch(() => {});
      offs.forEach((f) => f());
      resolve(text.trim());
    };
    offs.push(
      dct.onPartial(({ text: p }) => onHeard(`${text}${p}`.trim())),
      dct.onFinal(({ text: f }) => {
        text += f;
        onHeard(text.trim());
        if (pause) clearTimeout(pause);
        pause = setTimeout(finish, 1300);
      }),
      dct.onState(({ state }) => {
        if (state === 'idle') finish();
      }),
    );
    const limit = setTimeout(finish, 12000);
    dct.start({ language: lang }).catch(() => finish());
  });
}

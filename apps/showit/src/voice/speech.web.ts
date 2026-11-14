/**
 * Browser preview: the claude.ai page's own dictation (speech → text, Chromium browsers) and voice
 * (`dictation` and `tts` capabilities). Elsewhere it falls back to the browser's speech voice, and
 * listening is simply not offered.
 */
export type VoiceLang = 'ar' | 'fr' | 'en';

type Dictation = {
  start: (o?: { language?: string }) => Promise<void>;
  stop: () => Promise<void>;
  onPartial: (h: (e: { text: string }) => void) => () => void;
  onFinal: (h: (e: { text: string }) => void) => () => void;
  onState: (h: (e: { state: string; reason?: string }) => void) => () => void;
};
type Tts = { speak: (text: string, o?: { language?: string; rate?: number }) => Promise<void>; stop: () => void };
type ClaudeWindow = { claude?: { use?: (name: string) => Promise<unknown> } };

let dictation: Dictation | null = null;
let tts: Tts | null = null;
let prepared = false;
/** Resolves once the page's voice has answered (or after 3 s), so the first words aren't lost. */
let ready: Promise<void> = Promise.resolve();

/** Loads the page's dictation and voice ahead of time: a tap must start listening at once. */
export function prepareVoice() {
  if (prepared) return;
  prepared = true;
  const w = (typeof window !== 'undefined' ? window : {}) as ClaudeWindow;
  w.claude?.use?.('dictation').then((d) => (dictation = (d as Dictation) ?? null)).catch(() => {});
  const voice = w.claude?.use?.('tts').then((x) => (tts = (x as Tts) ?? null)).catch(() => {});
  ready = Promise.race([voice ? voice.then(() => {}) : Promise.resolve(), new Promise<void>((r) => setTimeout(r, 3000))]);
}

/** The browser can't start listening without a tap. */
export const canListenAlone = false;

export const canListen = () => !!dictation;

export async function speak(text: string, lang: VoiceLang): Promise<void> {
  prepareVoice();
  await ready;
  if (tts) {
    try {
      await tts.speak(text, { language: lang, rate: 1 });
      return;
    } catch {
      return;
    }
  }
  // Outside claude.ai: the browser's own voice, if there is one.
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'ar' ? 'ar-SA' : lang === 'fr' ? 'fr-FR' : 'en-US';
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  } catch {
    // no voice here
  }
}

export function stopSpeaking() {
  try {
    tts?.stop();
    window.speechSynthesis?.cancel();
  } catch {
    // nothing to stop
  }
}

let current: (() => void) | null = null;

/**
 * Must be called straight from the tap (the page's dictation needs it). Resolves with the words
 * once the driver pauses (1.2 s after the last settled phrase), or '' after 9 seconds of nothing.
 */
export function listenOnce(lang: VoiceLang, onHeard?: (text: string) => void): Promise<string> {
  stopListening();
  const d = dictation;
  if (!d) return Promise.resolve('');
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
      d.stop().catch(() => {});
      offs.forEach((off) => off());
      current = null;
      resolve(text.trim());
    };
    offs.push(
      d.onPartial(({ text: p }) => onHeard?.(`${text}${p}`.trim())),
      d.onFinal(({ text: f }) => {
        text += f;
        onHeard?.(text.trim());
        if (pause) clearTimeout(pause);
        pause = setTimeout(finish, 1200);
      }),
      d.onState(({ state }) => {
        if (state === 'idle') finish();
      }),
    );
    const limit = setTimeout(finish, 9000);
    current = finish;
    d.start({ language: lang }).catch(() => finish());
  });
}

export function stopListening() {
  current?.();
}

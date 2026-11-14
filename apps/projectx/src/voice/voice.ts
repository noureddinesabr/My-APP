import type { Lang } from '../models/booking';
import { host } from '../lib/hostCapabilities';

/**
 * Voice service: speech-to-text and text-to-speech.
 * Order of preference: the claude.ai page's dictation/tts (when running there) → the browser's
 * Web Speech API → unavailable (the UI says so; it never pretends to listen).
 */

type SRResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<SRResult> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
const SRClass = (): (new () => SR) | null => {
  const g = (typeof window !== 'undefined' ? window : {}) as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
};

export const speechCode = (l: Lang) => (l === 'darija' ? 'ar-MA' : l === 'ar' ? 'ar-SA' : l === 'fr' ? 'fr-FR' : 'en-US');

export function voiceCaps() {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window;
  return { stt: host.dictation ? 'host' : SRClass() ? 'browser' : null, tts: host.tts ? 'host' : synth ? 'browser' : null } as const;
}

export type Listening = { done: Promise<{ text: string; error?: string }>; stop: () => void; cancel: () => void };

/** Must be called from a tap. Resolves with the final transcript when the speaker pauses or stops. */
export function listen(lang: Lang, onPartial: (t: string) => void): Listening {
  const dct = host.dictation;
  if (dct) {
    let text = '';
    let finished = false;
    let resolveFn: (v: { text: string; error?: string }) => void = () => {};
    const done = new Promise<{ text: string; error?: string }>((r) => (resolveFn = r));
    const offs: (() => void)[] = [];
    let pause: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(limit);
      if (pause) clearTimeout(pause);
      dct.stop().catch(() => {});
      offs.forEach((f) => f());
      resolveFn({ text: text.trim(), error });
    };
    offs.push(
      dct.onPartial(({ text: p }) => onPartial(`${text}${p}`.trim())),
      dct.onFinal(({ text: f }) => {
        text += `${f} `;
        onPartial(text.trim());
        if (pause) clearTimeout(pause);
        pause = setTimeout(() => finish(), 1400);
      }),
      dct.onState(({ state, reason }) => {
        if (state === 'idle' || state === 'error') finish(state === 'error' ? reason ?? 'error' : undefined);
      }),
    );
    const limit = setTimeout(() => finish(), 30000);
    dct.start({ language: lang === 'darija' ? 'ar' : lang }).catch((e) => finish(String(e?.message ?? e)));
    return { done, stop: () => finish(), cancel: () => ((text = ''), finish('cancelled')) };
  }
  const C = SRClass();
  if (!C) return { done: Promise.resolve({ text: '', error: 'unsupported' }), stop: () => {}, cancel: () => {} };
  let text = '';
  let err: string | undefined;
  let cancelled = false;
  const r = new C();
  const done = new Promise<{ text: string; error?: string }>((resolve) => {
    r.lang = speechCode(lang);
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      text = Array.from(e.results).map((x) => x[0].transcript).join(' ');
      onPartial(text);
    };
    r.onerror = (e) => (err = e.error);
    r.onend = () => resolve({ text: cancelled ? '' : text.trim(), error: cancelled ? 'cancelled' : text.trim() ? undefined : err ?? 'no-speech' });
    try {
      r.start();
    } catch (e) {
      resolve({ text: '', error: String(e) });
    }
  });
  return { done, stop: () => r.stop(), cancel: () => ((cancelled = true), r.abort()) };
}

// ---------------------------------------------------------------- speaking

let current: { stop: () => void } | null = null;

const voiceFor = (code: string) => {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const lc = code.toLowerCase();
  return voices.find((v) => v.lang.toLowerCase() === lc) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lc.slice(0, 2))) ?? null;
};
/** Whether this device can speak the language (browser voices load late; call again later). */
export function canSpeak(lang: Lang) {
  if (host.tts) return true;
  if (!('speechSynthesis' in window)) return false;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return true; // not loaded yet: try
  return !!voiceFor(speechCode(lang));
}

/** Speaks a reply. Resolves when finished or interrupted. */
export function speak(text: string, lang: Lang): Promise<void> {
  stopSpeaking();
  const clean = text.replace(/[*_#`]/g, '');
  if (host.tts) {
    const t = host.tts;
    current = { stop: () => t.stop() };
    return t.speak(clean, { language: lang === 'darija' ? 'ar' : lang }).catch(() => {});
  }
  if (!('speechSynthesis' in window)) return Promise.resolve();
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(clean);
    const code = speechCode(lang);
    u.lang = code;
    const v = voiceFor(code);
    if (v) u.voice = v;
    u.rate = 1.02;
    let settled = false;
    const end = () => {
      if (settled) return;
      settled = true;
      clearInterval(keep);
      resolve();
    };
    u.onend = end;
    u.onerror = end;
    // Chrome stops long utterances after ~15 s unless nudged.
    const keep = setInterval(() => {
      if (!synth.speaking) return end();
      synth.pause();
      synth.resume();
    }, 10000);
    current = { stop: () => (synth.cancel(), end()) };
    synth.speak(u);
  });
}
export function stopSpeaking() {
  try {
    current?.stop();
    current = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  } catch {
    // nothing to stop
  }
}

/**
 * Optional capabilities offered when this app runs as a claude.ai preview page: `sample` (Claude,
 * with images), `dictation` (speech-to-text) and `tts` (text-to-speech). Locally they don't exist and
 * the app uses the X server and the browser's own speech APIs instead.
 */
export type Sample = ((input: string, o?: unknown) => Promise<{ text: string }>) & { json: (input: string, o?: unknown) => Promise<unknown> };
export type Dictation = {
  start: (o?: { language?: string }) => Promise<void>;
  stop: () => Promise<void>;
  onPartial: (h: (e: { text: string }) => void) => () => void;
  onFinal: (h: (e: { text: string }) => void) => () => void;
  onState: (h: (e: { state: string; reason?: string }) => void) => () => void;
};
export type Tts = { speak: (text: string, o?: { language?: string }) => Promise<void>; stop: () => void };

type W = { claude?: { use?: (n: string) => Promise<unknown> } };
const w = (typeof window !== 'undefined' ? window : {}) as W;

export const host: { sample: Sample | null; dictation: Dictation | null; tts: Tts | null } = { sample: null, dictation: null, tts: null };
let readyP: Promise<void> | null = null;

export function prepareHost(): Promise<void> {
  if (readyP) return readyP;
  if (!w.claude?.use) return (readyP = Promise.resolve());
  const use = w.claude.use;
  const all = Promise.allSettled([
    use('sample').then((x) => (host.sample = (x as Sample) ?? null)),
    use('dictation').then((x) => (host.dictation = (x as Dictation) ?? null)),
    use('tts').then((x) => (host.tts = (x as Tts) ?? null)),
  ]).then(() => undefined);
  readyP = Promise.race([all, new Promise<void>((r) => setTimeout(r, 5000))]);
  return readyP;
}

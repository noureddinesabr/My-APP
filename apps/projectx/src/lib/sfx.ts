/**
 * Small interface sounds, synthesised with Web Audio (no files): taps, selections, scan pings,
 * success. Plus a light vibration on phones that support it.
 */
let ctx: AudioContext | null = null;
let enabled = true;
export const setSound = (on: boolean) => (enabled = on);

const ac = () => {
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number; delay?: number } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + (opts.delay ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.08, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function whoosh(dur = 1.2) {
  const c = ac();
  if (!c) return;
  const n = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
  const src = c.createBufferSource();
  src.buffer = n;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 6;
  f.frequency.setValueAtTime(400, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(2600, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

const buzz = (ms: number | number[]) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // no vibration
  }
};

export const sfx = {
  tap() {
    if (!enabled) return;
    tone(1900, 0.03, { type: 'triangle', gain: 0.04 });
    buzz(6);
  },
  select() {
    if (!enabled) return;
    tone(660, 0.07, { type: 'sine', gain: 0.06 });
    tone(990, 0.09, { type: 'sine', gain: 0.05, delay: 0.05 });
    buzz(10);
  },
  ping(i = 0) {
    if (!enabled) return;
    tone(880 + i * 110, 0.18, { type: 'sine', gain: 0.07, to: 1320 + i * 110 });
    buzz(12);
  },
  scan() {
    if (!enabled) return;
    whoosh(1.4);
  },
  success() {
    if (!enabled) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'sine', gain: 0.06, delay: i * 0.08 }));
    buzz([12, 40, 18]);
  },
  error() {
    if (!enabled) return;
    tone(180, 0.18, { type: 'square', gain: 0.03 });
    buzz([20, 40, 20]);
  },
};

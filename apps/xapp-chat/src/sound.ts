/**
 * Small, soft interface sounds made in the browser (no files): a tap, a new offer, a step, a
 * success chime, a voice start. They play only when sounds are on (Settings).
 */
export type Sfx = 'tap' | 'offer' | 'ping' | 'step' | 'success' | 'voice' | 'send';
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, vol = 0.06, type: OscillatorType = 'sine') {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + start);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

export function sfx(kind: Sfx, on: boolean) {
  if (!on) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    if (kind === 'tap') tone(660, 0, 0.06, 0.025, 'triangle');
    if (kind === 'send') { tone(520, 0, 0.09, 0.05); tone(780, 0.07, 0.12, 0.05); }
    if (kind === 'offer') { tone(880, 0, 0.12, 0.05); tone(1175, 0.1, 0.18, 0.05); }
    if (kind === 'ping') { tone(988, 0, 0.1, 0.05); tone(1319, 0.09, 0.2, 0.04); }
    if (kind === 'step') tone(740, 0, 0.16, 0.05);
    if (kind === 'success') { tone(523, 0, 0.14, 0.05); tone(659, 0.1, 0.14, 0.05); tone(784, 0.2, 0.26, 0.05); }
    if (kind === 'voice') { tone(600, 0, 0.08, 0.04); tone(900, 0.06, 0.12, 0.04); }
  } catch {
    // no audio here
  }
}

/** A short vibration where the phone supports it. */
export const buzz = (ms = 12) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // not supported
  }
};

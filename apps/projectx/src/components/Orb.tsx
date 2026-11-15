import { useEffect, useRef } from 'react';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

/**
 * X's visual identity: a luminous violet/cyan orb with a glowing core, drifting plasma and orbiting
 * particles. Its motion changes with the assistant's state (idle, listening, thinking, speaking).
 */
export function Orb({ size = 160, state = 'idle', level = 0, className = '' }: { size?: number; state?: OrbState; level?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ state, level });
  st.current = { state, level };

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pad = size * 0.45;
    const W = size + pad * 2;
    c.width = W * dpr;
    c.height = W * dpr;
    ctx.scale(dpr, dpr);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const R = size / 2;
    const cx = W / 2;
    const cy = W / 2;
    const parts = Array.from({ length: Math.max(14, Math.round(size / 6)) }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + Math.random(), r: 1.12 + Math.random() * 0.42, s: 0.15 + Math.random() * 0.35, z: Math.random() }));
    const ripples: { t: number }[] = [];
    let raf = 0;
    let t = 0;
    let energy = 0.2;
    let swirl = 0.3;
    let last = performance.now();
    let lastRipple = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const { state: s, level: lv } = st.current;
      const speedTarget = s === 'thinking' ? 1.9 : s === 'speaking' ? 1.2 : s === 'listening' ? 0.9 : 0.45;
      swirl += (speedTarget - swirl) * dt * 2.5;
      const speak = s === 'speaking' ? 0.5 + 0.5 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1) + 0.4 * Math.sin(t * 11.7)) : 0;
      const eTarget = s === 'speaking' ? 0.35 + speak * 0.65 : s === 'listening' ? 0.45 + Math.min(1, lv) * 0.5 : s === 'thinking' ? 0.55 : 0.22;
      energy += (eTarget - energy) * dt * 6;
      t += dt * (reduce ? 0.25 : 1) * swirl;
      if (s === 'listening' && now - lastRipple > 900) {
        ripples.push({ t: 0 });
        lastRipple = now;
      }

      ctx.clearRect(0, 0, W, W);
      const breathe = 1 + Math.sin(t * 1.6) * 0.025 + energy * 0.06;
      const r = R * breathe;

      // outer glow
      const g = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * (1.75 + energy * 0.35));
      g.addColorStop(0, `rgba(0,0,0,${0.16 + energy * 0.1})`);
      g.addColorStop(0.45, `rgba(0,0,0,${0.06 + energy * 0.05})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // listening ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.t += dt / 1.8;
        if (rp.t > 1) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(0,0,0,${(1 - rp.t) * 0.35})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1.02 + rp.t * 0.75), 0, Math.PI * 2);
        ctx.stroke();
      }

      // sphere body
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const body = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx, cy, r);
      body.addColorStop(0, '#3d3d3d');
      body.addColorStop(0.55, '#161616');
      body.addColorStop(1, '#000000');
      ctx.fillStyle = body;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.globalCompositeOperation = 'screen';
      const blobs = [
        { c: [120, 120, 120], sp: 0.7, ph: 0, rr: 0.72 },
        { c: [210, 210, 210], sp: -0.9, ph: 2.1, rr: 0.55 },
        { c: [80, 80, 80], sp: 0.5, ph: 4.2, rr: 0.8 },
        { c: [160, 160, 160], sp: -0.6, ph: 1.1, rr: 0.5 },
      ];
      for (const b of blobs) {
        const a = t * b.sp + b.ph;
        const bx = cx + Math.cos(a) * r * (0.32 + 0.1 * Math.sin(t * 0.7 + b.ph));
        const by = cy + Math.sin(a * 1.3) * r * (0.3 + 0.08 * Math.cos(t * 0.9 + b.ph));
        const br = r * b.rr * (0.85 + energy * 0.3);
        const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        bg.addColorStop(0, `rgba(${b.c.join(',')},${0.55 + energy * 0.3})`);
        bg.addColorStop(1, `rgba(${b.c.join(',')},0)`);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
      // thinking: rotating light arcs
      if (s === 'thinking' || swirl > 1.2) {
        ctx.lineWidth = Math.max(1.5, r * 0.035);
        for (let k = 0; k < 3; k++) {
          const a0 = t * (2.2 + k * 0.6) + (k * Math.PI * 2) / 3;
          ctx.strokeStyle = `rgba(255,255,255,${0.35 * Math.min(1, swirl - 0.6)})`;
          ctx.beginPath();
          ctx.arc(cx, cy, r * (0.55 + k * 0.13), a0, a0 + 1.1);
          ctx.stroke();
        }
      }
      // core
      const coreR = r * (0.26 + energy * 0.16);
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.2);
      core.addColorStop(0, `rgba(255,255,255,${0.8 + energy * 0.2})`);
      core.addColorStop(0.25, `rgba(225,225,225,${0.5 + energy * 0.25})`);
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // glass highlight + rim
      const hl = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.45, 0, cx - r * 0.38, cy - r * 0.45, r * 0.6);
      hl.addColorStop(0, 'rgba(255,255,255,0.22)');
      hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // particles
      for (const p of parts) {
        p.a += dt * p.s * swirl * (reduce ? 0.2 : 1);
        const pr = r * (p.r + Math.sin(t * 2 + p.z * 9) * 0.04 * (1 + energy * 2));
        const px = cx + Math.cos(p.a) * pr;
        const py = cy + Math.sin(p.a) * pr * 0.92;
        const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3 + p.z * 10)) * (0.5 + energy);
        ctx.fillStyle = p.z > 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(110,110,110,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.8, size / 140) * (0.7 + p.z), 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  const box = size * 1.9;
  return (
    <div className={`relative grid place-items-center ${className}`} style={{ width: size, height: size }} aria-hidden>
      <canvas ref={ref} style={{ width: box, height: box, position: 'absolute', left: (size - box) / 2, top: (size - box) / 2, pointerEvents: 'none' }} />
    </div>
  );
}

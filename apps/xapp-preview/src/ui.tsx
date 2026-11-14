import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, Check, ChevronRight, Minus, Plus, X, Star, BadgeCheck, Package, Bell, Sparkles } from 'lucide-react';
import { placeById, type Driver } from './data';
import { useApp, type Role } from './store';
import { useT } from './i18n';
import { buzz, sfx, type Sfx } from './sound';

// ---------------- Navigation (one stack per side) ----------------
export type Route = { name: string; arg?: string };
type NavApi = { route: Route | null; tab: string; push: (r: Route) => void; pop: () => void; replace: (r: Route) => void; setTab: (t: string) => void; reset: (tab?: string, r?: Route | null) => void; back: boolean };
export const NavCtx = createContext<NavApi | null>(null);
export const useNav = () => useContext(NavCtx)!;

export function useNavState(firstTab: string): NavApi {
  const [st, set] = useState<{ tab: string; stack: Route[]; back: boolean }>({ tab: firstTab, stack: [], back: false });
  return {
    route: st.stack[st.stack.length - 1] ?? null,
    tab: st.tab,
    back: st.back,
    push: (r) => set((x) => ({ ...x, stack: [...x.stack, r], back: false })),
    pop: () => set((x) => ({ ...x, stack: x.stack.slice(0, -1), back: true })),
    replace: (r) => set((x) => ({ ...x, stack: [...x.stack.slice(0, -1), r], back: false })),
    setTab: (t) => set({ tab: t, stack: [], back: false }),
    reset: (t, r) => set((x) => ({ tab: t ?? x.tab, stack: r ? [r] : [], back: false })),
  };
}

/** A tap with a soft sound and a tiny vibration, when sounds are on. */
export function useFx() {
  const { s } = useApp();
  return (k: Sfx = 'tap', ms = 8) => {
    sfx(k, s.sound);
    if (s.sound) buzz(ms);
  };
}

// ---------------- Building blocks ----------------
export function TopBar({ title, onBack, right, transparent }: { title?: ReactNode; onBack?: () => void; right?: ReactNode; transparent?: boolean }) {
  const nav = useNav();
  const fx = useFx();
  return (
    <div className="topbar" style={transparent ? { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 } : undefined}>
      <div className="side">
        <button aria-label="back" className={`iconbtn ${transparent ? 'glass' : ''}`} onClick={() => { fx(); (onBack ?? nav.pop)(); }}>
          <ArrowLeft size={20} className="flip" />
        </button>
      </div>
      <h2>{title}</h2>
      <div className="side">{right}</div>
    </div>
  );
}

export function Screen({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const nav = useNav();
  return (
    <div className={`scr ${nav.back ? 'back-anim' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Sheet({ open, onClose, children, dark, title }: { open: boolean; onClose: () => void; children: ReactNode; dark?: boolean; title?: ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={`sheet ${dark ? 'dark' : ''}`} role="dialog">
        <div className="grab" />
        {title && (
          <div className="between" style={{ marginBottom: 12 }}>
            <div className="h2" style={{ fontSize: 19 }}>{title}</div>
            <button className="iconbtn ghost" aria-label="close" onClick={onClose} style={dark ? { color: '#fff' } : undefined}><X size={20} /></button>
          </div>
        )}
        <div className="sbody">{children}</div>
      </div>
    </>
  );
}

export function Avatar({ d, size = '' }: { d: Pick<Driver, 'initials' | 'color' | 'verified'>; size?: '' | 'sm' | 'lg' | 'xl' }) {
  return (
    <div className={`av ${size}`} style={{ background: d.color }}>
      {d.initials}
      {d.verified && size !== 'sm' && (
        <span className="ver"><Check size={11} strokeWidth={4} color="#fff" /></span>
      )}
    </div>
  );
}

export function Rating({ v, trips }: { v: number; trips?: number }) {
  const { t } = useT();
  return (
    <span className="row small" style={{ gap: 4 }}>
      <Star size={14} fill="#f59e0b" color="#f59e0b" />
      <b style={{ color: 'var(--text)' }}>{v.toFixed(1)}</b>
      {trips !== undefined && <span>· {t('offTrips', { n: trips })}</span>}
    </span>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const fx = useFx();
  return (
    <div className="stepper" dir="ltr">
      <button aria-label="less" onClick={() => { if (value > min) { fx('tap'); onChange(value - 1); } }} style={{ opacity: value > min ? 1 : 0.35 }}><Minus size={16} /></button>
      <span>{value}</span>
      <button aria-label="more" onClick={() => { if (value < max) { fx('tap'); onChange(value + 1); } }} style={{ opacity: value < max ? 1 : 0.35 }}><Plus size={16} /></button>
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  const fx = useFx();
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => { fx('tap'); onChange(!on); }} />;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, ReactNode][]; onChange: (v: T) => void }) {
  const fx = useFx();
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => { fx(); onChange(v); }}>{l}</button>
      ))}
    </div>
  );
}

export function Row({ icon, title, sub, right, onClick, chevron = true }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; chevron?: boolean }) {
  const fx = useFx();
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="li" onClick={onClick ? () => { fx(); onClick(); } : undefined}>
      {icon && <div className="ic">{icon}</div>}
      <div className="grow">
        <div className="t">{title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
      {right}
      {onClick && chevron && <ChevronRight size={18} className="flip" color="var(--faint)" />}
    </Tag>
  );
}

/** Slide the knob to the end to confirm: hard to trigger by accident while driving or walking. */
export function SlideToConfirm({ label, onDone, disabled }: { label: string; onDone: () => void; disabled?: boolean }) {
  const { rtl } = useT();
  const fx = useFx();
  const ref = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState<{ start: number } | null>(null);
  const max = () => (ref.current ? ref.current.offsetWidth - 60 : 240);
  const end = () => {
    if (!drag) return;
    if (x > max() * 0.82) {
      setX(max());
      fx('success', 30);
      setTimeout(onDone, 160);
    } else setX(0);
    setDrag(null);
  };
  return (
    <div
      ref={ref}
      className="slide"
      style={{ opacity: disabled ? 0.45 : 1 }}
      onPointerDown={(e) => { if (disabled) return; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDrag({ start: e.clientX - (rtl ? -x : x) }); }}
      onPointerMove={(e) => { if (!drag) return; const raw = e.clientX - drag.start; setX(Math.max(0, Math.min(max(), rtl ? -raw : raw))); }}
      onPointerUp={end}
      onPointerCancel={end}
      onClick={(e) => { if (disabled) return; if (e.detail === 0) { fx('success', 30); onDone(); } }}
      onKeyDown={(e) => { if (e.key === 'Enter' && !disabled) onDone(); }}
      role="button"
      tabIndex={0}
      aria-label={label}
      data-slide
    >
      <div className="fill" style={{ transform: `scaleX(${x / (max() + 60)})` }} />
      <div className="lbl"><span>{label}</span></div>
      <div className="knob" style={{ transform: `translateX(${rtl ? -x : x}px)`, transition: drag ? 'none' : 'transform 0.3s cubic-bezier(0.2,1.3,0.4,1)' }}>
        <ChevronRight size={24} className="flip" strokeWidth={3} />
      </div>
    </div>
  );
}

export function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const fx = useFx();
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} aria-label={`${n} stars`} className={n <= value ? 'on' : ''} onClick={() => { fx('step'); onChange(n); }}>
          <Star size={40} fill="currentColor" strokeWidth={0} />
        </button>
      ))}
    </div>
  );
}

export function Confetti() {
  const colors = ['#f97316', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#fde047'];
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 36 }).map((_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 9) * 0.07}s`, transform: `rotate(${i * 23}deg)` }} />
      ))}
    </div>
  );
}

export function CheckBurst() {
  return (
    <div className="check-burst">
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </div>
  );
}

export function Empty({ icon, title, sub, action }: { icon?: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="col center fade-up" style={{ alignItems: 'center', padding: '48px 20px', gap: 10 }}>
      <div className="float" style={{ width: 76, height: 76, borderRadius: 26, background: 'var(--accent-soft)', color: 'var(--accent-text)', display: 'grid', placeItems: 'center' }}>{icon ?? <Package size={34} />}</div>
      <div className="h3">{title}</div>
      {sub && <p className="sub" style={{ maxWidth: 260 }}>{sub}</p>}
      {action}
    </div>
  );
}

export function Toasts({ role }: { role: Role }) {
  const { s, d } = useApp();
  const list = s.toasts.filter((x) => x.role === role).slice(-1);
  if (!list.length || !s.notifications) return null;
  return (
    <div className="toasts">
      {list.map((x) => (
        <button key={x.id} className={`toast ${x.tone} ${role === 'driver' && x.tone === 'info' ? 'drv' : ''}`} onClick={() => d({ t: 'dropToast', id: x.id })}>
          <span className="tic">{x.tone === 'ok' ? <BadgeCheck size={18} /> : x.tone === 'offer' ? <Sparkles size={18} /> : <Bell size={18} />}</span>
          <span className="grow" style={{ textAlign: 'start' }}>{x.text}</span>
        </button>
      ))}
    </div>
  );
}

export function StatusBar({ onHero }: { onHero?: boolean }) {
  return (
    <div className={`statusbar ${onHero ? 'onhero' : ''}`}>
      <span>9:41</span>
      <span className="ico">
        <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="6" rx="1" /><rect x="10" y="2.5" width="3" height="8.5" rx="1" /><rect x="15" y="0" width="3" height="11" rx="1" /></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="currentColor" opacity="0.5" /><rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" /><rect x="23" y="4" width="2" height="4" rx="1" fill="currentColor" opacity="0.5" /></svg>
      </span>
    </div>
  );
}

// ---------------- Maps (drawn, not real: clearly labelled) ----------------
type Pt = { x: number; y: number };
const bez = (a: Pt, c: Pt, b: Pt, t: number) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
const ctrl = (a: Pt, b: Pt, k = 0.22) => ({ x: (a.x + b.x) / 2 - (b.y - a.y) * k, y: (a.y + b.y) / 2 + (b.x - a.x) * k });

function CasaBase() {
  return (
    <g>
      <path d="M0 0 H300 C270 30 230 52 190 64 C150 76 110 98 72 132 C46 156 22 190 0 214 Z" fill="var(--map-water)" />
      <path d="M300 0 C270 30 230 52 190 64 C150 76 110 98 72 132 C46 156 22 190 0 214" stroke="var(--map-road2)" strokeWidth="3" fill="none" />
      <rect x="230" y="250" width="70" height="46" rx="12" fill="var(--map-park)" />
      <rect x="110" y="140" width="40" height="34" rx="10" fill="var(--map-park)" />
      <circle cx="80" cy="330" r="30" fill="var(--map-park)" />
      {[60, 120, 180, 240, 300, 360].map((y) => <path key={'h' + y} d={`M0 ${y} Q200 ${y + 14} 400 ${y - 8}`} stroke="var(--map-road2)" strokeWidth="1.5" fill="none" />)}
      {[50, 110, 170, 230, 290, 350].map((x) => <path key={'v' + x} d={`M${x} 400 Q${x + 12} 200 ${x - 6} 0`} stroke="var(--map-road2)" strokeWidth="1.5" fill="none" />)}
      <path d="M0 300 C120 270 220 240 400 150" stroke="var(--map-road)" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M150 400 C170 300 200 200 260 90" stroke="var(--map-road)" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M40 210 C120 200 220 210 330 110 L400 30" stroke="var(--map-road)" strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
  );
}
function MoroccoBase() {
  return (
    <g>
      <path d="M0 0 H232 C224 30 214 70 204 96 C190 112 176 122 166 130 C150 140 136 152 126 176 C116 200 106 222 96 246 C90 268 86 290 74 312 C60 340 44 368 20 400 H0 Z" fill="var(--map-water)" />
      <path d="M232 0 H400 V0 C370 30 340 44 300 40 C280 36 262 30 252 22 Z" fill="var(--map-water)" />
      <path d="M232 0 C224 30 214 70 204 96 C190 112 176 122 166 130 C150 140 136 152 126 176 C116 200 106 222 96 246 C90 268 86 290 74 312 C60 340 44 368 20 400" stroke="var(--map-road2)" strokeWidth="2" fill="none" />
      <path d="M362 46 C372 90 380 150 352 200 C320 240 260 262 210 300 C170 330 120 360 90 400" stroke="var(--faint)" strokeOpacity="0.4" strokeDasharray="4 5" strokeWidth="1.5" fill="none" />
      <path d="M150 210 C200 180 250 150 320 140" stroke="var(--map-park)" strokeWidth="26" strokeLinecap="round" fill="none" opacity="0.8" />
      <path d="M246 30 L204 98 L168 128 L142 222 L86 292" stroke="var(--map-road)" strokeWidth="5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M204 98 L286 104" stroke="var(--map-road)" strokeWidth="4" fill="none" strokeLinecap="round" />
    </g>
  );
}

/**
 * The route between two places on a drawn map: Casablanca streets when both ends are in town, the
 * Morocco coast otherwise. `progress` (0–1) moves the vehicle along the route.
 */
export function RouteMap({ from, to, progress, height = 220, live, labels = true, radar }: { from: string; to?: string; progress?: number; height?: number | string; live?: boolean; labels?: boolean; radar?: boolean }) {
  const { p } = useT();
  const a = placeById(from);
  const b = to ? placeById(to) : null;
  const city = a.cx !== undefined && (!b || b.cx !== undefined);
  const A = city ? { x: a.cx!, y: a.cy! } : { x: a.mx, y: a.my };
  const B = b ? (city ? { x: b.cx!, y: b.cy! } : { x: b.mx, y: b.my }) : null;
  // frame both ends with margin
  const xs = [A.x, B?.x ?? A.x], ys = [A.y, B?.y ?? A.y];
  const pad = city ? 70 : 60;
  let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  let w = Math.max(x1 - x0, 170), h = Math.max(y1 - y0, 130);
  // match the box shape (phone width ≈ 356 px) so both ends always stay in view
  const ratio = (typeof height === 'number' ? height : 300) / 356;
  if (h / w < ratio) h = w * ratio; else w = h / ratio;
  x0 = (x0 + x1) / 2 - w / 2; y0 = (y0 + y1) / 2 - h / 2;
  const C = B ? ctrl(A, B) : A;
  const v = B && progress !== undefined ? bez(A, C, B, Math.max(0, Math.min(1, progress))) : null;
  const sc = w / 320;
  return (
    <div className="map" style={{ height }}>
      <svg viewBox={`${x0} ${y0} ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        {city ? <CasaBase /> : <MoroccoBase />}
        {B && <path className="route-ghost" d={`M${A.x} ${A.y} Q${C.x} ${C.y} ${B.x} ${B.y}`} style={{ strokeWidth: 10 * sc }} />}
        {B && <path className={`route ${live ? 'dash' : ''}`} d={`M${A.x} ${A.y} Q${C.x} ${C.y} ${B.x} ${B.y}`} style={{ strokeWidth: 4.5 * sc }} />}
        {radar && <circle cx={A.x} cy={A.y} r={16 * sc} fill="var(--accent)" opacity="0.35" className="pulse" />}
        <g>
          <circle cx={A.x} cy={A.y} r={9 * sc} fill="var(--surface)" stroke="var(--accent)" strokeWidth={4 * sc} />
        </g>
        {B && (
          <g transform={`translate(${B.x} ${B.y}) scale(${sc})`}>
            <path d="M0 0 C-10 -12 -12 -18 -12 -24 A12 12 0 1 1 12 -24 C12 -18 10 -12 0 0 Z" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2.5" />
            <circle cx="0" cy="-24" r="4.5" fill="var(--surface)" />
          </g>
        )}
        {v && (
          <g transform={`translate(${v.x} ${v.y}) scale(${sc})`} style={{ transition: 'transform 1s linear' }}>
            <circle r="20" fill="var(--accent)" opacity="0.18" className="pulse" />
            <circle r="13" fill="var(--text)" stroke="var(--surface)" strokeWidth="3" />
            <path d="M-6 2 h8 v-6 h3 l3 3 v3 h1 v2 h-15 z" fill="var(--surface)" />
          </g>
        )}
        {labels && (
          <>
            <text x={A.x} y={A.y + 22 * sc} textAnchor="middle" className="label" style={{ fontSize: 11 * sc, strokeWidth: 3 * sc }}>{p(a.name)}</text>
            {B && b && <text x={B.x} y={B.y + 18 * sc} textAnchor="middle" className="label" style={{ fontSize: 11 * sc, strokeWidth: 3 * sc }}>{p(b.name)}</text>}
          </>
        )}
      </svg>
    </div>
  );
}

/** Tick a few times per second while `on`, so things like ETAs can count down. */
export function useNow(ms = 1000, on = true) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms, on]);
  return n;
}

export function Pill({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

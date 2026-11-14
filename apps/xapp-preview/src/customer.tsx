import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Home, Package, MessageCircle, User, ScanLine, Images, Search, Check, Plus, Trash2, MapPin, Clock, Users, ChevronDown, ChevronUp, Mic, Phone, MessageSquare, Minus, X, ShieldCheck, Settings,
  CreditCard, Bookmark, Headphones, AlertTriangle, ArrowRight, Truck, Sparkles, Info, LocateFixed, Repeat, Pencil,
} from 'lucide-react';
import { bestVehicle, CUSTOMER, driverById, firstName, nm, PHOTOS, placeById, SAMPLE_ROOM_ITEMS, SUGGESTIONS, SUGGEST_KG, VEHICLES, type Item, type L3 } from './data';
import { draftQuote, kgOf, offersFor, uid, useApp, type FloorEnd, type Offer, type Photo, type Req } from './store';
import { dh, num, useT, type Key } from './i18n';
import { AppHead, Avatar, BackBtn, CheckBurst, Chips, Confetti, Empty, NavBar, Rating, RouteMap, Row, Screen, Sec, Seg, Sheet, SlideToConfirm, Stars, Stepper, Switch, Toasts, TopBar, useFx, useNav, useNow } from './ui';
import { AdminLink, ChatScreen, ModeSwitch, PlaceSheet, SettingsScreen } from './common';
import { canSee, readPhotos } from './claude';
import { Boxes, CashScene, DoneScene, Fridge, GalleryScene, ItemArt, ListScene, Parcel, RouteScene, Sacks, ScanScene, Sofa, VanScene } from './art';

// ======================================================================
export function CustomerApp() {
  const nav = useNav();
  const { s, d } = useApp();
  const { t } = useT();
  const r = nav.route;
  let view;
  if (r) {
    view =
      r.name === 'capture' ? <Capture /> :
      r.name === 'items' ? <Items /> :
      r.name === 'request' ? <Builder /> :
      r.name === 'review' ? <Review /> :
      r.name === 'offers' ? <Offers id={r.arg ?? s.activeReqId ?? ''} /> :
      r.name === 'negotiate' ? <Negotiate offerId={r.arg!} /> :
      r.name === 'booked' ? <Booked id={r.arg!} /> :
      r.name === 'track' ? <Track id={r.arg!} /> :
      r.name === 'delivered' ? <Delivered id={r.arg!} /> :
      r.name === 'chat' ? <ChatScreen chatKey={r.arg!} me="customer" /> :
      r.name === 'settings' ? <SettingsScreen /> : null;
  } else view = nav.tab === 'home' ? <CHome /> : nav.tab === 'requests' ? <MyRequests /> : nav.tab === 'messages' ? <Messages /> : <CProfile />;
  const active = s.reqs.filter((x) => x.mine && (x.status === 'open' || x.status === 'booked')).length;
  return (
    <>
      {view}
      {!r && (
        <NavBar
          items={[
            { id: 'home', icon: <Home size={22} strokeWidth={2.2} />, label: t('tHome') },
            { id: 'requests', icon: <Package size={22} strokeWidth={2.2} />, label: t('tRequests'), count: active },
            { id: 'messages', icon: <MessageCircle size={22} strokeWidth={2.2} />, label: t('tMessages') },
            { id: 'profile', icon: <User size={22} strokeWidth={2.2} />, label: t('tProfile') },
          ]}
          center={() => { d({ t: 'resetDraft' }); nav.push({ name: 'capture' }); }}
          centerLabel={t('cScanTitle')}
          centerIcon={<ScanLine size={24} strokeWidth={2.4} />}
        />
      )}
      <Toasts role="customer" />
    </>
  );
}

// ---------------- Home ----------------
function CHome() {
  const { s, d } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const fileRef = useRef<HTMLInputElement>(null);
  const live = s.reqs.filter((x) => x.mine && (x.status === 'open' || x.status === 'booked'));
  const scan = () => { fx(); d({ t: 'resetDraft' }); nav.push({ name: 'capture' }); };
  const manual = (it?: Item) => { fx(); d({ t: 'resetDraft' }); d({ t: 'draft', patch: { ai: 'manual', items: it ? [it] : [] } }); nav.push({ name: 'items' }); };
  const popular: [Key, ReactNode, number, L3, number][] = [
    ['catFurniture', <Sofa />, 180, ['Sofa', 'Canapé', 'صالون'], 55], ['catAppliances', <Fridge />, 140, ['Fridge', 'Frigo', 'تلاجة'], 65], ['catBoxes', <Boxes />, 120, ['Boxes', 'Cartons', 'كراطن'], 12], ['catMaterials', <Sacks />, 220, SUGGESTIONS[6], 50], ['catShop', <Parcel />, 150, ['Shop goods (boxes)', 'Marchandise (cartons)', 'سلعة'], 18],
  ];
  return (
    <Screen>
      <AppHead hello={t('welcome')} name={(lang === 'ar' ? CUSTOMER.nameAr : CUSTOMER.name).split(' ')[0]} bell={live.length} onBell={() => nav.setTab('requests')} />
      <div className="body nav-pad">
        <button className="search" onClick={() => manual()} data-testid="search"><Search size={18} />{t('cSearch')}</button>
        {live.map((r) => <LiveCard key={r.id} r={r} />)}

        <Sec title={t('cMove')} sub={t('cMoveSub')} />
        <button className="svc fade-up" style={{ height: 176, paddingInlineEnd: '46%' }} onClick={scan} data-testid="cam-card">
          <div className="art" style={{ insetInlineEnd: 4, top: -14, width: '52%' }}><ScanScene /></div>
          <div className="h3" style={{ fontSize: 18 }}>{t('cScanTitle')}</div>
          <div className="small" style={{ margin: '4px 0 12px' }}>{t('cScanSub')}</div>
          <span className="btn sm" style={{ alignSelf: 'flex-start' }}><ScanLine size={16} />{t('cStart')}</span>
        </button>
        <div className="grid2" style={{ marginTop: 26 }}>
          <button className="svc fade-up d1" style={{ height: 132 }} onClick={() => { d({ t: 'resetDraft' }); fileRef.current?.click(); }}>
            <div className="art" style={{ top: -26, insetInlineStart: 10, width: 108 }}><GalleryScene /></div>
            <div className="h3">{t('cGalTitle')}</div><div className="small">{t('cGalSub')}</div>
          </button>
          <button className="svc fade-up d2" style={{ height: 132 }} onClick={() => manual()} data-testid="no-photo">
            <div className="art" style={{ top: -26, insetInlineStart: 10, width: 108 }}><ListScene /></div>
            <div className="h3">{t('cManTitle')}</div><div className="small">{t('cManSub')}</div>
          </button>
        </div>
        <GalleryInput inputRef={fileRef} onDone={() => nav.push({ name: 'capture' })} />

        <Sec title={t('cPopular')} sub={t('cPopularSub')} action={t('seeAll')} onAction={() => manual()} />
        <div className="hscroll">
          {popular.map(([k, art, from, name, kg], i) => (
            <button key={k} className="mini fade-up" style={{ animationDelay: `${i * 0.05}s` }} onClick={() => manual({ id: uid(), name, qty: 1, kg, conf: 'high' })}>
              <span className="tiny">{t(k)}</span>
              <span className="name">{t('fromPrice', { n: from })}</span>
              <span className="tiny">{t('avgTrip')}</span>
              <div style={{ marginTop: 'auto', height: 54 }}>{art}</div>
            </button>
          ))}
        </div>
        {s.reqs.some((x) => x.mine && x.status === 'delivered') && (
          <>
            <Sec title={t('rqPast')} action={t('seeAll')} onAction={() => nav.setTab('requests')} />
            {s.reqs.filter((x) => x.mine && x.status === 'delivered').slice(0, 2).map((r) => <ReqRow key={r.id} r={r} />)}
          </>
        )}
        <p className="tiny center" style={{ marginTop: 22 }}>{p(['Casablanca · Rabat · Marrakech · Tangier · Agadir', 'Casablanca · Rabat · Marrakech · Tanger · Agadir', 'الدار البيضاء · الرباط · مراكش · طنجة · أكادير'])}</p>
      </div>
    </Screen>
  );
}

function LiveCard({ r }: { r: Req }) {
  const { s } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const offers = offersFor(s, r.id);
  const booked = r.status === 'booked';
  const drv = r.booked ? driverById(r.booked.driverId) : null;
  return (
    <button className="box mint fade-up" style={{ width: '100%', textAlign: 'start', marginTop: 14, display: 'block' }} onClick={() => nav.push(booked ? { name: 'track', arg: r.id } : { name: 'offers', arg: r.id })} data-testid="live-card">
      <div className="between">
        <span className="row tiny" style={{ gap: 6, color: 'var(--ink)' }}><span className="dot live" />{booked ? t(`st${r.stage}` as Key) : t('offLive')}</span>
        <span className="price">{dh(r.booked?.price ?? r.price, lang)}</span>
      </div>
      <div className="between" style={{ marginTop: 8 }}>
        <div className="grow">
          <div className="h3 ellipsis">{p(placeById(r.from).name)} → {p(placeById(r.to).name)}</div>
          <div className="small">{booked && drv ? nm(drv, lang) : offers.length ? t(offers.length === 1 ? 'offCount1' : 'offCount', { n: offers.length }) : t('offSearching')}</div>
        </div>
        <span className="round"><ArrowRight size={18} className="flip" /></span>
      </div>
      {booked && <div className="bar" style={{ marginTop: 12, background: 'var(--bg)' }}><i style={{ width: `${(r.stage / 5) * 100}%` }} /></div>}
    </button>
  );
}

/** Real photos from the phone's gallery (resized in the browser; read by AI only where available). */
function GalleryInput({ inputRef, onDone }: { inputRef: React.RefObject<HTMLInputElement>; onDone?: () => void }) {
  const { s, d } = useApp();
  return (
    <input ref={inputRef} type="file" accept="image/*" multiple hidden data-testid="gallery-input"
      onChange={async (e) => {
        const files = Array.from(e.target.files ?? []).slice(0, 6);
        const photos: Photo[] = await Promise.all(files.map(shrink));
        d({ t: 'draft', patch: { photos: [...s.draft.photos.filter((x) => x.user), ...photos] } });
        e.target.value = '';
        onDone?.();
      }} />
  );
}
function shrink(f: File): Promise<Photo> {
  return new Promise((res) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', 0.82);
      res({ id: uid(), src: data, user: true, b64: data.split(',')[1] });
    };
    img.onerror = () => res({ id: uid(), src: url, user: true });
    img.src = url;
  });
}

// ---------------- Photo stage: the photo fills the screen and glides while scanning ----------------
type Mark = { id: string; x: number; y: number; w: number; h: number; label: string; low?: boolean };
const NAT: Record<string, { w: number; h: number }> = { [PHOTOS.room]: { w: 739, h: 415 }, [PHOTOS.movers]: { w: 720, h: 480 } };
function useSize(ref: React.RefObject<HTMLElement>) {
  const [sz, setSz] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const up = () => setSz({ w: el.clientWidth, h: el.clientHeight });
    up();
    const ro = new ResizeObserver(up);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return sz;
}
const rng = (seed: string) => {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return (h >>> 0) / 4294967296;
  };
};
/** A triangle mesh over an object, like a 3D scan. */
function meshPath(id: string, x: number, y: number, w: number, h: number) {
  const r = rng(id), cols = 5, rows = 4, pts: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    pts.push([]);
    for (let i = 0; i <= cols; i++) {
      const edge = i === 0 || j === 0 || i === cols || j === rows;
      pts[j].push([x + (w * i) / cols + (edge ? 0 : (r() - 0.5) * (w / cols) * 0.7), y + (h * j) / rows + (edge ? 0 : (r() - 0.5) * (h / rows) * 0.7)]);
    }
  }
  const f = (q: [number, number]) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  let d = '';
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i], e = pts[j + 1][i + 1];
      d += (i + j) % 2 ? `M${f(a)}L${f(b)}L${f(e)}ZM${f(a)}L${f(e)}L${f(c)}Z` : `M${f(a)}L${f(b)}L${f(c)}ZM${f(b)}L${f(e)}L${f(c)}Z`;
    }
  return d;
}
function PhotoStage({ src, pan, panMs = 0, marks, shown, onMark, height, children }: { src: string; pan: number; panMs?: number; marks: Mark[]; shown: Set<string>; onMark?: (id: string) => void; height?: number; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useSize(ref);
  const [nat, setNat] = useState(NAT[src] ?? { w: 0, h: 0 });
  useEffect(() => {
    if (NAT[src]) { setNat(NAT[src]); return; }
    const im = new Image();
    im.onload = () => setNat({ w: im.naturalWidth, h: im.naturalHeight });
    im.src = src;
  }, [src]);
  const sc = nat.w && box.w ? Math.max(box.w / nat.w, box.h / nat.h) : 0;
  const lw = nat.w * sc, lh = nat.h * sc;
  const dx = (lw - box.w) * pan, dy = (lh - box.h) * pan;
  return (
    <div ref={ref} className="cam" style={height ? { height, position: 'relative' } : { position: 'absolute', inset: 0 }} dir="ltr">
      {sc > 0 && (
        <div className="layer" style={{ width: lw, height: lh, transform: `translate(${-dx}px, ${-dy}px)`, transition: `transform ${panMs}ms cubic-bezier(.45,.05,.4,1)` }}>
          <img src={src} alt="" />
          <svg className="overlay mesh" viewBox={`0 0 ${lw} ${lh}`} width={lw} height={lh}>
            <defs>{marks.map((m) => <clipPath key={m.id} id={`c-${m.id}`}><rect x={m.x * lw} y={m.y * lh} width={m.w * lw} height={m.h * lh} rx={Math.min(m.w * lw, m.h * lh) * 0.22} /></clipPath>)}</defs>
            {marks.filter((m) => shown.has(m.id)).map((m) => (
              <g key={m.id} clipPath={`url(#c-${m.id})`}>
                <rect className="fillp" x={m.x * lw} y={m.y * lh} width={m.w * lw} height={m.h * lh} />
                <path d={meshPath(m.id, m.x * lw, m.y * lh, m.w * lw, m.h * lh)} style={{ stroke: m.low ? '#FDE68A' : '#fff' }} />
              </g>
            ))}
          </svg>
          {marks.filter((m) => shown.has(m.id)).map((m) => (
            <button key={m.id} className={`label ${m.low ? 'q' : ''}`} style={{ left: (m.x + m.w / 2) * lw, top: Math.max(16, m.y * lh + 4) }} onClick={() => onMark?.(m.id)}>{m.label}</button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

// ---------------- Capture + live scan ----------------
const SCAN_MS = 5200;
function Capture() {
  const { s, d } = useApp();
  const { t, p } = useT();
  const nav = useNav();
  const fx = useFx();
  const fileRef = useRef<HTMLInputElement>(null);
  const photos = s.draft.photos;
  const user = photos.find((x) => x.user);
  const src = user?.src ?? PHOTOS.room;
  const [phase, setPhase] = useState<'aim' | 'scan' | 'done'>('aim');
  const [start, setStart] = useState(0);
  const [result, setResult] = useState<{ items: Item[]; ai: 'claude' | 'sample'; at: number } | null>(null);
  const now = useNow(120, phase === 'scan');
  const heard = useRef(0);
  const marks: Mark[] = user
    ? result?.ai === 'claude'
      ? result.items.filter((i) => i.box).map((i) => ({ id: i.id, x: Math.max(0, i.box!.x - 0.09), y: Math.max(0, i.box!.y - 0.1), w: 0.18, h: 0.2, label: `${p(i.name)}${i.qty > 1 ? ` ×${i.qty}` : ''}`, low: i.conf === 'low' }))
      : []
    : SAMPLE_ROOM_ITEMS.map((it) => ({ id: it.id, ...it.box!, label: `${p(it.name)}${it.qty > 1 ? ` ×${it.qty}` : ''}`, low: it.conf === 'low' }));
  // Each object lights up as the camera glides past it.
  const appear = (m: Mark) => (user ? (result ? Math.max(result.at - start, 400 + (m.x + m.w / 2) * SCAN_MS * 0.8) : Infinity) : 300 + Math.max(0, (m.x + m.w / 2 - 0.25) / 0.75) * SCAN_MS * 0.9);
  const elapsed = phase === 'aim' ? -1 : phase === 'done' ? Infinity : now - start;
  const shown = new Set(marks.filter((m) => appear(m) <= elapsed).map((m) => m.id));
  useEffect(() => {
    if (shown.size > heard.current) { fx('ping', 10); heard.current = shown.size; }
  });
  const begin = () => {
    fx('voice', 15);
    heard.current = 0;
    setStart(Date.now());
    setPhase('scan');
    const ups = photos.filter((x) => x.user && x.b64);
    const job = ups.length && canSee() ? readPhotos(ups.map((x) => x.b64!)) : Promise.resolve(null);
    job.then((seen) => {
      const items: Item[] | null = seen?.length
        ? seen.map((it) => ({ id: uid(), name: [it.name_en, it.name_fr, it.name_ar] as L3, qty: Math.max(1, Math.round(it.qty || 1)), kg: Math.max(1, Math.round(it.kg_each || 10)), conf: it.confidence ?? 'medium', box: { x: Math.min(0.95, Math.max(0.05, it.x ?? 0.5)), y: Math.min(0.95, Math.max(0.05, it.y ?? 0.5)), w: 0, h: 0 }, photo: 0 }))
        : null;
      setResult(items ? { items, ai: 'claude', at: Date.now() } : { items: SAMPLE_ROOM_ITEMS.map((x) => (ups.length ? { ...x, box: undefined } : { ...x, photo: 0 })), ai: 'sample', at: Date.now() });
    });
  };
  useEffect(() => {
    if (phase === 'scan' && result && now - start > SCAN_MS + 500) setPhase('done');
  }, [now, phase, result, start]);
  useEffect(() => {
    if (phase !== 'done' || !result) return;
    fx('success', 25);
    const kg = kgOf(result);
    d({ t: 'draft', patch: { items: result.items, ai: result.ai, vehicle: null, helpers: kg > 150 ? 2 : kg > 40 ? 1 : 0, photos: photos.length ? photos : [{ id: uid(), src: PHOTOS.room, user: false }] } });
    const tm = setTimeout(() => nav.replace({ name: 'items' }), 1700);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result]);
  const tip = phase === 'aim' ? t('tipStart') : phase === 'scan' ? (user && !result ? t('tipReading') : t('tipStop')) : t('tipDone', { n: result?.items.length ?? 0 });
  return (
    <Screen style={{ background: '#000' }}>
      <PhotoStage src={src} pan={phase === 'aim' ? 0.12 : 1} panMs={phase === 'scan' ? SCAN_MS : 600} marks={marks} shown={shown}>
        {phase === 'scan' && <div className="scanline" />}
      </PhotoStage>
      <div style={{ position: 'absolute', top: 8, left: 18, right: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5 }}>
        <BackBtn />
        {!user && <span className="badge" style={{ background: 'rgba(255,255,255,.88)', color: 'var(--ink)', height: 26 }}>{t('camSample')}</span>}
      </div>
      <div className="camfoot">
        {photos.some((x) => x.user) && (
          <div className="thumbs">
            {photos.filter((x) => x.user).map((ph) => (
              <div className="thumb" key={ph.id}><img src={ph.src} alt="" />
                <button className="x" aria-label="remove" onClick={() => d({ t: 'draft', patch: { photos: photos.filter((x) => x.id !== ph.id) } })}><X size={11} /></button>
              </div>
            ))}
          </div>
        )}
        <span className="tip" key={tip}>{tip}</span>
        <div className="controls">
          <button className="round lg" aria-label={t('cGallery')} onClick={() => fileRef.current?.click()} disabled={phase !== 'aim'}><Images size={22} /></button>
          <button className={`scanbtn ${phase === 'scan' ? 'on' : ''}`} aria-label={tip} data-testid="shutter"
            onClick={() => (phase === 'aim' ? begin() : phase === 'scan' && result ? setPhase('done') : phase === 'done' ? nav.replace({ name: 'items' }) : undefined)}>
            {phase === 'done' ? <Check size={28} strokeWidth={3} /> : <ScanLine size={28} />}
          </button>
          <button className="round lg" aria-label={t('cManTitle')} onClick={() => { d({ t: 'draft', patch: { ai: 'manual' } }); nav.replace({ name: 'items' }); }} disabled={phase !== 'aim'}><Pencil size={20} /></button>
        </div>
      </div>
      <GalleryInput inputRef={fileRef} />
    </Screen>
  );
}

// ---------------- Scanned items (saved-scans grid) ----------------
function Items() {
  const { s, d } = useApp();
  const { t, p } = useT();
  const nav = useNav();
  const fx = useFx();
  const dr = s.draft;
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState<'all' | 'check' | 'heavy'>('all');
  const set = (items: Item[]) => d({ t: 'draft', patch: { items } });
  const upd = (id: string, patch: Partial<Item>) => set(dr.items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const kg = kgOf(dr);
  const v = VEHICLES[bestVehicle(kg)];
  const editing = dr.items.find((x) => x.id === sel);
  const manual = dr.ai === 'manual' || !dr.photos.length;
  const photo = dr.photos[0];
  const list = dr.items.filter((i) => (f === 'all' ? true : f === 'check' ? i.conf === 'low' : i.kg >= 40));
  const marks: Mark[] = dr.items.filter((i) => i.box && i.box.w > 0 && (i.photo ?? 0) === 0).map((i) => ({ id: i.id, ...i.box!, label: `${p(i.name)}${i.qty > 1 ? ` ×${i.qty}` : ''}`, low: i.conf === 'low' }));
  const content = (
    <>
      <div style={{ padding: '6px 20px 0' }}>
        <div className="title" style={{ fontSize: 24 }}>{manual ? t('yourItems') : t('scannedTitle')}</div>
        <div className="small" style={{ marginTop: 2 }}>{t('itemsN', { n: dr.items.reduce((n, i) => n + i.qty, 0), kg: num(kg) })}</div>
      </div>
      <div className="body" style={{ paddingTop: 12 }}>
        {dr.ai === 'sample' && dr.photos.some((x) => x.user) && <div className="box soft small" style={{ marginBottom: 12 }}><Info size={13} style={{ verticalAlign: -2 }} /> {t('aiSampleNote')}</div>}
        {!manual && <Chips value={f} options={[['all', t('fItems')], ['check', `${t('fCheck')} · ${dr.items.filter((i) => i.conf === 'low').length}`], ['heavy', t('fHeavy')]]} onChange={setF} />}
        <div className="grid2" style={{ marginTop: 14 }}>
          {list.map((it, i) => (
            <button key={it.id} className="icard" style={{ animationDelay: `${i * 0.05}s` }} onClick={() => { fx(); setSel(it.id); }} data-testid="item">
              <div className="pic">
                {it.qty > 1 && <span className="qty">×{it.qty}</span>}
                <span className={`scanb ${it.conf === 'low' ? 'q' : ''}`}>{it.conf === 'low' ? '?' : <ScanLine size={14} />}</span>
                <div style={{ width: '100%', height: 84 }}><ItemArt name={it.name[0]} /></div>
              </div>
              <div className="meta">
                <div className="name ellipsis">{p(it.name)}</div>
                <div className="tiny">{it.conf === 'low' ? t('isThis') : t('each', { kg: it.kg })}</div>
              </div>
            </button>
          ))}
          <button className="icard add" onClick={() => setAdding(true)} data-testid="add-item"><span className="col" style={{ alignItems: 'center', gap: 6 }}><Plus size={26} />{t('recAdd')}</span></button>
        </div>
        {dr.items.length > 0 && (
          <div className="box mint row fade-up" style={{ marginTop: 18 }}>
            <img src={v.img} alt="" style={{ width: 92, height: 56, objectFit: 'contain' }} />
            <div className="grow">
              <div className="tiny" style={{ color: 'var(--ink)' }}>{t('bestFit')}</div>
              <div className="h3">{p(v.name)}</div>
              <div className="tiny">{t('bestFitNote')}</div>
            </div>
          </div>
        )}
        <p className="tiny center" style={{ marginTop: 12 }}>{t('recNote')}</p>
      </div>
      <div className="foot">
        <button className="btn" disabled={!dr.items.length} onClick={() => { fx('send'); nav.push({ name: 'request' }); }} data-testid="build">{t('continue')}</button>
      </div>
    </>
  );
  return (
    <Screen>
      {manual ? (
        <><TopBar title="" />{content}</>
      ) : (
        <>
          <div style={{ position: 'relative', flex: 'none' }}>
            <PhotoStage src={photo.src} pan={0.5} marks={marks} shown={new Set(marks.map((m) => m.id))} onMark={(id) => setSel(id)} height={190} />
            <div style={{ position: 'absolute', top: 8, left: 18, right: 18, display: 'flex', justifyContent: 'space-between' }}>
              <BackBtn onBack={() => nav.replace({ name: 'capture' })} />
              <span className={`badge ${dr.ai === 'claude' ? 'mint' : ''}`} style={{ background: dr.ai === 'claude' ? undefined : 'rgba(255,255,255,.88)', color: 'var(--ink)', height: 26 }}><Sparkles size={12} />{dr.ai === 'claude' ? t('scanClaude') : t('scanSample')}</span>
            </div>
          </div>
          <div className="sheet-page">{content}</div>
        </>
      )}

      <Sheet open={!!editing} onClose={() => setSel(null)}>
        {editing && (
          <div className="col" style={{ gap: 14, paddingBottom: 4 }}>
            <div style={{ background: 'var(--mint)', borderRadius: 12, height: 150, display: 'grid', placeItems: 'center', padding: 16 }}><div style={{ width: 180, height: 120 }}><ItemArt name={editing.name[0]} /></div></div>
            {editing.conf === 'low' && (
              <div className="box soft row">
                <div className="grow h3" style={{ fontSize: 15 }}>{t('isThis')}</div>
                <button className="btn sm" onClick={() => { fx('step'); upd(editing.id, { conf: 'medium', name: editing.name.map((x) => x.replace(/\s?[?？؟]$/, '')) as L3 }); }}><Check size={16} />{t('yes')}</button>
              </div>
            )}
            <div className="field"><span className="lead"><Pencil size={16} /></span><input aria-label={t('nameL')} value={p(editing.name)} onChange={(e) => upd(editing.id, { name: [e.target.value, e.target.value, e.target.value] })} /></div>
            <div className="between"><span className="name">{t('qtyL')}</span><Stepper value={editing.qty} min={1} onChange={(q) => upd(editing.id, { qty: q })} /></div>
            <div className="between"><span className="name">{t('weightL')}</span>
              <div className="stepper" dir="ltr"><button onClick={() => upd(editing.id, { kg: Math.max(1, editing.kg - 5) })}><Minus size={15} /></button><span style={{ minWidth: 54 }}>{editing.kg} {t('kg')}</span><button onClick={() => upd(editing.id, { kg: editing.kg + 5 })}><Plus size={15} /></button></div>
            </div>
            <div className="row">
              <button className="btn line md" style={{ flex: 1 }} onClick={() => { set(dr.items.filter((x) => x.id !== editing.id)); setSel(null); }}><Trash2 size={17} />{t('recRemove')}</button>
              <button className="btn md" style={{ flex: 1 }} onClick={() => { fx('step'); setSel(null); }}>{t('save')}</button>
            </div>
          </div>
        )}
      </Sheet>
      <AddItemSheet open={adding} onClose={() => setAdding(false)} onAdd={(it) => set([...dr.items, it])} />
    </Screen>
  );
}

function AddItemSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (i: Item) => void }) {
  const { t, p } = useT();
  const fx = useFx();
  const [txt, setTxt] = useState('');
  const add = (name: L3, kg: number) => { fx('step'); onAdd({ id: uid(), name, qty: 1, kg, conf: 'high' }); setTxt(''); onClose(); };
  return (
    <Sheet open={open} onClose={onClose} title={t('recAddTitle')}>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="field grow"><span className="lead"><Search size={17} /></span><input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={t('recAddPh')} onKeyDown={(e) => e.key === 'Enter' && txt.trim() && add([txt, txt, txt], 20)} /></div>
        <button className="send" aria-label="add" onClick={() => txt.trim() && add([txt, txt, txt], 20)}><Plus size={20} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, paddingBottom: 6 }}>
        {SUGGESTIONS.map((sg, i) => (
          <button key={sg[0]} className="mini" style={{ width: 'auto', minHeight: 108, alignItems: 'center', textAlign: 'center' }} onClick={() => add(sg, SUGGEST_KG[i])}>
            <div style={{ width: '100%', height: 56 }}><ItemArt name={sg[0]} /></div>
            <span className="name" style={{ fontSize: 12.5, marginTop: 6 }}>{p(sg)}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// ---------------- Request details ----------------
function Builder() {
  const { s, d } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const dr = s.draft;
  const set = (patch: Partial<typeof dr>) => d({ t: 'draft', patch });
  const [pick, setPick] = useState<'from' | 'to' | null>(null);
  const [more, setMore] = useState(false);
  const [rec, setRec] = useState<'idle' | 'rec' | 'done'>(dr.voiceNote ? 'done' : 'idle');
  const q = draftQuote(dr);
  const ok = !!dr.to && dr.items.length > 0;
  return (
    <Screen>
      <TopBar title={t('reqDetails')} />
      <div className="body">
        <div className="between">
          <div className="h3">{t('secCargo')}</div>
          <button className="pill" onClick={() => nav.pop()}>{t('edit')}</button>
        </div>
        <div className="hscroll" style={{ marginTop: 10 }}>
          {dr.items.map((it) => (
            <div key={it.id} className="mini" style={{ width: 96, minHeight: 96, padding: 8 }}>
              <div style={{ height: 46 }}><ItemArt name={it.name[0]} /></div>
              <span className="name ellipsis" style={{ fontSize: 12, marginTop: 4 }}>{it.qty > 1 ? `${it.qty}× ` : ''}{p(it.name)}</span>
            </div>
          ))}
        </div>
        <div className="small" style={{ marginTop: 4 }}>{t('total', { kg: num(q.kg) })} · {p(VEHICLES[q.vehicle].name)}</div>

        <Sec title={t('secRoute')} />
        <div className="list">
          <button className="li" onClick={() => setPick('from')} data-testid="from">
            <div className="ic"><LocateFixed size={18} /></div>
            <div className="grow"><div className="s">{t('fromL')}</div><div className="t">{p(placeById(dr.from).name)}</div></div>
            <span className="badge mint">{t('myLoc')}</span>
          </button>
          <button className="li" onClick={() => setPick('to')} data-testid="to">
            <div className="ic" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}><MapPin size={18} /></div>
            <div className="grow"><div className="s">{t('toL')}</div><div className="t" style={{ color: dr.to ? undefined : 'var(--orange)' }}>{dr.to ? p(placeById(dr.to).name) : t('toPh')}</div></div>
          </button>
        </div>
        {dr.to && (
          <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', position: 'relative' }} className="fade-up">
            <RouteMap from={dr.from} to={dr.to} height={140} />
            <span className="badge" style={{ position: 'absolute', top: 10, insetInlineEnd: 10, background: 'var(--bg)', color: 'var(--ink)', height: 26 }}><Truck size={13} />{q.km} {t('km')} · {q.min} {t('min')}</span>
          </div>
        )}

        <Sec title={t('secWhen')} />
        <Chips value={dr.when} options={[['asap', t('asap')], ['today', t('today')], ['tomorrow', t('tomorrow')]]} onChange={(w) => set({ when: w })} />
        {dr.when !== 'asap' && <div className="chips fade-up" style={{ marginTop: 8 }}>{['09:00', '11:00', '14:00', '16:00', '18:00'].map((tm) => <button key={tm} className={`chip ${dr.time === tm ? 'on' : ''}`} onClick={() => set({ time: tm })} dir="ltr">{tm}</button>)}</div>}

        <Sec title={t('secHelp')} />
        <div className="box mint">
          <div className="between">
            <div className="name" style={{ color: 'var(--ink)' }}>{dr.helpers === 0 ? t('helpers0') : dr.helpers === 1 ? t('helpers1') : t('helpersN', { n: dr.helpers })}</div>
            <Stepper value={dr.helpers} max={4} onChange={(n) => set({ helpers: n })} />
          </div>
          <div className="tiny" style={{ marginTop: 6 }}>{t('helpersNote')}</div>
        </div>

        <Sec title={t('secWho')} />
        <div className="col" style={{ gap: 12 }}>
          {(['pickupContact', 'dropoffContact'] as const).map((k) => (
            <div key={k} className="col" style={{ gap: 8 }}>
              <div className="between"><span className="name">{t(k === 'pickupContact' ? 'atPickup' : 'atDropoff')}</span>
                <div style={{ width: 196 }}><Seg value={dr[k].self ? 'me' : 'other'} options={[['me', t('me')], ['other', t('someone')]]} onChange={(x) => set({ [k]: { ...dr[k], self: x === 'me' } })} /></div>
              </div>
              {!dr[k].self && (
                <div className="col fade-up" style={{ gap: 8 }}>
                  <div className="field"><span className="lead"><User size={16} /></span><input placeholder={t('namePh')} value={dr[k].name} onChange={(e) => set({ [k]: { ...dr[k], name: e.target.value } })} /></div>
                  <div className="field"><span className="lead"><Phone size={16} /></span><input placeholder={t('phonePh')} inputMode="tel" dir="ltr" value={dr[k].phone} onChange={(e) => set({ [k]: { ...dr[k], phone: e.target.value } })} /></div>
                </div>
              )}
            </div>
          ))}
          <div className="tiny"><ShieldCheck size={12} style={{ verticalAlign: -2 }} /> {t('contactPrivate')}</div>
        </div>

        <button className="box soft between" style={{ width: '100%', marginTop: 20, textAlign: 'start' }} onClick={() => { fx(); setMore(!more); }} data-testid="more">
          <div><div className="h3">{t('secMore')}</div><div className="small">{t('moreSub')}</div></div>
          {more ? <ChevronUp color="var(--ink)" /> : <ChevronDown color="var(--ink)" />}
        </button>
        {more && (
          <div className="col fade-up" style={{ gap: 12, marginTop: 12 }}>
            <div className="list" style={{ padding: '4px 14px' }}>{(['pickup', 'dropoff'] as const).map((end) => <FloorRow key={end} end={end} />)}</div>
            <div className="list">{([['fragile', 'fragile'], ['heavy', 'heavy'], ['cover', 'cover']] as const).map(([k, l]) => <Row key={k} title={t(l)} right={<Switch on={dr[k]} onChange={(x) => set({ [k]: x })} />} />)}</div>
            <Seg value={dr.shared ? 's' : 'p'} options={[['p', t('privateTrip')], ['s', t('shared')]]} onChange={(x) => set({ shared: x === 's' })} />
            {dr.shared && <div className="box mint small fade-up"><Repeat size={13} style={{ verticalAlign: -2 }} /> {t('sharedInfo')}</div>}
            <div className="field" style={{ alignItems: 'flex-start' }}><textarea rows={2} value={dr.notes} placeholder={t('notesPh')} onChange={(e) => set({ notes: e.target.value })} /></div>
            <button className="btn mint md" onClick={() => {
              if (rec === 'done') { setRec('idle'); set({ voiceNote: false }); return; }
              fx('voice'); setRec('rec'); setTimeout(() => { setRec('done'); set({ voiceNote: true }); fx('step'); }, 2600);
            }}>{rec === 'rec' ? <><span className="dot" /> {t('vaListening')}</> : rec === 'done' ? <><Check size={18} /> {t('voiceSaved')} <X size={15} /></> : <><Mic size={18} /> {t('voiceNote')}</>}</button>
          </div>
        )}
      </div>
      <div className="foot">
        {!ok && <div className="small center" style={{ color: 'var(--orange)', fontWeight: 700 }}>{!dr.to ? t('needTo') : t('needItems')}</div>}
        <button className="btn" disabled={!ok} onClick={() => { fx('send'); set({ price: null }); nav.push({ name: 'review' }); }} data-testid="see-price">{t('reqNext')}{ok && <span style={{ opacity: 0.8 }}>≈ {dh(q.fair.mid, lang)}</span>}</button>
      </div>
      <PlaceSheet open={pick !== null} onClose={() => setPick(null)} title={pick === 'from' ? t('fromL') : t('toL')} exclude={pick === 'from' ? dr.to : dr.from} onPick={(id) => set(pick === 'from' ? { from: id } : { to: id })} />
    </Screen>
  );
}

function FloorRow({ end }: { end: 'pickup' | 'dropoff' }) {
  const { s, d } = useApp();
  const { t } = useT();
  const f = s.draft.floors[end];
  const set = (patch: Partial<FloorEnd>) => d({ t: 'draft', patch: { floors: { ...s.draft.floors, [end]: { ...f, ...patch } } } });
  return (
    <div className="col" style={{ gap: 8, padding: '10px 0' }}>
      <div className="between"><span className="name">{t(end === 'pickup' ? 'atPickup' : 'atDropoff')} · {t('floor')}</span>
        <div className="row" style={{ gap: 8 }}><span className="small">{!f.floor ? t('ground') : ''}</span><Stepper value={f.floor ?? 0} max={20} onChange={(n) => set({ floor: n })} /></div>
      </div>
      {(f.floor ?? 0) > 0 && <div className="between fade-up"><span className="small">{t('lift')}</span><div style={{ width: 200 }}><Seg value={f.lift} options={[['yes', t('yes')], ['no', t('no')], ['unknown', '?']]} onChange={(x) => set({ lift: x })} /></div></div>}
    </div>
  );
}

// ---------------- Price & summary ----------------
function Review() {
  const { s, d } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const dr = s.draft;
  const q = draftQuote(dr);
  const price = dr.price ?? q.fair.mid;
  const setPrice = (n: number) => { fx(); d({ t: 'draft', patch: { price: Math.max(50, n) } }); };
  const pos = Math.max(0, Math.min(1, (price - q.fair.low * 0.8) / (q.fair.high * 1.2 - q.fair.low * 0.8)));
  const tone = price < q.fair.low ? 'low' : price > q.fair.high ? 'high' : 'fair';
  const extras = [dr.fragile && t('fragile'), dr.heavy && t('heavy'), dr.cover && t('cover'), dr.shared ? t('shared') : t('privateTrip')].filter(Boolean) as string[];
  return (
    <Screen>
      <TopBar title={t('priceTitle')} />
      <div className="body">
        <div className="svc fade-up" style={{ height: 'auto', paddingTop: 96, marginTop: 26 }}>
          <div className="art" style={{ top: -30, insetInlineEnd: 10, width: 200 }}><VanScene /></div>
          <div className="small">{t('fair')}</div>
          <div className="price" style={{ fontSize: 36 }}>{dh(q.fair.mid, lang)}</div>
          <div className="tiny">{t('fairRange', { low: q.fair.low, high: q.fair.high })}</div>
          <div className="tiny" style={{ marginTop: 6 }}>{t('fairBasis')}</div>
        </div>
        <Sec title={t('yourOffer')} sub={t('driversMay')} />
        <div className="box">
          <div className="row" style={{ justifyContent: 'center', gap: 20 }} dir="ltr">
            <button className="round soft lg" aria-label="minus" onClick={() => setPrice(price - 10)}><Minus size={22} /></button>
            <div className="price center" style={{ fontSize: 34, minWidth: 140 }} data-testid="my-price">{dh(price, lang)}</div>
            <button className="round lg" style={{ background: 'var(--btn)', color: '#fff' }} aria-label="plus" onClick={() => setPrice(price + 10)}><Plus size={22} /></button>
          </div>
          <div style={{ position: 'relative', height: 8, borderRadius: 6, background: 'var(--mint)', margin: '18px 4px 10px' }} dir="ltr">
            <span style={{ position: 'absolute', left: '20%', right: '25%', top: 0, bottom: 0, background: 'var(--mint2)', borderRadius: 6 }} />
            <span style={{ position: 'absolute', top: -5, left: `calc(${pos * 100}% - 9px)`, width: 18, height: 18, borderRadius: '50%', background: 'var(--btn)', border: '3px solid var(--bg)', transition: 'left .25s' }} />
          </div>
          <div className="center"><span className={`badge ${tone === 'fair' ? 'mint' : 'orange'}`}>{p(tone === 'fair' ? ['Fair price', 'Prix juste', 'ثمن معقول'] : tone === 'low' ? ['Low: fewer offers', 'Bas : moins d’offres', 'ناقص: عروض قليلة'] : ['Generous', 'Généreux', 'مزيان بزاف'])}</span></div>
        </div>
        <Sec title={t('reqTitle')} />
        <div className="list">
          <Row icon={<Package size={18} />} title={dr.items.map((i) => `${i.qty > 1 ? i.qty + '× ' : ''}${p(i.name)}`).join(', ')} sub={`${t('total', { kg: num(q.kg) })} · ${p(VEHICLES[q.vehicle].name)}`} />
          <Row icon={<MapPin size={18} />} title={`${p(placeById(dr.from).name)} → ${p(placeById(dr.to).name)}`} sub={`${q.km} ${t('km')} · ${q.min} ${t('min')}`} />
          <Row icon={<Clock size={18} />} title={dr.when === 'asap' ? t('asap') : `${t(dr.when)} · ${dr.time}`} />
          <Row icon={<Users size={18} />} title={dr.helpers === 0 ? t('helpers0') : dr.helpers === 1 ? t('helpers1') : t('helpersN', { n: dr.helpers })} sub={extras.join(' · ')} />
        </div>
        <div className="box mint row" style={{ marginTop: 12 }}>
          <div style={{ width: 64, flex: 'none' }}><CashScene /></div>
          <div className="small" style={{ color: 'var(--ink)', fontWeight: 700 }}>{t('payCash')}</div>
        </div>
      </div>
      <div className="foot">
        <button className="btn" onClick={() => { fx('send', 20); d({ t: 'draft', patch: { price } }); d({ t: 'publish' }); nav.reset('home', { name: 'offers' }); }} data-testid="find"><Truck size={19} />{t('find')}</button>
      </div>
    </Screen>
  );
}

// ---------------- Offers ----------------
function Offers({ id }: { id: string }) {
  const { s, d } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const r = s.reqs.find((x) => x.id === id);
  const [detail, setDetail] = useState<Offer | null>(null);
  const [accepting, setAccepting] = useState<Offer | null>(null);
  const [raise, setRaise] = useState(false);
  const [newPrice, setNewPrice] = useState(r?.price ?? 0);
  useEffect(() => {
    if (r?.status === 'booked') nav.replace({ name: 'booked', arg: r.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.status]);
  if (!r) return <Screen><TopBar title={t('tRequests')} /><Empty title={t('rqEmpty')} /></Screen>;
  const offers = offersFor(s, r.id);
  return (
    <Screen>
      <div style={{ position: 'relative', flex: 'none' }}>
        <RouteMap from={r.from} to={r.to} height={offers.length ? 170 : 300} radar live />
        <div style={{ position: 'absolute', top: 8, left: 18 }}><BackBtn onBack={() => nav.reset('home')} /></div>
      </div>
      <div className="sheet-page">
        <div className="body" style={{ paddingTop: 8 }}>
          <div className="between">
            <span className="row tiny" style={{ gap: 6, color: 'var(--ink)' }}><span className="dot live" />{t('offLive')}</span>
            <span className="badge mint">{dh(r.price, lang)}</span>
          </div>
          <div className="title" style={{ fontSize: 24, marginTop: 6 }}>{offers.length ? t(offers.length === 1 ? 'offCount1' : 'offCount', { n: offers.length }) : t('offSearching')}</div>
          <div className="small">{p(placeById(r.from).name)} → {p(placeById(r.to).name)} · {p(r.when)}</div>
          {!offers.length && <div className="col" style={{ gap: 10, marginTop: 14 }}>{[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}</div>}
          <div className="col" style={{ gap: 12, marginTop: 14 }}>
            {offers.map((o, i) => <OfferCard key={o.id} o={o} r={r} best={i === 0 && offers.length > 1} onDetail={() => setDetail(o)} onAccept={() => setAccepting(o)} />)}
          </div>
          <div className="box soft small center" style={{ marginTop: 14 }}><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> {t('offNotBooked')}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn mint md" style={{ flex: 1 }} onClick={() => { setNewPrice(r.price + 20); setRaise(true); }}><Plus size={17} />{t('offRaise')}</button>
            <button className="btn line md" style={{ flex: 1, color: 'var(--bad)' }} onClick={() => { d({ t: 'cancelReq', reqId: r.id }); nav.reset('home'); }}>{t('offCancel')}</button>
          </div>
          <p className="tiny center" style={{ marginTop: 12 }}>{t('offSampleNote')}</p>
        </div>
      </div>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? nm(driverById(detail.driverId), lang) : ''}>
        {detail && <DriverDetail o={detail} r={r} onContact={() => { setDetail(null); nav.push({ name: 'chat', arg: `${r.id}:${detail.driverId}` }); }} />}
      </Sheet>
      <Sheet open={!!accepting} onClose={() => setAccepting(null)} title={t('accept')}>
        {accepting && (
          <div className="col" style={{ gap: 14, paddingBottom: 4 }}>
            <div className="row"><Avatar d={driverById(accepting.driverId)} /><div className="grow"><div className="name">{nm(driverById(accepting.driverId), lang)}</div><Rating v={driverById(accepting.driverId).rating} trips={driverById(accepting.driverId).trips} /></div><div className="price" style={{ fontSize: 24 }}>{dh(accepting.price, lang)}</div></div>
            <div className="list">
              <Row icon={<MapPin size={18} />} title={`${p(placeById(r.from).name)} → ${p(placeById(r.to).name)}`} sub={p(r.when)} />
              <Row icon={<Clock size={18} />} title={t('offArrive', { n: accepting.etaMin })} sub={accepting.helpers ? t('offHelpers') : t('offNoHelpers')} />
              <Row icon={<CreditCard size={18} />} title={t('cashAfter')} />
            </div>
            <div className="tiny">{t('negRule')}</div>
            <SlideToConfirm label={t('offSlide', { price: accepting.price })} onDone={() => { d({ t: 'acceptOffer', offerId: accepting.id, by: 'customer' }); setAccepting(null); }} />
          </div>
        )}
      </Sheet>
      <Sheet open={raise} onClose={() => setRaise(false)} title={t('offRaise')}>
        <div className="row" style={{ justifyContent: 'center', gap: 18, margin: '6px 0 14px' }} dir="ltr">
          <button className="round soft lg" onClick={() => setNewPrice(Math.max(r.price, newPrice - 10))}><Minus /></button>
          <div className="price center" style={{ fontSize: 32, minWidth: 130 }}>{dh(newPrice, lang)}</div>
          <button className="round lg" style={{ background: 'var(--btn)', color: '#fff' }} onClick={() => setNewPrice(newPrice + 10)}><Plus /></button>
        </div>
        <p className="small center" style={{ marginBottom: 14 }}>{t('fairRange', { low: r.fair.low, high: r.fair.high })}</p>
        <button className="btn" onClick={() => { fx('send'); d({ t: 'raisePrice', reqId: r.id, price: newPrice }); setRaise(false); }}>{t('save')}</button>
      </Sheet>
    </Screen>
  );
}

function OfferCard({ o, r, best, onDetail, onAccept }: { o: Offer; r: Req; best: boolean; onDetail: () => void; onAccept: () => void }) {
  const { d } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const drv = driverById(o.driverId);
  const v = VEHICLES[drv.vehicle];
  const diff = o.price - r.price;
  const waiting = o.awaiting === 'driver';
  const lastBy = o.turns[o.turns.length - 1].by;
  return (
    <div className={`offer ${best ? 'best' : ''}`} data-testid="offer">
      <button className="top" style={{ width: '100%', textAlign: 'start' }} onClick={() => { fx(); onDetail(); }}>
        <Avatar d={drv} />
        <div className="grow">
          <div className="row" style={{ gap: 6 }}><span className="name ellipsis" style={{ color: 'var(--ink)', fontWeight: 800 }}>{nm(drv, lang)}</span>{best && <span className="badge orange">★</span>}</div>
          <Rating v={drv.rating} trips={drv.trips} />
        </div>
        <img src={v.img} alt="" />
      </button>
      <div className="bottom">
        <div className="between">
          <div>
            <div className="price" style={{ fontSize: 24 }}>{dh(o.price, lang)}</div>
            <div className="tiny" style={{ color: diff < 0 ? 'var(--ok)' : diff > 0 ? 'var(--orange)' : undefined }}>{diff < 0 ? t('offLess', { n: -diff }) : diff > 0 ? t('offMore', { n: diff }) : t('offSame')}</div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div className="small" style={{ color: 'var(--text)', fontWeight: 700 }}>{p(v.name)}</div>
            <div className="tiny" dir="ltr">{drv.plate}</div>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
          <span className="badge mint"><Clock size={11} />{t('offArrive', { n: o.etaMin })}</span>
          <span className={`badge ${o.helpers ? 'mint' : ''}`}><Users size={11} />{o.helpers ? t('offHelpers') : t('offNoHelpers')}</span>
          {r.shared && o.sharedOk && <span className="badge mint"><Repeat size={11} />{t('shared')}</span>}
        </div>
        {o.turns.length > 1 && lastBy === 'driver' && <div className="small" style={{ marginTop: 8, color: 'var(--orange)', fontWeight: 700 }}>{t('offTheyCounter', { name: firstName(drv, lang), price: o.price })}</div>}
        {waiting ? (
          <div className="row small" style={{ marginTop: 12, justifyContent: 'center', gap: 8 }}><span className="spin" style={{ width: 14, height: 14, border: '2px solid var(--ink)', borderTopColor: 'transparent', borderRadius: '50%' }} />{t('offWaiting', { name: firstName(drv, lang) })}</div>
        ) : (
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <button className="round soft" aria-label={t('decline')} onClick={() => { fx(); d({ t: 'declineOffer', offerId: o.id }); }}><X size={17} /></button>
            <button className="round soft" aria-label={t('message')} onClick={() => nav.push({ name: 'chat', arg: `${r.id}:${o.driverId}` })}><MessageSquare size={16} /></button>
            <button className="btn mint sm" style={{ flex: 1 }} onClick={() => { fx(); nav.push({ name: 'negotiate', arg: o.id }); }}>{t('counter')}</button>
            <button className="btn sm" style={{ flex: 1.2 }} onClick={() => { fx(); onAccept(); }} data-testid="accept">{t('accept')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function DriverDetail({ o, r, onContact }: { o: Offer; r: Req; onContact: () => void }) {
  const { t, p, lang } = useT();
  const drv = driverById(o.driverId);
  const v = VEHICLES[drv.vehicle];
  return (
    <div className="col" style={{ gap: 12, paddingBottom: 4 }}>
      <div className="row"><Avatar d={drv} size="lg" /><div className="grow"><Rating v={drv.rating} trips={drv.trips} /><div className="small">{drv.years} {p(['years on Xapp', 'ans sur Xapp', 'سنين فـ Xapp'])} · {drv.city}</div><span className="badge mint" style={{ marginTop: 4 }}><ShieldCheck size={11} />{t('dpVerified')}</span></div></div>
      <div className="box mint row"><img src={v.img} alt="" style={{ width: 96, height: 58, objectFit: 'contain' }} /><div><div className="h3">{p(v.name)}</div><div className="tiny" dir="ltr">{drv.plate}</div><div className="tiny">{t('dpUpTo', { kg: num(v.maxKg) })}</div></div></div>
      <div className="list">
        <Row icon={<Sparkles size={18} />} title={p(['“Careful with my fridge, on time.”', '« Soigneux avec mon frigo, ponctuel. »', '«حاضي مع التلاجة، وجا فالوقت.»'])} sub="Nadia · ★★★★★" />
        <Row icon={<Truck size={18} />} title={dh(o.price, lang)} sub={`${p(placeById(r.from).name)} → ${p(placeById(r.to).name)}`} />
      </div>
      <button className="btn mint md" onClick={onContact}><MessageSquare size={18} />{t('message')}</button>
      <p className="tiny center">{t('setPrivacySub')}</p>
    </div>
  );
}

// ---------------- Negotiation ----------------
function Negotiate({ offerId }: { offerId: string }) {
  const { s, d } = useApp();
  const { t, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const o = s.offers.find((x) => x.id === offerId);
  const r = o && s.reqs.find((x) => x.id === o.reqId);
  const [price, setPrice] = useState(o ? Math.round((o.price + (r?.price ?? o.price)) / 20) * 10 : 0);
  useEffect(() => {
    if (r?.status === 'booked') nav.replace({ name: 'booked', arg: r.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.status]);
  if (!o || !r) return null;
  const drv = driverById(o.driverId);
  const first = firstName(drv, lang);
  const waiting = o.awaiting === 'driver';
  return (
    <Screen>
      <TopBar title={t('negTitle', { name: first })} />
      <div className="body col" style={{ gap: 10 }}>
        <div className="box mint row"><Avatar d={drv} /><div className="grow"><div className="name">{nm(drv, lang)}</div><Rating v={drv.rating} trips={drv.trips} /></div></div>
        <div className="bubble sys">{t('yourOffer')}: {dh(r.price, lang)}</div>
        {o.turns.map((tu, i) => (
          <div key={i} className={`bubble ${tu.by === 'customer' ? 'me' : 'them'}`} style={{ fontSize: 18, fontWeight: 800 }}>
            <div className="tiny" style={{ color: 'inherit', opacity: 0.8 }}>{tu.by === 'customer' ? t('negYou') : first}</div>{dh(tu.price, lang)}
          </div>
        ))}
        {waiting && <div className="bubble them row small" style={{ gap: 8 }}><span className="spin" style={{ width: 12, height: 12, border: '2px solid var(--ink)', borderTopColor: 'transparent', borderRadius: '50%' }} />{t('offWaiting', { name: first })}</div>}
        <div className="box soft tiny" style={{ marginTop: 6 }}><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> {t('negRule')}</div>
      </div>
      {!waiting && (
        <div className="foot" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="row" style={{ justifyContent: 'center', gap: 16 }} dir="ltr">
            <button className="round soft" onClick={() => { fx(); setPrice(Math.max(50, price - 10)); }}><Minus /></button>
            <div className="price center" style={{ fontSize: 30, minWidth: 130 }}>{dh(price, lang)}</div>
            <button className="round" style={{ background: 'var(--btn)', color: '#fff' }} onClick={() => { fx(); setPrice(price + 10); }}><Plus /></button>
          </div>
          <div className="row">
            <button className="btn mint md" style={{ flex: 1 }} onClick={() => { fx('success'); d({ t: 'acceptOffer', offerId: o.id, by: 'customer' }); }}>{t('negAccept', { price: o.price })}</button>
            <button className="btn md" style={{ flex: 1 }} disabled={price === o.price} onClick={() => { fx('send'); d({ t: 'counter', offerId: o.id, by: 'customer', price }); }} data-testid="propose">{t('negSend', { price })}</button>
          </div>
        </div>
      )}
    </Screen>
  );
}

// ---------------- Booked ----------------
function Booked({ id }: { id: string }) {
  const { s } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const r = s.reqs.find((x) => x.id === id)!;
  const drv = driverById(r.booked!.driverId);
  useEffect(() => { fx('success', 40); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Screen>
      <Confetti />
      <div className="body col" style={{ justifyContent: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ width: 230, margin: '0 auto' }} className="fade-up"><VanScene /></div>
        <div className="title fade-up d1">{t('bkTitle')}</div>
        <p className="sub fade-up d2">{t('bkSub', { name: firstName(drv, lang), price: r.booked!.price })}</p>
        <div className="box mint fade-up d3" style={{ textAlign: 'start' }}>
          <div className="row"><Avatar d={drv} size="lg" /><div className="grow"><div className="name">{nm(drv, lang)}</div><Rating v={drv.rating} trips={drv.trips} /><div className="tiny">{p(VEHICLES[drv.vehicle].name)} · <span dir="ltr">{drv.plate}</span></div></div></div>
          <div className="divider" style={{ background: 'var(--mint2)' }} />
          <div className="between"><span className="small">{t('agreed')}</span><span className="price" style={{ fontSize: 22 }}>{dh(r.booked!.price, lang)}</span></div>
          <div className="tiny">{t('cashAfter')}</div>
        </div>
      </div>
      <div className="foot"><button className="btn" onClick={() => nav.replace({ name: 'track', arg: r.id })} data-testid="follow">{t('bkTrack')}</button></div>
    </Screen>
  );
}

// ---------------- Tracking ----------------
function Track({ id }: { id: string }) {
  const { s } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const r = s.reqs.find((x) => x.id === id);
  const now = useNow(500, !!r && r.stage === 4);
  if (!r || !r.booked) return null;
  const drv = driverById(r.booked.driverId);
  const first = firstName(drv, lang);
  const progress = r.stage >= 5 ? 1 : r.stage === 4 ? Math.min(0.92, (now - r.stageAt) / 7000) : r.stage >= 2 ? 0 : undefined;
  const eta = r.stage <= 1 ? Math.max(2, 12 - r.stage * 6) : r.stage === 4 ? Math.max(1, Math.round(r.min * (1 - (progress ?? 0)))) : null;
  return (
    <Screen>
      <div style={{ position: 'relative', flex: 'none' }}>
        <RouteMap from={r.from} to={r.to} height={300} progress={progress} live={r.stage === 4} radar={r.stage <= 1} />
        <div style={{ position: 'absolute', top: 8, left: 18 }}><BackBtn onBack={() => nav.reset('home')} /></div>
      </div>
      <div className="sheet-page">
        <div className="body" style={{ paddingTop: 8 }}>
          <div className="between">
            <div className="grow">
              <div className="tiny" style={{ color: 'var(--orange)' }}>{t(`st${r.stage}` as Key)}</div>
              <div className="h2" key={r.stage} style={{ animation: 'fadeUp .4s' }}>{t(`tn${r.stage}` as Key, { name: first, to: p(placeById(r.to).name) })}</div>
            </div>
            {eta !== null && <div className="center box mint" style={{ padding: '8px 12px' }}><div className="price" style={{ fontSize: 22 }}>{eta}</div><div className="tiny">{t('min')}</div></div>}
          </div>
          <div className="bar" style={{ margin: '14px 0 16px' }}><i style={{ width: `${(r.stage / 5) * 100}%` }} /></div>
          <div className="box mint row">
            <Avatar d={drv} />
            <div className="grow"><div className="name">{nm(drv, lang)}</div><div className="tiny">{p(VEHICLES[drv.vehicle].name)} · <span dir="ltr">{drv.plate}</span></div></div>
            <button className="round" aria-label={t('call')}><Phone size={17} /></button>
            <button className="round" aria-label={t('message')} onClick={() => nav.push({ name: 'chat', arg: r.id })}><MessageSquare size={17} /></button>
          </div>
          <div className="box" style={{ marginTop: 12 }}>
            <div className="steps">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`step ${i < r.stage || r.stage === 5 ? 'done' : i === r.stage ? 'now' : ''}`}>
                  <div className="b">{(i < r.stage || r.stage === 5) && <Check size={13} strokeWidth={3} />}</div>
                  <div className="tt">{t(`st${i}` as Key)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="box soft" style={{ marginTop: 12 }}>
            <div className="between"><span className="small">{t('agreed')}</span><span className="price" style={{ fontSize: 20 }}>{dh(r.booked.price, lang)}</span></div>
            <div className="tiny" style={{ marginTop: 4 }}>{t('cashAfter')}</div>
          </div>
        </div>
        {r.stage === 5 && <div className="foot"><button className="btn" onClick={() => nav.replace({ name: 'delivered', arg: r.id })} data-testid="confirm-delivery"><Check size={19} />{t('dvConfirm')}</button></div>}
      </div>
    </Screen>
  );
}

// ---------------- Delivered ----------------
function Delivered({ id }: { id: string }) {
  const { s, d } = useApp();
  const { t, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const r = s.reqs.find((x) => x.id === id)!;
  const drv = driverById(r.booked!.driverId);
  const first = firstName(drv, lang);
  const [stars, setStars] = useState(r.rating ?? 0);
  const [tags, setTags] = useState<string[]>(r.tags ?? []);
  const [fb, setFb] = useState('');
  const [prob, setProb] = useState(false);
  const [probTxt, setProbTxt] = useState('');
  const tagKeys: Key[] = ['tagOnTime', 'tagCareful', 'tagFriendly', 'tagPro', 'tagComm'];
  if (r.confirmedAt)
    return (
      <Screen>
        <Confetti />
        <div className="body col" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 12 }}>
          <div style={{ width: 240 }}><DoneScene /></div>
          <div className="title">{t('dvThanks')}</div>
          <p className="sub">{t('dvPaid', { price: r.booked!.price })}{r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}</p>
          {r.problem && <div className="box soft small"><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> {t('dvProblemSend')} ✓</div>}
        </div>
        <div className="foot"><button className="btn" onClick={() => { d({ t: 'resetDraft' }); nav.reset('home'); }}><ScanLine size={19} />{t('dvNew')}</button></div>
      </Screen>
    );
  return (
    <Screen>
      <TopBar title={t('st5')} onBack={() => nav.reset('home')} />
      <div className="body">
        <CheckBurst />
        <div className="h2 center" style={{ marginTop: 18 }}>{t('dvTitle')}</div>
        <p className="sub center">{t('dvPaid', { price: r.booked!.price })}</p>
        {!!r.deliveryPhotos?.length && (
          <>
            <Sec title={t('dvPhotos')} sub={t('dvBy', { name: first })} />
            <div className="grid2">{r.deliveryPhotos.map((ph, i) => <img key={i} src={ph} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10 }} />)}</div>
          </>
        )}
        <div className="box mint" style={{ marginTop: 18 }}>
          <div className="h3 center">{t('dvRate', { name: first })}</div>
          <div style={{ margin: '12px 0' }}><Stars value={stars} onChange={setStars} /></div>
          {stars > 0 && <div className="chips wrap fade-up" style={{ justifyContent: 'center' }}>{tagKeys.map((k) => <button key={k} className={`chip ${tags.includes(k) ? 'solid on' : ''}`} style={tags.includes(k) ? undefined : { background: 'var(--bg)' }} onClick={() => { fx(); setTags(tags.includes(k) ? tags.filter((x) => x !== k) : [...tags, k]); }}>{t(k)}</button>)}</div>}
          <div className="field" style={{ marginTop: 12, background: 'var(--bg)' }}><input value={fb} onChange={(e) => setFb(e.target.value)} placeholder={t('dvFb')} /></div>
        </div>
        <button className="link" style={{ margin: '16px auto 0', display: 'flex', color: 'var(--bad)' }} onClick={() => setProb(true)}><AlertTriangle size={16} />{t('dvProblem')}</button>
      </div>
      <div className="foot"><button className="btn" onClick={() => { fx('success', 30); d({ t: 'confirmDelivery', reqId: r.id, rating: stars, tags, feedback: fb }); }} data-testid="received">{t('dvConfirm')}</button></div>
      <Sheet open={prob} onClose={() => setProb(false)} title={t('dvProblem')}>
        <div className="field" style={{ alignItems: 'flex-start' }}><textarea rows={4} value={probTxt} onChange={(e) => setProbTxt(e.target.value)} placeholder={t('dvProblemPh')} /></div>
        <button className="btn" style={{ marginTop: 12 }} disabled={!probTxt.trim()} onClick={() => { d({ t: 'confirmDelivery', reqId: r.id, rating: stars, tags, feedback: fb, problem: probTxt }); d({ t: 'chat', reqId: 'support', from: 'customer', text: probTxt }); setProb(false); }}>{t('dvProblemSend')}</button>
        <p className="tiny center" style={{ marginTop: 10 }}>{dh(r.booked!.price, lang)} · {t('negRule')}</p>
      </Sheet>
    </Screen>
  );
}

// ---------------- Tabs ----------------
function ReqRow({ r }: { r: Req }) {
  const { s } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const st = r.status === 'open' ? 'sOpen' : r.status === 'booked' ? 'sBooked' : r.status === 'delivered' ? 'sDelivered' : 'sCancelled';
  const go = () => nav.push(r.status === 'booked' ? { name: 'track', arg: r.id } : r.status === 'delivered' ? { name: 'delivered', arg: r.id } : { name: 'offers', arg: r.id });
  return (
    <button className="load" style={{ marginBottom: 10 }} onClick={r.status === 'cancelled' ? undefined : go}>
      <div className="top">
        <div className="ph">{r.items[0] ? <div style={{ width: 56, height: 44 }}><ItemArt name={r.items[0].name[0]} /></div> : <Package />}</div>
        <div className="grow">
          <div className="name ellipsis" style={{ color: 'var(--ink)', fontWeight: 800 }}>{p(placeById(r.from).name)} → {p(placeById(r.to).name)}</div>
          <div className="tiny ellipsis">{r.items.map((i) => p(i.name)).join(', ')}</div>
          <div className="row" style={{ gap: 6, marginTop: 6 }}><span className={`badge ${r.status === 'open' ? 'orange' : r.status === 'cancelled' ? '' : 'mint'}`}>{t(st as Key)}</span>{r.status === 'open' && <span className="tiny">{t(offersFor(s, r.id).length === 1 ? 'offCount1' : 'offCount', { n: offersFor(s, r.id).length })}</span>}</div>
        </div>
        <div className="price">{dh(r.booked?.price ?? r.price, lang)}</div>
      </div>
    </button>
  );
}

function MyRequests() {
  const { s, d } = useApp();
  const { t } = useT();
  const nav = useNav();
  const [tab, setTab] = useState<'a' | 'p'>('a');
  const list = s.reqs.filter((r) => r.mine).filter((r) => (tab === 'a' ? r.status === 'open' || r.status === 'booked' : r.status === 'delivered' || r.status === 'cancelled'));
  return (
    <Screen>
      <div style={{ padding: '8px 20px 12px' }}><div className="title">{t('tRequests')}</div></div>
      <div className="body nav-pad">
        <Chips value={tab} options={[['a', t('rqActive')], ['p', t('rqPast')]]} onChange={setTab} />
        <div style={{ height: 14 }} />
        {list.map((r) => <ReqRow key={r.id} r={r} />)}
        {!list.length && <Empty art={<ScanScene />} title={t('rqEmpty')} sub={t('rqEmptySub')} action={<button className="btn sm" onClick={() => { d({ t: 'resetDraft' }); nav.reset('home', { name: 'capture' }); }}><ScanLine size={16} />{t('cStart')}</button>} />}
      </div>
    </Screen>
  );
}

function Messages() {
  const { s } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const keys = Array.from(new Set(s.chats.map((c) => c.reqId))).filter((k) => k !== 'support' && s.reqs.find((r) => r.id === k.split(':')[0])?.mine);
  s.reqs.filter((r) => r.mine && r.booked && !keys.includes(r.id)).forEach((r) => keys.unshift(r.id));
  return (
    <Screen>
      <div style={{ padding: '8px 20px 12px' }}><div className="title">{t('tMessages')}</div></div>
      <div className="body nav-pad">
        <div className="list">
          <Row icon={<Headphones size={18} />} title={t('support')} sub={s.chats.filter((c) => c.reqId === 'support').slice(-1)[0]?.text ?? t('supportLast')} onClick={() => nav.push({ name: 'chat', arg: 'support' })} />
          {keys.map((k) => {
            const [rid, did] = k.split(':');
            const r = s.reqs.find((x) => x.id === rid)!;
            const drv = driverById(did ?? r.booked!.driverId);
            const last = s.chats.filter((c) => c.reqId === k).slice(-1)[0];
            return <Row key={k} icon={<Avatar d={drv} size="sm" />} title={nm(drv, lang)} sub={last?.text ?? `${p(placeById(r.from).name)} → ${p(placeById(r.to).name)}`} onClick={() => nav.push({ name: 'chat', arg: k })} />;
          })}
        </div>
        {!keys.length && <Empty art={<RouteScene />} title={t('tMessages')} sub={t('chatsEmpty')} />}
      </div>
    </Screen>
  );
}

function CProfile() {
  const { s } = useApp();
  const { t, p } = useT();
  const nav = useNav();
  const mine = s.reqs.filter((r) => r.mine);
  const stats = useMemo(() => [[mine.length, t('tRequests')], [mine.filter((r) => r.status === 'delivered').length, t('sDelivered')]] as const, [mine, t]);
  return (
    <Screen>
      <div className="body nav-pad" style={{ paddingTop: 10 }}>
        <div className="row" style={{ gap: 14 }}>
          <div className="av lg" style={{ background: 'var(--btn)' }}>{CUSTOMER.initials}</div>
          <div className="grow"><div className="title" style={{ fontSize: 22 }}>{s.lang === 'ar' ? CUSTOMER.nameAr : CUSTOMER.name}</div><div className="small" dir="ltr" style={{ textAlign: 'start' }}>{CUSTOMER.phone}</div></div>
          <button className="round soft" aria-label={t('settings')} onClick={() => nav.push({ name: 'settings' })}><Settings size={18} /></button>
        </div>
        <div className="grid2" style={{ marginTop: 16 }}>{stats.map(([n, l]) => <div key={l} className="box mint"><div className="price" style={{ fontSize: 26 }}>{n}</div><div className="small">{l}</div></div>)}</div>
        <Sec title={t('setAccount')} />
        <div className="list">
          <Row icon={<Bookmark size={18} />} title={t('savedPlaces')} sub={`${p(placeById('maarif').name)} · ${p(placeById('gauthier').name)}`} />
          <Row icon={<CreditCard size={18} />} title={t('payMethod')} sub={t('payMethodSub')} />
          <Row icon={<Settings size={18} />} title={t('settings')} sub={`${s.lang === 'ar' ? 'العربية' : s.lang === 'fr' ? 'Français' : 'English'} · ${t(s.theme)}`} onClick={() => nav.push({ name: 'settings' })} />
          <Row icon={<Headphones size={18} />} title={t('support')} onClick={() => nav.push({ name: 'chat', arg: 'support' })} />
        </div>
        <Sec title={t('setMode')} />
        <ModeSwitch />
        <div className="list" style={{ marginTop: 12 }}><AdminLink /></div>
      </div>
    </Screen>
  );
}

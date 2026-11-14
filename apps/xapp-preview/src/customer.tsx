import { useEffect, useRef, useState } from 'react';
import {
  Camera, Images, ArrowRight, Plus, Trash2, Sparkles, Check, MapPin, Clock, Users, ChevronDown, ChevronUp, Mic, Package, Home, ClipboardList, MessageCircle, User, Phone, MessageSquare,
  Truck, Minus, Info, AlertTriangle, Star, X, ShieldCheck, Settings, CreditCard, Bookmark, Headphones, Wand2, ScanLine, Weight, Repeat,
} from 'lucide-react';
import { driverById, firstName, nm, PHOTOS, placeById, SAMPLE_ROOM_ITEMS, SUGGESTIONS, SUGGEST_KG, VEHICLES, bestVehicle, CUSTOMER, type Item, type L3 } from './data';
import { draftQuote, kgOf, offersFor, uid, useApp, type FloorEnd, type Offer, type Photo, type Req } from './store';
import { dh, num, useT, type Key } from './i18n';
import { Avatar, CheckBurst, Confetti, Empty, Rating, RouteMap, Row, Screen, Seg, Sheet, SlideToConfirm, Stars, Stepper, Switch, Toasts, TopBar, useFx, useNav, useNow, Pill } from './ui';
import { AdminLink, ChatScreen, ModeSwitch, PlaceSheet, SettingsScreen } from './common';
import { canSee, readPhotos } from './claude';

// ======================================================================
export function CustomerApp() {
  const nav = useNav();
  const { s } = useApp();
  const r = nav.route;
  let view;
  if (r) {
    view =
      r.name === 'capture' ? <Capture /> :
      r.name === 'scan' ? <Scan /> :
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
  } else {
    view = nav.tab === 'home' ? <CHome /> : nav.tab === 'requests' ? <MyRequests /> : nav.tab === 'messages' ? <Messages /> : <CProfile />;
  }
  return (
    <>
      {view}
      {!r && <CTabs />}
      <Toasts role="customer" />
    </>
  );
}

function CTabs() {
  const nav = useNav();
  const { s } = useApp();
  const { t } = useT();
  const fx = useFx();
  const active = s.reqs.filter((x) => x.mine && (x.status === 'open' || x.status === 'booked')).length;
  const tabs: [string, Key, typeof Home, number][] = [['home', 'tHome', Home, 0], ['requests', 'tRequests', ClipboardList, active], ['messages', 'tMessages', MessageCircle, 0], ['profile', 'tProfile', User, 0]];
  return (
    <div className="tabbar">
      {tabs.map(([id, k, I, n]) => (
        <button key={id} className={nav.tab === id ? 'on' : ''} onClick={() => { fx(); nav.setTab(id); }}>
          <span className="pill"><I size={21} strokeWidth={nav.tab === id ? 2.4 : 2} />{n > 0 && <span className="count">{n}</span>}</span>
          {t(k)}
        </button>
      ))}
    </div>
  );
}

// ---------------- Home: the camera comes first ----------------
function CHome() {
  const { s, d } = useApp();
  const { t, p } = useT();
  const nav = useNav();
  const fx = useFx();
  const fileRef = useRef<HTMLInputElement>(null);
  const live = s.reqs.filter((x) => x.mine && (x.status === 'open' || x.status === 'booked'));
  const recent = s.reqs.filter((x) => x.mine && x.status === 'delivered').slice(0, 2);
  const start = () => {
    fx('tap');
    d({ t: 'resetDraft' });
    nav.push({ name: 'capture' });
  };
  return (
    <Screen>
      <div className="body" style={{ paddingTop: 4 }}>
        <div className="between fade-up" style={{ margin: '4px 2px 14px' }}>
          <div>
            <div className="small" style={{ fontWeight: 650 }}>{t('cHello')} 👋</div>
            <div className="h1" style={{ marginTop: 2 }}>{t('cTitle')}</div>
          </div>
          <button className="iconbtn" aria-label="settings" onClick={() => nav.push({ name: 'settings' })}><Settings size={19} /></button>
        </div>

        {live.map((r) => <LiveCard key={r.id} r={r} />)}

        <button className="card tap hero fade-up d1" onClick={start} style={{ padding: 0, borderRadius: 30, overflow: 'hidden', border: 0 }} data-testid="cam-card">
          <div className="cam" style={{ height: 268, background: 'transparent' }}>
            <img className="feed" src={PHOTOS.room} alt="" style={{ opacity: 0.55, mixBlendMode: 'luminosity' }} />
            <div className="frame" style={{ inset: '16% 12% 26%' }}><i /><i /><i /><i /></div>
            <div className="scanline" style={{ opacity: 0.5 }} />
            <div style={{ position: 'absolute', top: 14, insetInlineStart: 14 }}><span className="badge glass"><Sparkles size={12} /> AI</span></div>
            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="shutter" style={{ width: 62, height: 62 }}><span style={{ width: 48, height: 48, display: 'grid', placeItems: 'center' }}><Camera size={24} color="#c2410c" /></span></div>
              <div style={{ textAlign: 'start' }}>
                <div className="h2" style={{ color: '#fff' }}>{t('cCam')}</div>
                <div className="small" style={{ color: 'rgba(255,255,255,.85)' }}>{t('cTypes')}</div>
              </div>
            </div>
          </div>
        </button>
        <p className="sub fade-up d2" style={{ margin: '12px 4px 0', fontSize: 14 }}>{t('cSub')}</p>

        <div className="row fade-up d3" style={{ marginTop: 14 }}>
          <button className="btn ghost md" style={{ flex: 1 }} onClick={() => { d({ t: 'resetDraft' }); fileRef.current?.click(); }}><Images size={19} />{t('cGallery')}</button>
          <button className="btn ghost md" style={{ flex: 1.4 }} onClick={() => { fx(); d({ t: 'resetDraft' }); d({ t: 'draft', patch: { ai: 'manual' } }); nav.push({ name: 'items' }); }} data-testid="no-photo"><Package size={19} />{t('cNoPhoto')}</button>
        </div>
        <GalleryInput inputRef={fileRef} onDone={() => nav.push({ name: 'capture' })} />

        <div className="card flat fade-up d4" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', padding: '14px 10px' }}>
          {([['cHow1', Camera], ['cHow2', Wand2], ['cHow3', Truck]] as [Key, typeof Camera][]).map(([k, I], i) => (
            <div key={k} className="col" style={{ alignItems: 'center', gap: 6, flex: 1 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: 'var(--accent-soft)', color: 'var(--accent-text)', display: 'grid', placeItems: 'center' }}><I size={19} /></div>
              <div className="small" style={{ fontWeight: 700, color: 'var(--text)', fontSize: 12.5 }}>{i + 1}. {t(k)}</div>
            </div>
          ))}
        </div>

        {recent.length > 0 && (
          <>
            <div className="sect">{t('rqPast')}</div>
            {recent.map((r) => <ReqRow key={r.id} r={r} />)}
          </>
        )}
        <p className="tiny center" style={{ marginTop: 18 }}>{p(['Xapp · Casablanca, Rabat, Marrakech, Tangier, Agadir, Fes', 'Xapp · Casablanca, Rabat, Marrakech, Tanger, Agadir, Fès', 'Xapp · الدار البيضاء، الرباط، مراكش، طنجة، أكادير، فاس'])}</p>
      </div>
    </Screen>
  );
}

/** Real photos from the phone's gallery (read in the browser; sent to the AI only when it is available). */
function GalleryInput({ inputRef, onDone }: { inputRef: React.RefObject<HTMLInputElement>; onDone?: () => void }) {
  const { s, d } = useApp();
  return (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      hidden
      data-testid="gallery-input"
      onChange={async (e) => {
        const files = Array.from(e.target.files ?? []).slice(0, 6);
        const photos: Photo[] = await Promise.all(files.map((f) => shrink(f)));
        d({ t: 'draft', patch: { photos: [...s.draft.photos, ...photos] } });
        e.target.value = '';
        onDone?.();
      }}
    />
  );
}
/** Makes a phone photo small (max 1024 px) so it is quick to show and to read. */
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

function LiveCard({ r }: { r: Req }) {
  const { s } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const offers = offersFor(s, r.id);
  const booked = r.status === 'booked';
  const drv = r.booked ? driverById(r.booked.driverId) : null;
  return (
    <button className="card tap fade-up" style={{ marginBottom: 12, borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent), var(--shadow)' }} onClick={() => nav.push(booked ? { name: 'track', arg: r.id } : { name: 'offers', arg: r.id })} data-testid="live-card">
      <div className="between">
        <span className="badge acc"><span className="dot live" />{booked ? t(`st${r.stage}` as Key) : t('offLive')}</span>
        <span className="price" style={{ fontSize: 17 }}>{dh(r.booked?.price ?? r.price, lang)}</span>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {r.photos[0] ? <img src={r.photos[0]} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover' }} /> : <div className="ic" style={{ width: 46, height: 46 }}><Package /></div>}
        <div className="grow">
          <div className="h3 ellipsis">{p(placeById(r.from).name)} → {p(placeById(r.to).name)}</div>
          <div className="small">{booked && drv ? nm(drv, lang) : offers.length ? t(offers.length === 1 ? 'offCount1' : 'offCount', { n: offers.length }) : t('offSearching')}</div>
        </div>
        <ArrowRight size={20} className="flip" color="var(--accent)" />
      </div>
      {booked && <div className="progress" style={{ marginTop: 12 }}><i style={{ width: `${(r.stage / 5) * 100}%` }} /></div>}
    </button>
  );
}

// ---------------- Capture ----------------
function Capture() {
  const { s, d } = useApp();
  const { t } = useT();
  const nav = useNav();
  const fx = useFx();
  const [flash, setFlash] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const photos = s.draft.photos;
  const shoot = () => {
    fx('tap', 20);
    setFlash((n) => n + 1);
    const sample = photos.filter((x) => !x.user).length;
    const src = sample % 2 === 0 ? PHOTOS.room : PHOTOS.movers;
    d({ t: 'draft', patch: { photos: [...photos, { id: uid(), src, user: false }] } });
  };
  const n = photos.length;
  return (
    <Screen style={{ background: '#000', color: '#fff' }}>
      <div className="cam" style={{ position: 'absolute', inset: 0 }}>
        <img className="feed" src={photos.length % 2 === 1 && !photos[photos.length - 1].user ? PHOTOS.movers : PHOTOS.room} alt="" />
        <div className="grid-ov" style={{ opacity: 0.5 }} />
        <div className="frame"><i /><i /><i /><i /></div>
        {flash > 0 && <div key={flash} className="flash" />}
      </div>
      <TopBar transparent title={<span style={{ color: '#fff' }}>{t('capTitle')}</span>} right={n > 0 ? <span className="badge glass" style={{ height: 28, fontSize: 13 }}>{n}</span> : undefined} />
      <div style={{ position: 'absolute', top: 64, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <span className="badge glass" style={{ height: 26 }}><ScanLine size={13} /> {t('capSim')}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 18, background: 'linear-gradient(transparent, rgba(0,0,0,.85) 30%)' }}>
        <p className="center" style={{ fontSize: 14, margin: '30px 30px 12px', color: 'rgba(255,255,255,.85)' }}>{t('capTip')}</p>
        {n > 0 && (
          <div className="thumbs" style={{ marginBottom: 14 }}>
            {photos.map((ph) => (
              <div className="thumb" key={ph.id}>
                <img src={ph.src} alt="" />
                <button className="x" aria-label="remove" onClick={() => d({ t: 'draft', patch: { photos: photos.filter((x) => x.id !== ph.id) } })}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="between" style={{ padding: '0 26px' }}>
          <button className="iconbtn glass" style={{ width: 52, height: 52 }} aria-label={t('cGallery')} onClick={() => fileRef.current?.click()}><Images size={22} /></button>
          <button className="shutter" aria-label={t('cCam')} onClick={shoot} data-testid="shutter"><span /></button>
          <div style={{ width: 52 }} />
        </div>
        <div style={{ padding: '16px 18px 0' }}>
          <button className="btn" disabled={!n} onClick={() => { fx('send'); nav.replace({ name: 'scan' }); }} data-testid="analyse">
            <Sparkles size={19} /> {n === 0 ? t('capNone') : n === 1 ? t('capAnalyse1') : t('capAnalyse', { n })}
            {n > 0 && <span className="shine" />}
          </button>
        </div>
      </div>
      <GalleryInput inputRef={fileRef} />
    </Screen>
  );
}

// ---------------- Scan (processing) ----------------
function Scan() {
  const { s, d } = useApp();
  const { t, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const [step, setStep] = useState(0);
  const result = useRef<{ items: Item[]; ai: 'claude' | 'sample' } | null>(null);
  const photos = s.draft.photos;
  useEffect(() => {
    let alive = true;
    const userPhotos = photos.filter((x) => x.user && x.b64);
    // Real AI reads real photos when the page allows it; otherwise the sample result, labelled as such.
    const job = userPhotos.length && canSee()
      ? readPhotos(userPhotos.map((x) => x.b64!)).then((seen) =>
          seen && seen.length
            ? {
                ai: 'claude' as const,
                items: seen.map((it) => ({ id: uid(), name: [it.name_en, it.name_fr, it.name_ar] as L3, qty: Math.max(1, Math.round(it.qty || 1)), kg: Math.max(1, Math.round(it.kg_each || 10)), conf: it.confidence ?? 'medium', box: { x: Math.min(0.95, Math.max(0.05, it.x ?? 0.5)), y: Math.min(0.95, Math.max(0.05, it.y ?? 0.5)), w: 0, h: 0 }, photo: photos.indexOf(userPhotos[0]) })),
              }
            : null,
        )
      : Promise.resolve(null);
    job.then((r) => {
      const firstSample = photos.findIndex((x) => !x.user && x.src === PHOTOS.room);
      result.current = r ?? { ai: 'sample', items: SAMPLE_ROOM_ITEMS.map((it) => ({ ...it, photo: firstSample >= 0 ? firstSample : undefined, box: firstSample >= 0 ? it.box : undefined })) };
    });
    const timers = [700, 1500, 2300, 3100].map((ms, i) => setTimeout(() => { if (alive) { setStep(i + 1); fx('step', 6); } }, ms));
    const finish = setInterval(() => {
      if (result.current && alive) {
        clearInterval(finish);
        setTimeout(() => {
          if (!alive || !result.current) return;
          const kg = kgOf(result.current);
          d({ t: 'draft', patch: { items: result.current.items, ai: result.current.ai, vehicle: null, helpers: kg > 150 ? 2 : kg > 40 ? 1 : 0 } });
          fx('success', 20);
          nav.replace({ name: 'items' });
        }, 3500);
      }
    }, 200);
    return () => { alive = false; timers.forEach(clearTimeout); clearInterval(finish); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const steps: Key[] = ['scan1', 'scan2', 'scan3', 'scan4'];
  return (
    <Screen style={{ background: '#0b0b0b', color: '#fff' }}>
      <div className="cam" style={{ height: '58%', borderRadius: '0 0 32px 32px' }}>
        <img className="feed" src={photos[0]?.src ?? PHOTOS.room} alt="" style={{ animation: 'none', filter: 'brightness(.8) saturate(.6)' }} />
        <div className="grid-ov" />
        <div className="scanline" />
        {step >= 1 && photos[0]?.src === PHOTOS.room && SAMPLE_ROOM_ITEMS.slice(0, Math.min(5, step + 1)).map((it, i) => (
          <div key={it.id} className="pin-dot" style={{ left: `${(it.box!.x + it.box!.w / 2) * 100}%`, top: `${(it.box!.y + it.box!.h / 2) * 100}%`, animationDelay: `${i * 0.1}s` }}>{i + 1}</div>
        ))}
        {photos.length > 1 && <span className="badge glass" style={{ position: 'absolute', top: 60, insetInlineEnd: 16 }}>+{photos.length - 1}</span>}
      </div>
      <div className="body" style={{ padding: '26px 26px' }}>
        <div className="h2" style={{ color: '#fff' }}>{t('scanTitle')}</div>
        <div className="col" style={{ gap: 14, marginTop: 20 }}>
          {steps.map((k, i) => (
            <div key={k} className="row" style={{ opacity: step >= i ? 1 : 0.35, transition: 'opacity .3s' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', background: step > i ? '#f97316' : 'rgba(255,255,255,.1)' }}>
                {step > i ? <Check size={16} strokeWidth={3} /> : step === i ? <span className="spin" style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} /> : null}
              </div>
              <span style={{ fontWeight: 650, fontSize: 15.5 }}>{t(k)}</span>
            </div>
          ))}
        </div>
        <p className="tiny" style={{ marginTop: 22, color: 'rgba(255,255,255,.5)' }}>{photos.some((x) => x.user) && canSee() ? t('scanClaude') : t('scanSample')} · {lang.toUpperCase()}</p>
      </div>
    </Screen>
  );
}

// ---------------- Recognition: what the AI saw, all editable ----------------
function Items() {
  const { s, d } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const dr = s.draft;
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [photoIx, setPhotoIx] = useState(0);
  const set = (items: Item[]) => d({ t: 'draft', patch: { items } });
  const upd = (id: string, patch: Partial<Item>) => set(dr.items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const kg = kgOf(dr);
  const v = VEHICLES[bestVehicle(kg)];
  const editing = dr.items.find((x) => x.id === sel);
  const photo = dr.photos[photoIx];
  const manual = dr.ai === 'manual' || !dr.photos.length;
  return (
    <Screen>
      <TopBar title={manual ? t('secCargo') : t('recCheck')} />
      <div className="body flush">
        {!manual && photo && (
          <div style={{ padding: '0 18px' }}>
            <div className="cam fade-up" style={{ height: 230, borderRadius: 24 }}>
              <img src={photo.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {dr.items.filter((it) => it.box && (it.photo ?? 0) === photoIx).map((it, i) =>
                it.box!.w > 0 ? (
                  <button key={it.id} className={`bbox ${it.box!.y < 0.08 ? 'top' : ''} ${it.conf === 'low' ? 'low' : ''} ${sel === it.id ? 'sel' : ''}`} onClick={() => setSel(it.id)}
                    style={{ left: `${it.box!.x * 100}%`, top: `${it.box!.y * 100}%`, width: `${it.box!.w * 100}%`, height: `${it.box!.h * 100}%`, animationDelay: `${i * 0.12}s` }}>
                    <span className="tag">{dr.items.indexOf(it) + 1} · {p(it.name)}{it.qty > 1 ? ` ×${it.qty}` : ''}</span>
                  </button>
                ) : (
                  <button key={it.id} className="pin-dot" onClick={() => setSel(it.id)} style={{ left: `${it.box!.x * 100}%`, top: `${it.box!.y * 100}%`, animationDelay: `${i * 0.1}s` }}>{dr.items.indexOf(it) + 1}</button>
                ),
              )}
              <span className={`badge ${dr.ai === 'claude' ? 'ok' : 'glass'}`} style={{ position: 'absolute', bottom: 10, insetInlineStart: 10 }}><Sparkles size={12} />{dr.ai === 'claude' ? t('scanClaude') : t('scanSample')}</span>
            </div>
            {dr.photos.length > 1 && (
              <div className="row" style={{ gap: 6, marginTop: 8 }}>
                {dr.photos.map((ph, i) => (
                  <button key={ph.id} onClick={() => setPhotoIx(i)} style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', outline: i === photoIx ? '2.5px solid var(--accent)' : 'none', outlineOffset: 2 }}><img src={ph.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></button>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ padding: '14px 18px 20px' }}>
          {manual ? <p className="sub">{t('recManual')}</p> : (
            <>
              <div className="h2">{t('recFound', { n: dr.items.length })}</div>
              <p className="small" style={{ marginTop: 4 }}><Info size={13} style={{ verticalAlign: -2 }} /> {t('recNote')}</p>
            </>
          )}
          <div className="col" style={{ gap: 8, marginTop: 14 }}>
            {dr.items.length === 0 && <div className="card flat center small">{t('recEmpty')}</div>}
            {dr.items.map((it, i) => (
              <div key={it.id} className={`item ${it.conf === 'low' ? 'low' : ''}`} style={{ animationDelay: `${i * 0.06}s`, flexWrap: 'wrap' }} data-testid="item">
                <span className="no">{i + 1}</span>
                <button className="grow" style={{ textAlign: 'start' }} onClick={() => setSel(it.id)}>
                  <div className="nm ellipsis">{p(it.name)}</div>
                  <div className="row" style={{ gap: 6, marginTop: 3 }}>
                    {!manual && <span className={`badge ${it.conf === 'high' ? 'ok' : it.conf === 'medium' ? 'info' : 'warn'}`}>{t(it.conf === 'high' ? 'confHigh' : it.conf === 'medium' ? 'confMed' : 'confLow')}</span>}
                    <span className="tiny">{t('each', { kg: it.kg })}</span>
                  </div>
                </button>
                <Stepper value={it.qty} min={1} onChange={(q) => upd(it.id, { qty: q })} />
                {it.conf === 'low' && (
                  <div className="row" style={{ width: '100%', gap: 8, marginTop: 8 }}>
                    <button className="btn sm soft" style={{ flex: 1 }} onClick={() => { fx('step'); upd(it.id, { conf: 'medium', name: it.name.map((x) => x.replace(/\s?[?？؟]$/, '')) as L3 }); }}><Check size={16} />{t('yes')}</button>
                    <button className="btn sm ghost" style={{ flex: 1 }} onClick={() => set(dr.items.filter((x) => x.id !== it.id))}><Trash2 size={16} />{t('recRemove')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn ghost md" style={{ flex: 1 }} onClick={() => setAdding(true)} data-testid="add-item"><Plus size={18} />{t('recAdd')}</button>
            <button className="btn ghost md" style={{ flex: 1 }} onClick={() => nav.push({ name: 'capture' })}><Camera size={18} />{t('recMore')}</button>
          </div>
          {dr.items.length > 0 && (
            <div className="card accent fade-up" style={{ marginTop: 16 }}>
              <div className="vehicle-card">
                <img src={v.img} alt="" />
                <div className="grow">
                  <div className="tiny" style={{ fontWeight: 700, color: 'var(--accent-text)' }}>{t('bestFit')}</div>
                  <div className="h3">{p(v.name)}</div>
                  <div className="small">{t('total', { kg: num(kg) })} · {t('dpUpTo', { kg: num(v.maxKg) })}</div>
                </div>
              </div>
              <p className="tiny" style={{ marginTop: 8 }}>{t('bestFitNote')}</p>
            </div>
          )}
        </div>
      </div>
      <div className="foot">
        <button className="btn" disabled={!dr.items.length} onClick={() => { fx('send'); nav.push({ name: 'request' }); }} data-testid="build">{t('recBuild')} <ArrowRight size={19} className="flip" /></button>
      </div>

      <Sheet open={!!editing} onClose={() => setSel(null)} title={editing ? p(editing.name) : ''}>
        {editing && (
          <div className="col" style={{ gap: 14, paddingBottom: 6 }}>
            <div className="field"><input value={p(editing.name)} onChange={(e) => upd(editing.id, { name: [e.target.value, e.target.value, e.target.value] })} /></div>
            <div className="between"><span className="h3">{t('each', { kg: editing.kg })}</span>
              <div className="stepper" dir="ltr">
                <button onClick={() => upd(editing.id, { kg: Math.max(1, editing.kg - 5) })}><Minus size={16} /></button><span>{editing.kg}</span><button onClick={() => upd(editing.id, { kg: editing.kg + 5 })}><Plus size={16} /></button>
              </div>
            </div>
            <div className="between"><span className="h3">×</span><Stepper value={editing.qty} min={1} onChange={(q) => upd(editing.id, { qty: q })} /></div>
            <p className="tiny">{t('recNote')}</p>
            <div className="row">
              <button className="btn danger md" style={{ flex: 1 }} onClick={() => { set(dr.items.filter((x) => x.id !== editing.id)); setSel(null); }}><Trash2 size={18} />{t('recRemove')}</button>
              <button className="btn md" style={{ flex: 1 }} onClick={() => setSel(null)}>{t('done')}</button>
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
  const add = (name: L3, kg: number) => {
    fx('step');
    onAdd({ id: uid(), name, qty: 1, kg, conf: 'high' });
    setTxt('');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('recAddTitle')}>
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="field grow"><input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={t('recAddPh')} onKeyDown={(e) => e.key === 'Enter' && txt.trim() && add([txt, txt, txt], 20)} /></div>
        <button className="send" aria-label="add" onClick={() => txt.trim() && add([txt, txt, txt], 20)}><Plus size={20} /></button>
      </div>
      <div className="chips wrap">
        {SUGGESTIONS.map((sg, i) => (
          <button key={sg[0]} className="chip" onClick={() => add(sg, SUGGEST_KG[i])}><Plus size={14} />{p(sg)}</button>
        ))}
      </div>
    </Sheet>
  );
}

// ---------------- Request builder ----------------
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
  const v = VEHICLES[q.vehicle];
  const ok = !!dr.to && dr.items.length > 0;
  const times = ['09:00', '11:00', '14:00', '16:00', '18:00'];
  return (
    <Screen>
      <TopBar title={t('reqTitle')} />
      <div className="body">
        {/* What */}
        <div className="sect"><Package size={14} /> {t('secCargo')}</div>
        <button className="card tap tight" onClick={() => nav.pop()}>
          <div className="row">
            {dr.photos[0] ? <img src={dr.photos[0].src} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover' }} /> : <img src={v.img} alt="" style={{ width: 60, height: 44, objectFit: 'contain' }} />}
            <div className="grow">
              <div className="h3 ellipsis">{dr.items.map((i) => `${i.qty > 1 ? i.qty + '× ' : ''}${p(i.name)}`).join(', ')}</div>
              <div className="small">{t('total', { kg: num(q.kg) })} · {p(v.name)}</div>
            </div>
            <span className="link">{t('edit')}</span>
          </div>
        </button>

        {/* Where */}
        <div className="sect"><MapPin size={14} /> {t('secRoute')}</div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <button className="li" onClick={() => setPick('from')} data-testid="from">
            <span className="rdot" style={{ width: 14, height: 14 }} />
            <div className="grow"><div className="tiny">{t('fromL')}</div><div className="t">{p(placeById(dr.from).name)}</div></div>
            <span className="badge"><MapPin size={11} />{t('myLoc')}</span>
          </button>
          <button className="li" onClick={() => setPick('to')} data-testid="to">
            <span className="rdot end" style={{ width: 14, height: 14 }} />
            <div className="grow"><div className="tiny">{t('toL')}</div><div className="t" style={{ color: dr.to ? undefined : 'var(--accent-text)' }}>{dr.to ? p(placeById(dr.to).name) : t('toPh')}</div></div>
            {!dr.to && <ArrowRight size={18} className="flip" color="var(--accent)" />}
          </button>
          {dr.to && (
            <div style={{ position: 'relative' }}>
              <RouteMap from={dr.from} to={dr.to} height={150} />
              <span className="badge" style={{ position: 'absolute', top: 10, insetInlineEnd: 10, background: 'var(--surface)', color: 'var(--text)', height: 26 }}><Truck size={13} />{q.km} {t('km')} · {q.min} {t('min')}</span>
            </div>
          )}
        </div>

        {/* When */}
        <div className="sect"><Clock size={14} /> {t('secWhen')}</div>
        <Seg value={dr.when} options={[['asap', t('asap')], ['today', t('today')], ['tomorrow', t('tomorrow')]]} onChange={(w) => set({ when: w })} />
        {dr.when !== 'asap' && (
          <div className="chips" style={{ marginTop: 10 }}>
            {times.map((tm) => <button key={tm} className={`chip ${dr.time === tm ? 'on' : ''}`} onClick={() => { fx(); set({ time: tm }); }} dir="ltr">{tm}</button>)}
          </div>
        )}

        {/* Helpers */}
        <div className="sect"><Users size={14} /> {t('secHelp')}</div>
        <div className="card tight">
          <div className="between">
            <div className="h3" style={{ fontSize: 15.5 }}>{dr.helpers === 0 ? t('helpers0') : dr.helpers === 1 ? t('helpers1') : t('helpersN', { n: dr.helpers })}</div>
            <Stepper value={dr.helpers} max={4} onChange={(n) => set({ helpers: n })} />
          </div>
          <p className="tiny" style={{ marginTop: 6 }}>{t('helpersNote')}</p>
        </div>

        {/* Who */}
        <div className="sect"><User size={14} /> {t('secWho')}</div>
        <div className="card tight col" style={{ gap: 12 }}>
          {(['pickupContact', 'dropoffContact'] as const).map((k) => (
            <div key={k} className="col" style={{ gap: 8 }}>
              <div className="between"><span className="small" style={{ fontWeight: 700, color: 'var(--text)' }}>{t(k === 'pickupContact' ? 'atPickup' : 'atDropoff')}</span>
                <div style={{ width: 200 }}><Seg value={dr[k].self ? 'me' : 'other'} options={[['me', t('me')], ['other', t('someone')]]} onChange={(x) => set({ [k]: { ...dr[k], self: x === 'me' } })} /></div>
              </div>
              {!dr[k].self && (
                <div className="col fade-up" style={{ gap: 8 }}>
                  <div className="field"><span className="lead"><User size={17} /></span><input placeholder={t('namePh')} value={dr[k].name} onChange={(e) => set({ [k]: { ...dr[k], name: e.target.value } })} /></div>
                  <div className="field"><span className="lead"><Phone size={17} /></span><input placeholder={t('phonePh')} inputMode="tel" dir="ltr" value={dr[k].phone} onChange={(e) => set({ [k]: { ...dr[k], phone: e.target.value } })} /></div>
                </div>
              )}
            </div>
          ))}
          <p className="tiny"><ShieldCheck size={12} style={{ verticalAlign: -2 }} /> {t('contactPrivate')}</p>
        </div>

        {/* More, progressive */}
        <button className="card tap tight" style={{ marginTop: 16 }} onClick={() => { fx(); setMore(!more); }} data-testid="more">
          <div className="between">
            <div><div className="h3">{t('secMore')}</div><div className="small">{t('moreSub')}</div></div>
            {more ? <ChevronUp /> : <ChevronDown />}
          </div>
        </button>
        {more && (
          <div className="col fade-up" style={{ gap: 12, marginTop: 10 }}>
            <div className="card tight col" style={{ gap: 12 }}>
              {(['pickup', 'dropoff'] as const).map((end) => <FloorRow key={end} end={end} />)}
            </div>
            <div className="card tight col" style={{ gap: 4 }}>
              {([['fragile', 'fragile'], ['heavy', 'heavy'], ['cover', 'cover']] as const).map(([k, l]) => (
                <div key={k} className="between" style={{ padding: '6px 0' }}><span style={{ fontWeight: 650 }}>{t(l)}</span><Switch on={dr[k]} onChange={(x) => set({ [k]: x })} /></div>
              ))}
            </div>
            <div className="card tight">
              <Seg value={dr.shared ? 's' : 'p'} options={[['p', t('privateTrip')], ['s', t('shared')]]} onChange={(x) => set({ shared: x === 's' })} />
              {dr.shared && <p className="small fade-up" style={{ marginTop: 8 }}><Info size={13} style={{ verticalAlign: -2 }} /> {t('sharedInfo')}</p>}
            </div>
            <div className="field" style={{ alignItems: 'flex-start' }}><textarea rows={2} value={dr.notes} placeholder={t('notesPh')} onChange={(e) => set({ notes: e.target.value })} /></div>
            <button className="btn ghost md" onClick={() => {
              if (rec === 'done') { setRec('idle'); set({ voiceNote: false }); return; }
              fx('voice'); setRec('rec'); setTimeout(() => { setRec('done'); set({ voiceNote: true }); fx('step'); }, 2600);
            }}>
              {rec === 'rec' ? <><span className="dot live" style={{ background: 'var(--bad)' }} /> {t('vaListening')}</> : rec === 'done' ? <><Check size={18} /> {t('voiceSaved')} <X size={16} /></> : <><Mic size={18} /> {t('voiceNote')}</>}
            </button>
          </div>
        )}
        <div style={{ height: 8 }} />
      </div>
      <div className="foot">
        {!ok && <div className="small center" style={{ color: 'var(--accent-text)', fontWeight: 650 }}>{!dr.to ? t('needTo') : t('needItems')}</div>}
        <button className="btn" disabled={!ok} onClick={() => { fx('send'); set({ price: null }); nav.push({ name: 'review' }); }} data-testid="see-price">
          {t('reqNext')} {ok && <span className="price" style={{ opacity: 0.85 }}>≈ {dh(q.fair.mid, lang)}</span>}
        </button>
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
    <div className="col" style={{ gap: 8 }}>
      <div className="between">
        <span style={{ fontWeight: 700 }}>{t(end === 'pickup' ? 'atPickup' : 'atDropoff')} · {t('floor')}</span>
        <div className="row" style={{ gap: 8 }}>
          <span className="small">{!f.floor ? t('ground') : ''}</span>
          <Stepper value={f.floor ?? 0} max={20} onChange={(n) => set({ floor: n })} />
        </div>
      </div>
      {(f.floor ?? 0) > 0 && (
        <div className="between fade-up">
          <span className="small">{t('lift')}</span>
          <div style={{ width: 230 }}><Seg value={f.lift} options={[['yes', t('yes')], ['no', t('no')], ['unknown', '?']]} onChange={(x) => set({ lift: x })} /></div>
        </div>
      )}
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
  const setPrice = (n: number) => { fx('tap'); d({ t: 'draft', patch: { price: Math.max(50, n) } }); };
  const pos = Math.max(0, Math.min(1, (price - q.fair.low * 0.8) / (q.fair.high * 1.2 - q.fair.low * 0.8)));
  const tone = price < q.fair.low ? 'warn' : price > q.fair.high ? 'info' : 'ok';
  const v = VEHICLES[q.vehicle];
  const extras = [dr.fragile && t('fragile'), dr.heavy && t('heavy'), dr.cover && t('cover'), dr.shared ? t('shared') : t('privateTrip')].filter(Boolean) as string[];
  return (
    <Screen>
      <TopBar title={t('revTitle')} />
      <div className="body">
        <div className="card hero fade-up" style={{ borderRadius: 28, border: 0, padding: 20 }}>
          <div className="small" style={{ fontWeight: 700 }}>{t('fair')}</div>
          <div className="price" style={{ fontSize: 44, marginTop: 4 }}>{dh(q.fair.mid, lang)}</div>
          <div className="small" style={{ marginTop: 2 }}>{t('fairRange', { low: q.fair.low, high: q.fair.high })}</div>
          <p className="tiny" style={{ marginTop: 10, color: 'rgba(255,255,255,.75)' }}>{t('fairBasis')}</p>
        </div>

        <div className="card fade-up d1" style={{ marginTop: 12 }}>
          <div className="between"><span className="h3">{t('yourOffer')}</span><span className={`badge ${tone}`}>{p(tone === 'ok' ? ['Fair', 'Juste', 'معقول'] : tone === 'warn' ? ['Low: fewer offers', 'Bas : moins d’offres', 'ناقص: عروض قليلة'] : ['Generous', 'Généreux', 'مزيان بزاف'])}</span></div>
          <div className="row" style={{ justifyContent: 'center', gap: 18, margin: '14px 0 10px' }} dir="ltr">
            <button className="iconbtn" style={{ width: 54, height: 54 }} aria-label="minus" onClick={() => setPrice(price - 10)}><Minus size={22} /></button>
            <div className="price center" style={{ fontSize: 38, minWidth: 150 }} data-testid="my-price">{dh(price, lang)}</div>
            <button className="iconbtn" style={{ width: 54, height: 54, background: 'var(--accent)', color: 'var(--accent-ink)', borderColor: 'transparent' }} aria-label="plus" onClick={() => setPrice(price + 10)}><Plus size={22} /></button>
          </div>
          <div style={{ position: 'relative', height: 10, borderRadius: 9, background: 'linear-gradient(90deg, var(--warn-soft), var(--ok-soft) 35%, var(--ok-soft) 65%, var(--info-soft))', margin: '6px 4px 4px' }} dir="ltr">
            <span style={{ position: 'absolute', top: -5, left: `calc(${pos * 100}% - 10px)`, width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', border: '3px solid var(--surface)', boxShadow: 'var(--shadow)', transition: 'left .25s' }} />
          </div>
          <div className="between tiny" dir="ltr"><span>{q.fair.low}</span><span>{q.fair.high}</span></div>
          <p className="small" style={{ marginTop: 10 }}>{t('driversMay')}</p>
        </div>

        <div className="sect">{t('reqTitle')}</div>
        <div className="list fade-up d2">
          <Row icon={<Package size={18} />} title={dr.items.map((i) => `${i.qty > 1 ? i.qty + '× ' : ''}${p(i.name)}`).join(', ')} sub={`${t('total', { kg: num(q.kg) })} · ${p(v.name)}`} />
          <Row icon={<MapPin size={18} />} title={`${p(placeById(dr.from).name)} → ${p(placeById(dr.to).name)}`} sub={`${q.km} ${t('km')} · ${q.min} ${t('min')}`} />
          <Row icon={<Clock size={18} />} title={dr.when === 'asap' ? t('asap') : `${t(dr.when)} · ${dr.time}`} />
          <Row icon={<Users size={18} />} title={dr.helpers === 0 ? t('helpers0') : dr.helpers === 1 ? t('helpers1') : t('helpersN', { n: dr.helpers })} sub={extras.join(' · ')} />
          <Row icon={<CreditCard size={18} />} title={t('payCash')} />
        </div>
      </div>
      <div className="foot">
        <button className="btn" onClick={() => { fx('send', 20); d({ t: 'draft', patch: { price } }); d({ t: 'publish' }); nav.reset('home', { name: 'offers' }); }} data-testid="find">
          <Truck size={20} /> {t('find')} · {dh(price, lang)}<span className="shine" />
        </button>
      </div>
    </Screen>
  );
}

// ---------------- Waiting for offers ----------------
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
        <TopBar transparent title="" onBack={() => nav.reset('home')} />
      </div>
      <div className="body" style={{ marginTop: -22, background: 'var(--bg)', borderRadius: '24px 24px 0 0', paddingTop: 16, position: 'relative' }}>
        <div className="between">
          <span className="badge acc" style={{ height: 26 }}><span className="dot live" /> {t('offLive')}</span>
          <span className="small num" dir="ltr">{p(placeById(r.from).name)} → {p(placeById(r.to).name)}</span>
        </div>
        <div className="between" style={{ marginTop: 10 }}>
          <div className="h2">{offers.length ? t(offers.length === 1 ? 'offCount1' : 'offCount', { n: offers.length }) : t('offSearching')}</div>
          <div className="price" style={{ fontSize: 18 }}>{dh(r.price, lang)}</div>
        </div>
        {!offers.length && (
          <div className="col" style={{ gap: 10, marginTop: 14 }}>
            {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 22 }} />)}
          </div>
        )}
        <div className="col" style={{ gap: 12, marginTop: 12 }}>
          {offers.map((o, i) => <OfferCard key={o.id} o={o} r={r} best={i === 0 && offers.length > 1} onDetail={() => setDetail(o)} onAccept={() => setAccepting(o)} />)}
        </div>
        <p className="small center" style={{ marginTop: 16 }}><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> {t('offNotBooked')}</p>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn ghost md" style={{ flex: 1 }} onClick={() => { setNewPrice(r.price + 20); setRaise(true); }}><Plus size={17} />{t('offRaise')}</button>
          <button className="btn danger md" style={{ flex: 1 }} onClick={() => { d({ t: 'cancelReq', reqId: r.id }); nav.reset('home'); }}>{t('offCancel')}</button>
        </div>
        <p className="tiny center" style={{ marginTop: 12 }}>{t('offSampleNote')}</p>
      </div>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? nm(driverById(detail.driverId), lang) : ''}>
        {detail && <DriverDetail o={detail} r={r} onContact={() => { setDetail(null); nav.push({ name: 'chat', arg: `${r.id}:${detail.driverId}` }); }} />}
      </Sheet>
      <Sheet open={!!accepting} onClose={() => setAccepting(null)} title={t('accept')}>
        {accepting && (
          <div className="col" style={{ gap: 14, paddingBottom: 6 }}>
            <div className="row"><Avatar d={driverById(accepting.driverId)} /><div className="grow"><div className="h3">{nm(driverById(accepting.driverId), lang)}</div><Rating v={driverById(accepting.driverId).rating} trips={driverById(accepting.driverId).trips} /></div><div className="price" style={{ fontSize: 26 }}>{dh(accepting.price, lang)}</div></div>
            <div className="list">
              <Row icon={<MapPin size={18} />} title={`${p(placeById(r.from).name)} → ${p(placeById(r.to).name)}`} sub={p(r.when)} />
              <Row icon={<Clock size={18} />} title={t('offArrive', { n: accepting.etaMin })} sub={accepting.helpers ? t('offHelpers') : t('offNoHelpers')} />
              <Row icon={<CreditCard size={18} />} title={t('cashAfter')} />
            </div>
            <p className="tiny">{t('negRule')}</p>
            <SlideToConfirm label={t('offSlide', { price: accepting.price })} onDone={() => { d({ t: 'acceptOffer', offerId: accepting.id, by: 'customer' }); setAccepting(null); }} />
          </div>
        )}
      </Sheet>
      <Sheet open={raise} onClose={() => setRaise(false)} title={t('offRaise')}>
        <div className="row" style={{ justifyContent: 'center', gap: 18, margin: '10px 0 18px' }} dir="ltr">
          <button className="iconbtn" style={{ width: 54, height: 54 }} onClick={() => setNewPrice(Math.max(r.price, newPrice - 10))}><Minus /></button>
          <div className="price center" style={{ fontSize: 36, minWidth: 140 }}>{dh(newPrice, lang)}</div>
          <button className="iconbtn" style={{ width: 54, height: 54 }} onClick={() => setNewPrice(newPrice + 10)}><Plus /></button>
        </div>
        <p className="small center" style={{ marginBottom: 14 }}>{t('fairRange', { low: r.fair.low, high: r.fair.high })}</p>
        <button className="btn" onClick={() => { fx('send'); d({ t: 'raisePrice', reqId: r.id, price: newPrice }); setRaise(false); }}>{t('save')} · {dh(newPrice, lang)}</button>
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
    <div className={`card offer ${best ? 'best' : ''}`} style={{ padding: 14 }} data-testid="offer">
      <button className="row" style={{ width: '100%', textAlign: 'start' }} onClick={() => { fx(); onDetail(); }}>
        <Avatar d={drv} />
        <div className="grow">
          <div className="row" style={{ gap: 6 }}><span className="h3 ellipsis">{nm(drv, lang)}</span>{best && <span className="badge acc">★</span>}</div>
          <Rating v={drv.rating} trips={drv.trips} />
        </div>
        <div style={{ textAlign: 'end' }}>
          <div className="price" style={{ fontSize: 24 }}>{dh(o.price, lang)}</div>
          <div className={`tiny`} style={{ color: diff < 0 ? 'var(--ok)' : diff > 0 ? 'var(--warn)' : 'var(--faint)', fontWeight: 700 }}>{diff < 0 ? t('offLess', { n: -diff }) : diff > 0 ? t('offMore', { n: diff }) : t('offSame')}</div>
        </div>
      </button>
      <div className="row" style={{ marginTop: 10, gap: 10 }}>
        <img src={v.img} alt="" style={{ width: 62, height: 40, objectFit: 'contain' }} />
        <div className="grow small">
          <div style={{ fontWeight: 650, color: 'var(--text)' }}>{p(v.name)} · <span dir="ltr">{drv.plate}</span></div>
          <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
            <span className="badge"><Clock size={11} />{t('offArrive', { n: o.etaMin })}</span>
            <span className={`badge ${o.helpers ? 'ok' : ''}`}><Users size={11} />{o.helpers ? t('offHelpers') : t('offNoHelpers')}</span>
            {r.shared && o.sharedOk && <span className="badge info"><Repeat size={11} />{t('shared')}</span>}
          </div>
        </div>
      </div>
      {o.turns.length > 1 && lastBy === 'driver' && <div className="small" style={{ marginTop: 10, color: 'var(--accent-text)', fontWeight: 700 }}><Sparkles size={13} style={{ verticalAlign: -2 }} /> {t('offTheyCounter', { name: firstName(drv, lang), price: o.price })}</div>}
      {waiting ? (
        <div className="row small" style={{ marginTop: 12, justifyContent: 'center', gap: 8 }}><span className="spin" style={{ width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />{t('offWaiting', { name: firstName(drv, lang) })}</div>
      ) : (
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <button className="btn ghost sm" aria-label={t('decline')} onClick={() => { fx(); d({ t: 'declineOffer', offerId: o.id }); }}><X size={17} /></button>
          <button className="btn ghost sm" aria-label={t('message')} onClick={() => nav.push({ name: 'chat', arg: `${r.id}:${o.driverId}` })}><MessageSquare size={17} /></button>
          <button className="btn soft sm" style={{ flex: 1 }} onClick={() => { fx(); nav.push({ name: 'negotiate', arg: o.id }); }}>{t('counter')}</button>
          <button className="btn sm" style={{ flex: 1.3 }} onClick={() => { fx(); onAccept(); }} data-testid="accept">{t('accept')}</button>
        </div>
      )}
    </div>
  );
}

function DriverDetail({ o, r, onContact }: { o: Offer; r: Req; onContact: () => void }) {
  const { t, p, lang } = useT();
  const drv = driverById(o.driverId);
  const v = VEHICLES[drv.vehicle];
  return (
    <div className="col" style={{ gap: 14, paddingBottom: 6 }}>
      <div className="row"><Avatar d={drv} size="lg" /><div className="grow"><Rating v={drv.rating} trips={drv.trips} /><div className="small">{drv.years} {p(['years on Xapp', 'ans sur Xapp', 'سنين فـ Xapp'])} · {drv.city}</div><span className="badge ok" style={{ marginTop: 4 }}><ShieldCheck size={11} />{t('dpVerified')}</span></div></div>
      <div className="card flat tight vehicle-card"><img src={v.img} alt="" /><div><div className="h3">{p(v.name)}</div><div className="small" dir="ltr">{drv.plate}</div><div className="small">{t('dpUpTo', { kg: num(v.maxKg) })}</div></div></div>
      <div className="list">
        <Row icon={<Star size={18} />} title={p(['“Careful with my fridge, on time.”', '« Soigneux avec mon frigo, ponctuel. »', '«حاضي مع التلاجة، وجا فالوقت.»'])} sub="Nadia · ★★★★★" />
        <Row icon={<Clock size={18} />} title={t('offArrive', { n: o.etaMin })} sub={o.helpers ? t('offHelpers') : t('offNoHelpers')} />
        <Row icon={<Truck size={18} />} title={dh(o.price, lang)} sub={`${p(placeById(r.from).name)} → ${p(placeById(r.to).name)}`} />
      </div>
      <button className="btn ghost md" onClick={onContact}><MessageSquare size={18} />{t('message')}</button>
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
  const [price, setPrice] = useState(o ? Math.round(((o.price + (r?.price ?? o.price)) / 2) / 10) * 10 : 0);
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
        <div className="row card tight"><Avatar d={drv} /><div className="grow"><div className="h3">{nm(drv, lang)}</div><Rating v={drv.rating} trips={drv.trips} /></div></div>
        <div className="bubble sys">{t('yourOffer')}: {dh(r.price, lang)}</div>
        {o.turns.map((tu, i) => (
          <div key={i} className={`bubble ${tu.by === 'customer' ? 'me' : 'them'}`} style={{ fontWeight: 750, fontSize: 17 }}>
            <div className="tiny" style={{ color: 'inherit', opacity: 0.75, fontWeight: 600 }}>{tu.by === 'customer' ? t('negYou') : first}</div>
            {dh(tu.price, lang)}
          </div>
        ))}
        {waiting && <div className="bubble them row small" style={{ gap: 8 }}><span className="spin" style={{ width: 12, height: 12, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />{t('offWaiting', { name: first })}</div>}
        <div className="card accent tight small" style={{ marginTop: 6 }}><ShieldCheck size={14} style={{ verticalAlign: -2 }} /> {t('negRule')}</div>
      </div>
      {!waiting && (
        <div className="foot" style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
          <div className="row" style={{ justifyContent: 'center', gap: 16 }} dir="ltr">
            <button className="iconbtn" onClick={() => { fx(); setPrice(Math.max(50, price - 10)); }}><Minus /></button>
            <div className="price center" style={{ fontSize: 32, minWidth: 130 }}>{dh(price, lang)}</div>
            <button className="iconbtn" onClick={() => { fx(); setPrice(price + 10); }}><Plus /></button>
          </div>
          <div className="chips" style={{ justifyContent: 'center' }}>
            {[r.price, Math.round((r.price + o.price) / 20) * 10, o.price].filter((x, i, a) => a.indexOf(x) === i).map((x) => <button key={x} className={`chip ${x === price ? 'on' : ''}`} onClick={() => setPrice(x)}>{dh(x, lang)}</button>)}
          </div>
          <div className="row">
            <button className="btn ghost md" style={{ flex: 1 }} onClick={() => { fx('success'); d({ t: 'acceptOffer', offerId: o.id, by: 'customer' }); }}>{t('negAccept', { price: o.price })}</button>
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
      <div className="body col" style={{ justifyContent: 'center', gap: 16, textAlign: 'center' }}>
        <CheckBurst />
        <div className="h1 fade-up d2">{t('bkTitle')}</div>
        <p className="sub fade-up d3">{t('bkSub', { name: firstName(drv, lang), price: r.booked!.price })}</p>
        <div className="card fade-up d4" style={{ textAlign: 'start' }}>
          <div className="row"><Avatar d={drv} size="lg" /><div className="grow"><div className="h3">{nm(drv, lang)}</div><Rating v={drv.rating} trips={drv.trips} /><div className="small">{p(VEHICLES[drv.vehicle].name)} · <span dir="ltr">{drv.plate}</span></div></div></div>
          <div className="divider" />
          <div className="between small"><span>{p(placeById(r.from).name)} → {p(placeById(r.to).name)}</span><span>{p(r.when)}</span></div>
          <div className="between" style={{ marginTop: 8 }}><span className="small">{t('agreed')}</span><span className="price" style={{ fontSize: 22 }}>{dh(r.booked!.price, lang)}</span></div>
          <div className="small" style={{ marginTop: 4 }}>{t('cashAfter')}</div>
        </div>
      </div>
      <div className="foot"><button className="btn" onClick={() => nav.replace({ name: 'track', arg: r.id })} data-testid="follow">{t('bkTrack')} <ArrowRight size={19} className="flip" /></button></div>
    </Screen>
  );
}

// ---------------- Live tracking ----------------
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
  const tn = t(`tn${r.stage}` as Key, { name: first, to: p(placeById(r.to).name) });
  return (
    <Screen>
      <div style={{ position: 'relative', flex: 'none' }}>
        <RouteMap from={r.from} to={r.to} height={290} progress={progress} live={r.stage === 4} radar={r.stage <= 1} />
        <TopBar transparent title="" onBack={() => nav.reset('home')} />
        {r.stage <= 1 && <span className="badge" style={{ position: 'absolute', bottom: 34, left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'var(--bg)', height: 28, fontSize: 13 }}><Truck size={13} /> {first} · {t('away', { n: eta ?? 5 })}</span>}
      </div>
      <div className="body" style={{ marginTop: -22, background: 'var(--bg)', borderRadius: '24px 24px 0 0', paddingTop: 18, position: 'relative' }}>
        <div className="between">
          <div className="grow">
            <div className="tiny" style={{ fontWeight: 700, color: 'var(--accent-text)' }}>{t(`st${r.stage}` as Key)}</div>
            <div className="h2" key={r.stage} style={{ animation: 'fadeUp .4s' }}>{tn}</div>
          </div>
          {eta !== null && <div className="center" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)', borderRadius: 16, padding: '8px 12px' }}><div className="price" style={{ fontSize: 22 }}>{eta}</div><div className="tiny" style={{ color: 'inherit' }}>{t('min')}</div></div>}
        </div>
        <div className="progress" style={{ margin: '14px 0 18px' }}><i style={{ width: `${(r.stage / 5) * 100}%` }} /></div>

        <div className="card tight row">
          <Avatar d={drv} />
          <div className="grow"><div className="h3">{nm(drv, lang)}</div><div className="small">{p(VEHICLES[drv.vehicle].name)} · <span dir="ltr">{drv.plate}</span></div></div>
          <button className="iconbtn" aria-label={t('call')}><Phone size={18} /></button>
          <button className="iconbtn" aria-label={t('message')} onClick={() => nav.push({ name: 'chat', arg: r.id })}><MessageSquare size={18} /></button>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="steps">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`step ${i < r.stage || r.stage === 5 ? 'done' : i === r.stage ? 'now' : ''}`}>
                <div className="b">{(i < r.stage || r.stage === 5) && <Check size={14} strokeWidth={3} />}</div>
                <div className="tt">{t(`st${i}` as Key)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card tight" style={{ marginTop: 12 }}>
          <div className="between"><span className="small">{t('agreed')}</span><span className="price" style={{ fontSize: 20 }}>{dh(r.booked.price, lang)}</span></div>
          <div className="tiny" style={{ marginTop: 4 }}>{t('cashAfter')} · {t('negRule')}</div>
        </div>
      </div>
      {r.stage === 5 && (
        <div className="foot"><button className="btn" onClick={() => nav.replace({ name: 'delivered', arg: r.id })} data-testid="confirm-delivery"><Check size={19} /> {t('dvConfirm')}</button></div>
      )}
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
  const done = !!r.confirmedAt;
  const tagKeys: Key[] = ['tagOnTime', 'tagCareful', 'tagFriendly', 'tagPro', 'tagComm'];
  if (done)
    return (
      <Screen>
        <Confetti />
        <div className="body col" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <CheckBurst />
          <div className="h1">{t('dvThanks')}</div>
          <p className="sub">{t('dvPaid', { price: r.booked!.price })}{r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}</p>
          {r.problem && <div className="card accent small"><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> {t('dvProblemSend')} ✓</div>}
        </div>
        <div className="foot"><button className="btn" onClick={() => { d({ t: 'resetDraft' }); nav.reset('home'); }}><Camera size={19} />{t('dvNew')}</button></div>
      </Screen>
    );
  return (
    <Screen>
      <TopBar title={t('st5')} onBack={() => nav.reset('home')} />
      <div className="body">
        <div className="center fade-up" style={{ marginTop: 4 }}><CheckBurst /></div>
        <div className="h2 center fade-up d1" style={{ marginTop: 16 }}>{t('dvTitle')}</div>
        <p className="sub center fade-up d2">{t('dvPaid', { price: r.booked!.price })}</p>
        {!!r.deliveryPhotos?.length && (
          <>
            <div className="sect">{t('dvPhotos')}</div>
            <div className="row" style={{ gap: 8 }}>{r.deliveryPhotos.map((ph, i) => <img key={i} src={ph} alt="" style={{ flex: 1, minWidth: 0, height: 96, objectFit: 'cover', borderRadius: 16 }} />)}</div>
            <p className="tiny" style={{ marginTop: 6 }}>{t('dvBy', { name: first })}</p>
          </>
        )}
        <div className="card fade-up d3" style={{ marginTop: 16 }}>
          <div className="h3 center">{t('dvRate', { name: first })}</div>
          <div style={{ margin: '12px 0' }}><Stars value={stars} onChange={setStars} /></div>
          {stars > 0 && (
            <div className="chips wrap fade-up" style={{ justifyContent: 'center' }}>
              {tagKeys.map((k) => <button key={k} className={`chip ${tags.includes(k) ? 'on' : ''}`} onClick={() => { fx(); setTags(tags.includes(k) ? tags.filter((x) => x !== k) : [...tags, k]); }}>{t(k)}</button>)}
            </div>
          )}
          <div className="field" style={{ marginTop: 12 }}><input value={fb} onChange={(e) => setFb(e.target.value)} placeholder={t('dvFb')} /></div>
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
  const tone = r.status === 'open' ? 'acc' : r.status === 'booked' ? 'info' : r.status === 'delivered' ? 'ok' : '';
  const go = () => nav.push(r.status === 'open' ? { name: 'offers', arg: r.id } : r.status === 'booked' ? { name: 'track', arg: r.id } : r.status === 'delivered' ? { name: 'delivered', arg: r.id } : { name: 'offers', arg: r.id });
  return (
    <button className="card tap tight" style={{ marginBottom: 10 }} onClick={r.status === 'cancelled' ? undefined : go}>
      <div className="row">
        {r.photos[0] ? <img src={r.photos[0]} alt="" style={{ width: 54, height: 54, borderRadius: 14, objectFit: 'cover' }} /> : <div className="ic" style={{ width: 54, height: 54, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--surface2)' }}><Package /></div>}
        <div className="grow">
          <div className="h3 ellipsis">{p(placeById(r.from).name)} → {p(placeById(r.to).name)}</div>
          <div className="small ellipsis">{r.items.map((i) => p(i.name)).join(', ')}</div>
          <div className="row" style={{ gap: 6, marginTop: 4 }}><span className={`badge ${tone}`}>{t(st as Key)}</span>{r.status === 'open' && <span className="tiny">{t(offersFor(s, r.id).length === 1 ? 'offCount1' : 'offCount', { n: offersFor(s, r.id).length })}</span>}</div>
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
  const mine = s.reqs.filter((r) => r.mine);
  const list = mine.filter((r) => (tab === 'a' ? r.status === 'open' || r.status === 'booked' : r.status === 'delivered' || r.status === 'cancelled'));
  return (
    <Screen>
      <div className="topbar"><h2 style={{ textAlign: 'start', fontSize: 24, paddingInlineStart: 6 }}>{t('tRequests')}</h2></div>
      <div className="body">
        <Seg value={tab} options={[['a', t('rqActive')], ['p', t('rqPast')]]} onChange={setTab} />
        <div style={{ height: 14 }} />
        {list.map((r) => <ReqRow key={r.id} r={r} />)}
        {!list.length && <Empty title={t('rqEmpty')} sub={t('rqEmptySub')} action={<button className="btn sm" onClick={() => { d({ t: 'resetDraft' }); nav.reset('home', { name: 'capture' }); }}><Camera size={17} />{t('cCam')}</button>} />}
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
      <div className="topbar"><h2 style={{ textAlign: 'start', fontSize: 24, paddingInlineStart: 6 }}>{t('tMessages')}</h2></div>
      <div className="body">
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
        {!keys.length && <p className="small center" style={{ marginTop: 18 }}>{t('chatsEmpty')}</p>}
      </div>
    </Screen>
  );
}

function CProfile() {
  const { s } = useApp();
  const { t, p } = useT();
  const nav = useNav();
  const mine = s.reqs.filter((r) => r.mine);
  return (
    <Screen>
      <div className="body">
        <div className="card hero" style={{ marginTop: 6, border: 0, borderRadius: 28, padding: 20 }}>
          <div className="row">
            <div className="av lg" style={{ background: 'rgba(255,255,255,.22)' }}>{CUSTOMER.initials}</div>
            <div className="grow"><div className="h2" style={{ color: '#fff' }}>{CUSTOMER.name}</div><div className="small" dir="ltr">{CUSTOMER.phone}</div></div>
          </div>
          <div className="row" style={{ marginTop: 16, gap: 10 }}>
            <div className="grow"><div className="price" style={{ fontSize: 22 }}>{mine.length}</div><div className="small">{t('tRequests')}</div></div>
            <div className="grow"><div className="price" style={{ fontSize: 22 }}>{mine.filter((r) => r.status === 'delivered').length}</div><div className="small">{t('sDelivered')}</div></div>
          </div>
        </div>
        <div className="sect">{t('setAccount')}</div>
        <div className="list">
          <Row icon={<Bookmark size={18} />} title={t('savedPlaces')} sub={`${p(placeById('maarif').name)} · ${p(placeById('gauthier').name)}`} />
          <Row icon={<CreditCard size={18} />} title={t('payMethod')} sub={t('payMethodSub')} />
          <Row icon={<Settings size={18} />} title={t('settings')} sub={`${s.lang === 'ar' ? 'العربية' : s.lang === 'fr' ? 'Français' : 'English'} · ${t(s.theme)}`} onClick={() => nav.push({ name: 'settings' })} />
          <Row icon={<Headphones size={18} />} title={t('support')} onClick={() => nav.push({ name: 'chat', arg: 'support' })} />
        </div>
        <div className="sect">{t('setMode')}</div>
        <ModeSwitch />
        <div className="list" style={{ marginTop: 12 }}><AdminLink /></div>
        <p className="tiny center" style={{ marginTop: 16 }}><Weight size={11} style={{ verticalAlign: -1 }} /> {t('recNote')}</p>
      </div>
    </Screen>
  );
}

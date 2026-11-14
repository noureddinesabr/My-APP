import { useEffect, useRef, useState } from 'react';
import {
  Home, Route as RouteIcon, Wallet, User, Mic, MapPin, Clock, Users, Package, Bookmark, BookmarkCheck, MessageSquare, Navigation, Phone, Check, Minus, Plus, ArrowRight, Send, Keyboard, Volume2, VolumeX,
  FileText, ShieldCheck, Camera, Settings, Sparkles, Truck, Repeat, Layers, CornerDownLeft, Receipt, MessageCircle, Languages, X, Lightbulb, Headphones, Info,
} from 'lucide-react';
import { INVOICES, ME, PLACES, placeById, VEHICLES, WEEK_TRIPS, DAY_BARS, type L3 } from './data';
import { isReturn, kgOf, myActiveTrip, myOffer, myTrips, onRoute, openLoads, useApp, type Req, type Stage, type VoiceLang } from './store';
import { dh, num, useT, type Key } from './i18n';
import { Avatar, CheckBurst, Confetti, Empty, RouteMap, Row, Screen, Seg, Sheet, SlideToConfirm, Switch, Toasts, TopBar, useFx, useNav, useNow } from './ui';
import { AdminLink, ChatScreen, ModeSwitch, SettingsScreen } from './common';
import { answer, earnings, LANG_LABEL, loadsFor, parse, speechLang, SUGGEST } from './voice';
import { canListen, listen, realVoice, speak, stopSpeaking } from './claude';
import { sfx } from './sound';

// ======================================================================
export function DriverApp() {
  const nav = useNav();
  const r = nav.route;
  let view;
  if (r) {
    view =
      r.name === 'load' ? <LoadDetail id={r.arg!} /> :
      r.name === 'offer' ? <OfferPrice id={r.arg!} /> :
      r.name === 'voice' ? <Voice /> :
      r.name === 'trip' ? <DTrip id={r.arg!} /> :
      r.name === 'chat' ? <ChatScreen chatKey={r.arg!} me="driver" /> :
      r.name === 'settings' ? <SettingsScreen /> : null;
  } else view = nav.tab === 'home' ? <DHome /> : nav.tab === 'trips' ? <DTrips /> : nav.tab === 'earnings' ? <Earnings /> : nav.tab === 'chats' ? <DChats /> : <DProfile />;
  return (
    <>
      {view}
      {!r && <DTabs />}
      <Toasts role="driver" />
    </>
  );
}

function DTabs() {
  const nav = useNav();
  const { s } = useApp();
  const { t } = useT();
  const fx = useFx();
  const waiting = s.offers.filter((o) => o.driverId === 'me' && o.awaiting === 'driver' && o.status === 'countered').length;
  const tabs: [string, Key, typeof Home, number][] = [['home', 'tHome', Home, 0], ['trips', 'tTrips', RouteIcon, waiting], ['chats', 'tChats', MessageCircle, 0], ['earnings', 'tEarnings', Wallet, 0], ['profile', 'tProfile', User, 0]];
  return (
    <div className="tabbar">
      {tabs.map(([id, k, I, n], i) => (
        <span key={id} style={{ display: 'contents' }}>
          {i === 2 && (
            <button className="tab-voice" aria-label={t('dAsk')} onClick={() => { fx('voice'); nav.push({ name: 'voice' }); }} data-testid="voice-fab">
              <span className="voicefab-m" style={{ width: 54, height: 54 }}><Mic size={24} /></span>
            </button>
          )}
          <button className={nav.tab === id ? 'on' : ''} onClick={() => { fx(); nav.setTab(id); }}>
            <span className="pill"><I size={21} strokeWidth={nav.tab === id ? 2.4 : 2} />{n > 0 && <span className="count">{n}</span>}</span>
            {t(k)}
          </button>
        </span>
      ))}
    </div>
  );
}

// ---------------- Home ----------------
type Filter = 'all' | 'near' | 'route' | 'return' | 'shared';
function DHome() {
  const { s, d } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const [f, setF] = useState<Filter>('all');
  const [plan, setPlan] = useState(false);
  const trip = myActiveTrip(s);
  const loads = openLoads(s);
  const list = (f === 'all' ? loads : f === 'near' ? loads.filter((r) => placeById(r.from).cx !== undefined) : f === 'route' ? loads.filter((r) => onRoute(s, r)) : f === 'return' ? loads.filter((r) => isReturn(s, r)) : loads.filter((r) => r.shared)).sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || b.createdAt - a.createdAt);
  const routeN = loads.filter((r) => onRoute(s, r)).length;
  const e = earnings(s);
  const counts: Record<Filter, number> = { all: loads.length, near: loads.filter((r) => placeById(r.from).cx !== undefined).length, route: routeN, return: loads.filter((r) => isReturn(s, r)).length, shared: loads.filter((r) => r.shared).length };
  return (
    <Screen>
      <div className="body flush">
        <div className="hero" style={{ padding: '10px 18px 22px', borderRadius: '0 0 30px 30px' }}>
          <div className="between">
            <div className="row">
              <Avatar d={ME} />
              <div><div className="small" style={{ fontWeight: 650 }}>{t('dHello')}</div><div className="h3" style={{ color: '#fff' }}>{p(VEHICLES[ME.vehicle].name)}</div></div>
            </div>
            <div className="online-pill" data-testid="online">
              <span style={{ fontSize: 14 }}>{s.driverOnline ? t('online') : t('offline')}</span>
              <Switch on={s.driverOnline} onChange={(v) => { d({ t: 'set', patch: { driverOnline: v } }); sfx(v ? 'success' : 'step', s.sound); }} />
            </div>
          </div>
          <div className="small" style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>{s.driverOnline && <span className="dot live" />}{s.driverOnline ? t('dVisible') : t('dHidden')}</div>
          <div className="row" style={{ marginTop: 16, gap: 10, position: 'relative', zIndex: 1 }}>
            <div className="grow" style={{ background: 'rgba(255,255,255,.14)', borderRadius: 18, padding: '12px 14px' }}>
              <div className="small">{t('dEarnToday')}</div>
              <div className="price" style={{ fontSize: 26 }}>{dh(e.today, lang)}</div>
            </div>
            <button className="grow" style={{ background: 'rgba(255,255,255,.14)', borderRadius: 18, padding: '12px 14px', textAlign: 'start', color: '#fff' }} onClick={() => { fx(); setPlan(true); }} data-testid="plan">
              <div className="small">{t('dYourTrip')}</div>
              {s.plan ? <div className="h3 ellipsis" style={{ color: '#fff' }}>{p(placeById(s.plan.from).name).split(' ·')[0]} → {p(placeById(s.plan.to).name)}</div> : <div className="h3" style={{ color: '#fff' }}>{t('dAnnounce')}</div>}
              {s.plan && <div className="tiny" style={{ color: 'rgba(255,255,255,.8)' }}>{p(s.plan.depart)} · {t('dOnRoute', { n: routeN })}</div>}
            </button>
          </div>
          <button className="row" style={{ marginTop: 10, width: '100%', background: '#0a0f0d', color: '#fff', borderRadius: 18, padding: '10px 14px', gap: 12, position: 'relative', zIndex: 1, textAlign: 'start' }} onClick={() => { fx('voice'); nav.push({ name: 'voice' }); }} data-testid="voice-entry">
            <span className="voicefab-m"><Mic size={20} /></span>
            <span className="grow"><b style={{ fontSize: 15 }}>{t('dAsk')}</b><div className="tiny" style={{ color: 'rgba(255,255,255,.65)' }}>{t('dAskHint')}</div></span>
            <span className="wave on" style={{ height: 24, gap: 3 }}>{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ width: 3 }} />)}</span>
          </button>
        </div>

        <div style={{ padding: '0 18px 110px' }}>
          {trip && (
            <button className="card tap fade-up" style={{ marginTop: 14, borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent), var(--shadow)' }} onClick={() => nav.push({ name: 'trip', arg: trip.id })} data-testid="active-trip">
              <div className="between"><span className="badge acc"><span className="dot live" />{t('dActive')} · {t(`st${trip.stage}` as Key)}</span><span className="price" style={{ fontSize: 18 }}>{dh(trip.booked!.price, lang)}</span></div>
              <div className="row" style={{ marginTop: 10 }}>
                <div className="grow"><div className="h3">{p(placeById(trip.from).name)} → {p(placeById(trip.to).name)}</div><div className="small">{trip.customer} · {p(trip.when)}</div></div>
                <ArrowRight className="flip" color="var(--accent)" />
              </div>
            </button>
          )}
          <div className="chips" style={{ marginTop: 16 }}>
            {([['all', 'fAll'], ['near', 'fNear'], ['route', 'fRoute'], ['return', 'fReturn'], ['shared', 'fShared']] as [Filter, Key][]).map(([id, k]) => (
              <button key={id} className={`chip ${f === id ? 'on' : ''}`} onClick={() => { fx(); setF(id); }} data-testid={`f-${id}`}>
                {id === 'route' ? <RouteIcon size={14} /> : id === 'return' ? <CornerDownLeft size={14} /> : id === 'shared' ? <Layers size={14} /> : id === 'near' ? <MapPin size={14} /> : <Sparkles size={14} />}
                {t(k)} <span style={{ opacity: 0.65 }}>{counts[id]}</span>
              </button>
            ))}
          </div>
          {!s.driverOnline ? (
            <Empty icon={<Truck size={34} />} title={t('dOffline')} sub={t('dHidden')} action={<button className="btn sm" onClick={() => d({ t: 'set', patch: { driverOnline: true } })}>{t('online')}</button>} />
          ) : (
            <div className="col" style={{ gap: 10, marginTop: 12 }}>
              {list.map((r, i) => <LoadCard key={r.id} r={r} i={i} />)}
              {!list.length && <Empty title={t('dNothing')} sub={t('dNothingSub')} />}
            </div>
          )}
        </div>
      </div>
      <PlanSheet open={plan} onClose={() => setPlan(false)} />
    </Screen>
  );
}

function LoadCard({ r, i }: { r: Req; i: number }) {
  const { s } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const mine = myOffer(s, r.id);
  const tags: [Key, string][] = [];
  if (r.mine) tags.push(['tagNew', 'acc']);
  if (onRoute(s, r)) tags.push(['tagRoute', 'ok']);
  if (isReturn(s, r)) tags.push(['tagReturn', 'info']);
  if (r.shared) tags.push(['tagShared', '']);
  return (
    <button className="card tap tight load" style={{ animationDelay: `${i * 0.05}s`, ...(r.mine ? { borderColor: 'var(--accent)' } : {}) }} onClick={() => nav.push({ name: 'load', arg: r.id })} data-testid="load">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {r.photos[0] ? <img className="ph" src={r.photos[0]} alt="" /> : <div className="ph" style={{ display: 'grid', placeItems: 'center', background: 'var(--surface2)' }}><Package /></div>}
        <div className="grow route-mini">
          <div className="row" style={{ gap: 8 }}><span className="rdot" /><b className="ellipsis">{p(placeById(r.from).name)}</b></div>
          <div className="row" style={{ gap: 8 }}><span className="rdot end" /><b className="ellipsis">{p(placeById(r.to).name)}</b></div>
          <div className="small ellipsis">{r.km} {t('km')} · {p(r.when)} · ≈{num(kgOf(r))} {t('kg')}</div>
        </div>
        <div style={{ textAlign: 'end' }}>
          <div className="price" style={{ fontSize: 21 }}>{dh(r.price, lang)}</div>
          {r.helpers > 0 && <div className="tiny"><Users size={11} style={{ verticalAlign: -1 }} /> {r.helpers}</div>}
        </div>
      </div>
      {(tags.length > 0 || mine) && (
        <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
          {tags.map(([k, tone]) => <span key={k} className={`badge ${tone}`}>{t(k)}</span>)}
          {mine && <span className="badge warn">{mine.awaiting === 'driver' ? t('ldTheyCounter', { price: mine.price }) : t('ldSent', { price: mine.price })}</span>}
          {r.savedByMe && <span className="badge"><BookmarkCheck size={11} /></span>}
        </div>
      )}
    </button>
  );
}

function PlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { s, d } = useApp();
  const { t, p } = useT();
  const fx = useFx();
  const cities = PLACES.filter((x) => x.cx === undefined || x.id === 'maarif');
  const [from, setFrom] = useState(s.plan?.from ?? 'maarif');
  const [to, setTo] = useState(s.plan?.to ?? 'agadir');
  const [dep, setDep] = useState(0);
  const deps: L3[] = [['Today 18:00', "Aujourd'hui 18:00", 'اليوم 18:00'], ['Tomorrow 07:00', 'Demain 07:00', 'غدا 07:00'], ['Sunday 08:00', 'Dimanche 08:00', 'الحد 08:00']];
  return (
    <Sheet open={open} onClose={onClose} title={t('dAnnounce')}>
      <p className="small" style={{ marginBottom: 12 }}>{t('dAnnounceSub')}</p>
      <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>{t('fromL')}</div>
      <div className="chips wrap">{cities.map((c) => <button key={c.id} className={`chip ${from === c.id ? 'on' : ''}`} onClick={() => setFrom(c.id)}>{p(c.city)}</button>)}</div>
      <div className="small" style={{ fontWeight: 700, margin: '14px 0 6px' }}>{t('toL')}</div>
      <div className="chips wrap">{cities.filter((c) => c.id !== from).map((c) => <button key={c.id} className={`chip ${to === c.id ? 'on' : ''}`} onClick={() => setTo(c.id)}>{p(c.city)}</button>)}</div>
      <div className="small" style={{ fontWeight: 700, margin: '14px 0 6px' }}>{t('secWhen')}</div>
      <div className="chips wrap">{deps.map((x, i) => <button key={i} className={`chip ${dep === i ? 'on' : ''}`} onClick={() => setDep(i)}>{p(x)}</button>)}</div>
      <div style={{ marginTop: 14, borderRadius: 18, overflow: 'hidden' }}><RouteMap from={from} to={to} height={150} /></div>
      <div className="row" style={{ marginTop: 14 }}>
        {s.plan && <button className="btn ghost md" style={{ flex: 1 }} onClick={() => { d({ t: 'set', patch: { plan: null } }); onClose(); }}><X size={17} /></button>}
        <button className="btn md" style={{ flex: 4 }} onClick={() => { fx('success'); d({ t: 'set', patch: { plan: { from, to, depart: deps[dep], back: null } } }); onClose(); }}>{t('save')}</button>
      </div>
    </Sheet>
  );
}

// ---------------- Load details ----------------
function LoadDetail({ id }: { id: string }) {
  const { s, d } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const r = s.reqs.find((x) => x.id === id);
  const [asked, setAsked] = useState(false);
  const [ph, setPh] = useState(0);
  if (!r) return null;
  const mine = myOffer(s, r.id);
  const bookedMine = r.booked?.driverId === 'me';
  const pct = Math.round(s.commission * 100);
  const v = VEHICLES[r.vehicle];
  const flags = [r.fragile && t('fragile'), r.heavy && t('heavy'), r.cover && t('cover'), r.shared && t('shared')].filter(Boolean) as string[];
  const floorTxt = (f: Req['floors']['pickup']) => (f.floor ? `${t('floor')} ${f.floor} · ${t('lift')}: ${f.lift === 'yes' ? t('yes') : f.lift === 'no' ? t('no') : '?'}` : t('ground'));
  return (
    <Screen>
      <div style={{ position: 'relative', flex: 'none' }}>
        {r.photos.length ? <img src={r.photos[ph]} alt="" style={{ width: '100%', height: 220, objectFit: 'cover' }} /> : <RouteMap from={r.from} to={r.to} height={220} />}
        <TopBar transparent title="" right={<button className="iconbtn glass" aria-label={t('ldSave')} onClick={() => { fx(); d({ t: 'save', reqId: r.id }); }}>{r.savedByMe ? <BookmarkCheck size={19} /> : <Bookmark size={19} />}</button>} />
        {r.photos.length > 1 && <div className="row" style={{ position: 'absolute', bottom: 12, insetInlineStart: 12, gap: 6 }}>{r.photos.map((_, i) => <button key={i} onClick={() => setPh(i)} style={{ width: i === ph ? 22 : 8, height: 8, borderRadius: 9, background: '#fff', opacity: i === ph ? 1 : 0.6, transition: 'all .2s' }} />)}</div>}
      </div>
      <div className="body" style={{ paddingTop: 16 }}>
        <div className="between">
          <div><div className="small">{t('ldProposed')}</div><div className="price" style={{ fontSize: 34 }}>{dh(r.price, lang)}</div></div>
          <div style={{ textAlign: 'end' }}><div className="tiny">{t('fair')}</div><div className="small num" style={{ fontWeight: 700, color: 'var(--text)' }}>{r.fair.low}–{r.fair.high}</div></div>
        </div>
        <div className="small" style={{ marginTop: 4, color: 'var(--accent-text)', fontWeight: 650 }}>{t('ldKeep', { net: Math.round(r.price * (1 - s.commission)), pct })}</div>

        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 14 }}>
          <RouteMap from={r.from} to={r.to} height={130} />
          <div style={{ padding: 14 }}>
            <div className="row" style={{ gap: 8 }}><span className="rdot" /><b>{p(placeById(r.from).name)}</b><span className="tiny">· {floorTxt(r.floors.pickup)}</span></div>
            <div className="rline" />
            <div className="row" style={{ gap: 8 }}><span className="rdot end" /><b>{p(placeById(r.to).name)}</b><span className="tiny">· {floorTxt(r.floors.dropoff)}</span></div>
            <div className="small" style={{ marginTop: 8 }}>{r.km} {t('km')} · {r.min} {t('min')} · {p(r.when)}</div>
          </div>
        </div>

        <div className="sect">{t('ldCargo')}</div>
        <div className="list">
          {r.items.map((it) => <Row key={it.id} icon={<Package size={17} />} title={`${it.qty > 1 ? it.qty + ' × ' : ''}${p(it.name)}`} sub={t('each', { kg: it.kg })} />)}
          <Row icon={<Info size={17} />} title={t('ldWeight', { kg: num(kgOf(r)) })} sub={`${t('ldVehicle')}: ${p(v.name)}`} />
          <Row icon={<Users size={17} />} title={t('ldHelpers')} sub={r.helpers ? t('ldHelpersN', { n: r.helpers }) : t('ldNone')} />
          {flags.length > 0 && <Row icon={<Sparkles size={17} />} title={flags.join(' · ')} sub={r.shared ? t('sharedInfo') : undefined} />}
          {r.notes && <Row icon={<MessageSquare size={17} />} title={r.notes} />}
        </div>
        <div className="small" style={{ marginTop: 12 }}>{r.customer} · {r.mine ? t('tagMine') : t('sample')}</div>
        {asked && <div className="card accent tight small fade-up" style={{ marginTop: 10 }}><Check size={14} style={{ verticalAlign: -2 }} /> {t('ldQuestionSent')}</div>}
      </div>
      <div className="foot">
        {bookedMine ? (
          <>
            <div className="card accent tight center fade-up" style={{ fontWeight: 750 }}><Check size={16} style={{ verticalAlign: -3 }} /> {t('ldBooked')}</div>
            <button className="btn" onClick={() => nav.replace({ name: 'trip', arg: r.id })}>{t('ldGoTrip')} <ArrowRight className="flip" size={19} /></button>
          </>
        ) : r.status !== 'open' ? (
          <div className="card flat tight center small">{t('sBooked')}</div>
        ) : mine ? (
          mine.awaiting === 'driver' ? (
            <>
              <div className="center h3">{t('ldTheyCounter', { price: mine.price })}</div>
              <div className="row">
                <button className="btn ghost md" style={{ flex: 1 }} onClick={() => nav.push({ name: 'offer', arg: r.id })}>{t('counter')}</button>
                <button className="btn md" style={{ flex: 1 }} onClick={() => { fx('success'); d({ t: 'acceptOffer', offerId: mine.id, by: 'driver' }); }}>{t('ldAccept', { price: mine.price })}</button>
              </div>
            </>
          ) : (
            <>
              <div className="row small" style={{ justifyContent: 'center', gap: 8 }}><span className="spin" style={{ width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%' }} />{t('ldSent', { price: mine.price })}</div>
              <div className="row">
                <button className="btn ghost md" style={{ flex: 1 }} onClick={() => d({ t: 'declineOffer', offerId: mine.id })}>{t('cancel')}</button>
                <button className="btn soft md" style={{ flex: 1 }} onClick={() => nav.push({ name: 'offer', arg: r.id })}>{t('edit')}</button>
              </div>
            </>
          )
        ) : (
          <>
            <button className="btn" onClick={() => { fx('send', 20); d({ t: 'offer', reqId: r.id, driverId: 'me', price: r.price, etaMin: 15 }); }} data-testid="accept-load">{t('ldAccept', { price: r.price })}</button>
            <div className="row">
              <button className="btn soft md" style={{ flex: 1.4 }} onClick={() => nav.push({ name: 'offer', arg: r.id })} data-testid="other-price">{t('ldOffer')}</button>
              <button className="btn ghost md" style={{ flex: 1 }} onClick={() => { setAsked(true); nav.push({ name: 'chat', arg: `${r.id}:me` }); }}><MessageSquare size={17} />{t('ldAsk')}</button>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}

function OfferPrice({ id }: { id: string }) {
  const { s, d } = useApp();
  const { t, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const r = s.reqs.find((x) => x.id === id)!;
  const mine = myOffer(s, r.id);
  const [price, setPrice] = useState(mine ? mine.price + 10 : Math.round((r.price * 1.12) / 10) * 10);
  const fee = Math.round(price * s.commission);
  return (
    <Screen>
      <TopBar title={t('ofTitle')} />
      <div className="body col" style={{ gap: 16, paddingTop: 20 }}>
        <p className="sub center">{t('ofSub')}</p>
        <div className="row" style={{ justifyContent: 'center', gap: 18 }} dir="ltr">
          <button className="iconbtn" style={{ width: 58, height: 58 }} onClick={() => { fx(); setPrice(Math.max(50, price - 10)); }}><Minus size={24} /></button>
          <div className="price center" style={{ fontSize: 44, minWidth: 160 }} data-testid="offer-price">{dh(price, lang)}</div>
          <button className="iconbtn" style={{ width: 58, height: 58, background: 'var(--accent)', color: 'var(--accent-ink)', borderColor: 'transparent' }} onClick={() => { fx(); setPrice(price + 10); }}><Plus size={24} /></button>
        </div>
        <div className="chips" style={{ justifyContent: 'center' }}>
          {[r.price, r.fair.mid, r.fair.high, r.fair.high + 50].filter((x, i, a) => a.indexOf(x) === i).map((x) => <button key={x} className={`chip ${x === price ? 'on' : ''}`} onClick={() => setPrice(x)}>{dh(x, lang)}</button>)}
        </div>
        <div className="card tight center small">{t('ofNet', { net: price - fee, fee })}</div>
        <div className="small center">{t('ldProposed')}: {dh(r.price, lang)} · {t('fair')}: {r.fair.low}–{r.fair.high}</div>
      </div>
      <div className="foot"><button className="btn" onClick={() => { fx('send', 20); d({ t: 'offer', reqId: r.id, driverId: 'me', price, etaMin: 15 }); nav.pop(); }} data-testid="send-offer">{t('ofSend', { price })}</button></div>
    </Screen>
  );
}

// ---------------- Voice assistant ----------------
type VState = 'idle' | 'listening' | 'thinking' | 'speaking';
function Voice() {
  const { s, d } = useApp();
  const { t, lang } = useT();
  const fx = useFx();
  const [st, setSt] = useState<VState>('idle');
  const [heard, setHeard] = useState('');
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [ideas, setIdeas] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const focus = useRef<string | null>(null);
  const lastList = useRef<string[]>([]);
  const sRef = useRef(s);
  sRef.current = s;
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [s.voice.length, heard]);
  useEffect(() => () => stopSpeaking(), []);
  const pending = [...s.voice].reverse().find((m) => m.confirm && !m.done);
  const vl = s.voiceLang;

  const reply = async (txt: string, confirm?: typeof pending extends undefined ? never : NonNullable<typeof pending>['confirm']) => {
    d({ t: 'voice', msg: { from: 'xapp', text: txt, confirm } });
    if (sRef.current.voiceRead) {
      setSt('speaking');
      await Promise.race([speak(txt, speechLang(vl)), new Promise((r) => setTimeout(r, Math.min(9000, 1200 + txt.length * 55)))]);
    }
    setSt('idle');
  };

  const run = (confirmId: string, yes: boolean) => {
    const m = sRef.current.voice.find((x) => x.id === confirmId);
    if (!m?.confirm || m.done) return;
    d({ t: 'voiceDone', id: m.id, cancelled: !yes });
    const c = m.confirm;
    const L = (en: string, fr: string, da: string, msa: string) => (vl === 'en' ? en : vl === 'fr' ? fr : vl === 'darija' ? da : msa);
    if (!yes) {
      sfx('step', s.sound);
      reply(L('OK, nothing sent.', 'D’accord, rien n’est envoyé.', 'واخا، ما صيفطنا والو.', 'حسناً، لم يُرسل شيء.'));
      return;
    }
    sfx('success', s.sound);
    if (c.kind === 'accept' || c.kind === 'counter') {
      d({ t: 'offer', reqId: c.reqId, driverId: 'me', price: c.price!, etaMin: 15 });
      reply(L(`Sent: ${c.price} dirhams. I will tell you when the customer answers.`, `Envoyé : ${c.price} dirhams. Je vous préviens dès que le client répond.`, `تصيفط: ${c.price} درهم. غادي نعلمك ملي يجاوب الزبون.`, `تم الإرسال: ${c.price} درهم. سأخبرك عندما يرد الزبون.`));
    } else if (c.kind === 'cancel') {
      const o = sRef.current.offers.find((x) => x.reqId === c.reqId && x.driverId === 'me' && x.status !== 'declined');
      if (o) d({ t: 'declineOffer', offerId: o.id });
      reply(L('Your offer is withdrawn.', 'Votre offre est retirée.', 'العرض ديالك تحيّد.', 'تم سحب عرضك.'));
    } else if (c.kind === 'stage' && c.stage !== undefined) {
      d({ t: 'stage', reqId: c.reqId, stage: c.stage });
      reply(L(`Done: ${c.label}. The customer is informed.`, `C’est fait : ${c.label}. Le client est prévenu.`, `صافي: ${c.label}. الزبون تعلم.`, `تم: ${c.label}. تم إبلاغ الزبون.`));
    }
  };

  const handle = (said: string) => {
    if (!said.trim()) { setSt('idle'); return; }
    d({ t: 'voice', msg: { from: 'me', text: said } });
    setSt('thinking');
    setTimeout(() => {
      const cur = sRef.current;
      const pend = [...cur.voice].reverse().find((m) => m.confirm && !m.done);
      const it = parse(said, !!pend);
      if ((it.k === 'yes' || it.k === 'no') && pend) { run(pend.id, it.k === 'yes'); return; }
      if (pend) d({ t: 'voiceDone', id: pend.id, cancelled: true });
      const a = answer(cur, it, focus.current, lastList.current);
      if (a.focus !== undefined) focus.current = a.focus;
      if (a.listIds) lastList.current = a.listIds;
      if (a.act?.t === 'online') d({ t: 'set', patch: { driverOnline: a.act.on } });
      reply(a.text, a.confirm);
    }, 650);
  };

  const mic = () => {
    stopSpeaking();
    if (st === 'listening') return;
    fx('voice', 15);
    if (!canListen()) { setIdeas(true); return; }
    setSt('listening');
    setHeard('');
    listen(speechLang(vl), setHeard).then((said) => { setHeard(''); handle(said); });
  };

  const sendText = (x: string) => { setText(''); setIdeas(false); fx('send'); handle(x); };
  const orbClass = st === 'listening' ? 'listening' : st === 'thinking' ? 'thinking' : st === 'speaking' ? 'speaking' : '';
  const statusTxt = st === 'listening' ? t('vaListening') : st === 'thinking' ? t('vaThinking') : st === 'speaking' ? t('vaSpeaking') : t('vaTap');
  const rtlVoice = vl === 'darija' || vl === 'msa';
  return (
    <Screen className="voice">
      <TopBar
        title={t('vaTitle')}
        right={<button className="iconbtn" aria-label="read aloud" onClick={() => { d({ t: 'set', patch: { voiceRead: !s.voiceRead } }); if (s.voiceRead) stopSpeaking(); }}>{s.voiceRead ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>}
      />
      <div className="row" style={{ justifyContent: 'center', gap: 8, padding: '0 16px 6px' }}>
        <button className="vchip" onClick={() => setLangOpen(true)} data-testid="voice-lang"><Languages size={15} />{LANG_LABEL[vl]}</button>
        <span className="vchip" style={{ opacity: 0.75 }}>{realVoice() ? t('vaReal') : canListen() ? t('vaReal') : t('vaSim')}</span>
      </div>
      <div className="body col" style={{ gap: 10, paddingTop: 8 }} dir={rtlVoice ? 'rtl' : 'ltr'}>
        {s.voice.length === 0 && (
          <div className="col fade-up" style={{ alignItems: 'center', textAlign: 'center', gap: 10, marginTop: 10 }}>
            <div className="h2" style={{ color: '#fff', fontSize: 23 }}>{vl === 'en' ? 'Salam Hamid. How can I help?' : vl === 'fr' ? 'Salam Hamid. Je vous écoute.' : vl === 'darija' ? 'السلام حميد. كيفاش نعاونك؟' : 'السلام عليكم حميد. كيف أساعدك؟'}</div>
            <p dir="auto" style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, margin: 0, maxWidth: 290 }}>{t('vaSafety')}</p>
          </div>
        )}
        {s.voice.map((m) => (
          <div key={m.id} className={`vm ${m.from === 'me' ? 'me' : 'x'}`}>
            {m.text}
            {m.confirm && (
              m.done ? <div style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7, fontWeight: 700 }}>{m.cancelled ? '✕' : '✓'} {m.confirm.label}</div> : (
                <div className="confirm">
                  <button className="n" onClick={() => run(m.id, false)}>{t('no')}</button>
                  <button className="y" onClick={() => run(m.id, true)} data-testid="voice-yes">{t('yes')} · {m.confirm.label.split('·').pop()}</button>
                </div>
              )
            )}
          </div>
        ))}
        {heard && <div className="vm me" style={{ opacity: 0.6 }}>{heard}…</div>}
        <div ref={endRef} />
      </div>
      <div style={{ flex: 'none', padding: '6px 16px 16px' }}>
        {pending && st === 'idle' && <div className="center" style={{ fontSize: 12.5, color: 'rgba(255,255,255,.6)', marginBottom: 8 }}>{t('vaSafety').split(':')[0]}</div>}
        <div className="col" style={{ alignItems: 'center', gap: 6 }}>
          <div className={`wave ${st === 'listening' || st === 'speaking' ? 'on' : ''}`}>{Array.from({ length: 14 }).map((_, i) => <i key={i} />)}</div>
          <button className={`orb ${orbClass}`} onClick={mic} aria-label={t('vaTap')} data-testid="mic" style={{ width: 112, height: 112 }}>
            <span className="ring" /><span className="ring" /><span className="ring" />
            <span className="core" style={{ width: 84, height: 84 }}><Mic size={34} /></span>
          </button>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#d1fae5' }}>{statusTxt}</div>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <button className="vchip" onClick={() => setIdeas(true)} data-testid="voice-ideas"><Lightbulb size={15} />{t('vaTry')}</button>
          {typing ? (
            <div className="vinput grow">
              <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t('vaTypePh')} onKeyDown={(e) => e.key === 'Enter' && text.trim() && sendText(text)} dir="auto" data-testid="voice-input" />
              <button className="send" style={{ width: 40, height: 40, background: '#34d399', color: '#022c22' }} onClick={() => text.trim() && sendText(text)} aria-label="send"><Send size={17} className="flip" /></button>
            </div>
          ) : (
            <button className="vchip grow" style={{ justifyContent: 'center' }} onClick={() => setTyping(true)} data-testid="voice-type"><Keyboard size={15} />{t('vaTypePh')}</button>
          )}
        </div>
      </div>

      <Sheet open={ideas} onClose={() => setIdeas(false)} dark title={t('vaTry')}>
        {!canListen() && <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.65)', marginTop: 0 }}>{t('vaNoMic')}</p>}
        <div className="col" style={{ gap: 8, paddingBottom: 6 }} dir={rtlVoice ? 'rtl' : 'ltr'}>
          {SUGGEST[vl].map((x) => <button key={x} className="vchip" style={{ height: 48, justifyContent: 'flex-start', fontSize: 15 }} onClick={() => sendText(x)}><Sparkles size={15} color="#34d399" />{x}</button>)}
        </div>
      </Sheet>
      <Sheet open={langOpen} onClose={() => setLangOpen(false)} dark title={t('setLang')}>
        <div className="col" style={{ gap: 8, paddingBottom: 6 }}>
          {(['darija', 'msa', 'fr', 'en'] as VoiceLang[]).map((l) => (
            <button key={l} className={`vchip ${vl === l ? 'on' : ''}`} style={{ height: 50, fontSize: 16, justifyContent: 'space-between' }} onClick={() => { d({ t: 'set', patch: { voiceLang: l } }); setLangOpen(false); }}>
              {LANG_LABEL[l]} {vl === l && <Check size={18} />}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,.55)' }}>{lang === 'ar' ? 'الصوت كيهضر بنفس اللغة اللي ختاريتي.' : lang === 'fr' ? 'La voix répond dans la langue choisie.' : 'The voice answers in the language you choose.'}</p>
      </Sheet>
    </Screen>
  );
}

// ---------------- Active trip ----------------
function DTrip({ id }: { id: string }) {
  const { s, d } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const fx = useFx();
  const r = s.reqs.find((x) => x.id === id);
  const now = useNow(500, !!r && r.stage === 4);
  if (!r || !r.booked) return null;
  const next = (r.stage + 1) as Stage;
  const net = Math.round(r.booked.price * (1 - s.commission));
  const progress = r.stage >= 5 ? 1 : r.stage === 4 ? Math.min(0.9, (now - r.stageAt) / 9000) : r.stage >= 2 ? 0 : undefined;
  const dest = r.stage >= 3 ? placeById(r.to) : placeById(r.from);
  if (r.stage === 5)
    return (
      <Screen>
        <Confetti />
        <div className="body col" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <CheckBurst />
          <div className="h2">{t('dtDone', { net })}</div>
          <p className="sub">{t('dtCollect', { price: r.booked.price })}</p>
          <div className="card" style={{ width: '100%', textAlign: 'start' }}>
            <div className="between small"><span>{t('erCash')}</span><b>{dh(r.booked.price, lang)}</b></div>
            <div className="between small" style={{ marginTop: 6 }}><span>{t('erComm', { pct: Math.round(s.commission * 100) })}</span><b>−{dh(r.booked.price - net, lang)}</b></div>
            <div className="divider" />
            <div className="between"><b>{t('erKeep')}</b><span className="price" style={{ fontSize: 22 }}>{dh(net, lang)}</span></div>
          </div>
        </div>
        <div className="foot"><button className="btn" onClick={() => nav.reset('home')}>{t('done')}</button></div>
      </Screen>
    );
  return (
    <Screen>
      <div style={{ position: 'relative', flex: 'none' }}>
        <RouteMap from={r.from} to={r.to} height={250} progress={progress} live={r.stage === 4} radar={r.stage < 2} />
        <TopBar transparent title="" />
        <a className="btn white sm" style={{ position: 'absolute', bottom: 30, insetInlineEnd: 14 }} href={`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`} target="_blank" rel="noreferrer"><Navigation size={16} />{t('navigate')}</a>
      </div>
      <div className="body" style={{ marginTop: -22, background: 'var(--bg)', borderRadius: '24px 24px 0 0', paddingTop: 18, position: 'relative' }}>
        <div className="tiny" style={{ fontWeight: 700, color: 'var(--accent-text)' }}>{t(`st${r.stage}` as Key)}</div>
        <div className="h2" key={r.stage} style={{ animation: 'fadeUp .4s' }}>{p((r.stage >= 3 ? placeById(r.to) : placeById(r.from)).name)}</div>
        <div className="small">{p(r.when)} · {r.km} {t('km')}</div>
        <div className="row" style={{ gap: 4, margin: '14px 0' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={{ flex: 1, height: 6, borderRadius: 9, background: i <= r.stage ? 'var(--accent)' : 'var(--line)', transition: 'background .4s' }} />)}
        </div>
        <div className="card tight row">
          <div className="av" style={{ background: 'linear-gradient(135deg,#f472b6,#c2410c)' }}>{r.customer.slice(0, 2).toUpperCase()}</div>
          <div className="grow"><div className="tiny">{t('dtCustomer')}</div><div className="h3">{r.customer}</div></div>
          <button className="iconbtn" aria-label={t('call')}><Phone size={18} /></button>
          <button className="iconbtn" aria-label={t('message')} onClick={() => nav.push({ name: 'chat', arg: r.id })}><MessageSquare size={18} /></button>
        </div>
        <div className="card tight" style={{ marginTop: 10 }}>
          <div className="between"><span className="h3">{t('dtCollect', { price: r.booked.price })}</span></div>
          <div className="tiny" style={{ marginTop: 4 }}>{t('ldKeep', { net, pct: Math.round(s.commission * 100) })}</div>
        </div>
        <div className="list" style={{ marginTop: 10 }}>
          {r.items.map((it) => <Row key={it.id} icon={<Package size={17} />} title={`${it.qty > 1 ? it.qty + ' × ' : ''}${p(it.name)}`} sub={t('each', { kg: it.kg })} />)}
          <Row icon={<Users size={17} />} title={t('ldHelpers')} sub={r.helpers ? t('ldHelpersN', { n: r.helpers }) : t('ldNone')} />
        </div>
        <p className="tiny center" style={{ marginTop: 12 }}>{t('negRule')}</p>
      </div>
      <div className="foot">
        <SlideToConfirm key={r.stage} label={t('slide', { label: t(`act${r.stage}` as Key) })} onDone={() => { d({ t: 'stage', reqId: r.id, stage: next }); sfx(next === 5 ? 'success' : 'step', s.sound); }} />
        <button className="link" style={{ margin: '0 auto' }} onClick={() => { fx(); nav.push({ name: 'voice' }); }}><Mic size={16} />{t('dAsk')}</button>
      </div>
    </Screen>
  );
}

// ---------------- Trips tab ----------------
function DTrips() {
  const { s } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const trips = myTrips(s);
  const active = trips.filter((r) => r.status === 'booked');
  const done = trips.filter((r) => r.status === 'delivered');
  const offers = s.offers.filter((o) => o.driverId === 'me' && (o.status === 'pending' || o.status === 'countered'));
  return (
    <Screen>
      <div className="topbar"><h2 style={{ textAlign: 'start', fontSize: 24, paddingInlineStart: 6 }}>{t('tTrips')}</h2></div>
      <div className="body">
        {active.length > 0 && <div className="sect" style={{ marginTop: 4 }}>{t('dtUpcoming')}</div>}
        {active.map((r) => (
          <button key={r.id} className="card tap tight" style={{ marginBottom: 10 }} onClick={() => nav.push({ name: 'trip', arg: r.id })}>
            <div className="between"><span className="badge acc"><span className="dot live" />{t(`st${r.stage}` as Key)}</span><span className="price">{dh(r.booked!.price, lang)}</span></div>
            <div className="h3" style={{ marginTop: 8 }}>{p(placeById(r.from).name)} → {p(placeById(r.to).name)}</div>
            <div className="small">{r.customer} · {p(r.when)}</div>
          </button>
        ))}
        {offers.length > 0 && <div className="sect">{t('dtWaiting')}</div>}
        {offers.map((o) => {
          const r = s.reqs.find((x) => x.id === o.reqId)!;
          return (
            <button key={o.id} className="card tap tight" style={{ marginBottom: 10 }} onClick={() => nav.push({ name: 'load', arg: r.id })}>
              <div className="between"><div className="h3 ellipsis">{p(placeById(r.from).name)} → {p(placeById(r.to).name)}</div><span className="price">{dh(o.price, lang)}</span></div>
              <span className={`badge ${o.awaiting === 'driver' ? 'warn' : ''}`} style={{ marginTop: 6 }}>{o.awaiting === 'driver' ? t('ldTheyCounter', { price: o.price }) : t('ldSent', { price: o.price })}</span>
            </button>
          );
        })}
        <div className="sect">{t('dtHistory')}</div>
        <div className="list">
          {done.map((r) => <Row key={r.id} icon={<Check size={17} />} title={`${p(placeById(r.from).name)} → ${p(placeById(r.to).name)}`} sub={t('sDelivered')} right={<b className="num">{dh(r.booked!.price, lang)}</b>} />)}
          {WEEK_TRIPS.slice().reverse().map((x, i) => <Row key={i} icon={<Check size={17} />} title={x.route} sub={p(x.day)} right={<b className="num">{dh(x.gross, lang)}</b>} />)}
        </div>
        {!active.length && !offers.length && <p className="small center" style={{ marginTop: 10 }}>{t('dtNoTripSub')}</p>}
      </div>
    </Screen>
  );
}

// ---------------- Earnings ----------------
function Earnings() {
  const { s } = useApp();
  const { t, p, lang } = useT();
  const [per, setPer] = useState<'d' | 'w' | 'm'>('w');
  const e = earnings(s);
  const pct = Math.round(s.commission * 100);
  const month = e.week + INVOICES.reduce((n, i) => n + i.gross, 0);
  const monthTrips = e.trips + INVOICES.reduce((n, i) => n + i.trips, 0);
  const gross = per === 'd' ? e.today : per === 'w' ? e.week : month;
  const trips = per === 'd' ? e.todayTrips : per === 'w' ? e.trips : monthTrips;
  const fee = Math.round(gross * s.commission);
  const bars = DAY_BARS.map((v, i) => (i === 5 ? v + e.today : v));
  const maxBar = Math.max(...bars, 1);
  const days: L3[] = [['M', 'L', 'ن'], ['T', 'M', 'ث'], ['W', 'M', 'ر'], ['T', 'J', 'خ'], ['F', 'V', 'ج'], ['S', 'S', 'س'], ['S', 'D', 'ح']];
  return (
    <Screen>
      <div className="topbar"><h2 style={{ textAlign: 'start', fontSize: 24, paddingInlineStart: 6 }}>{t('erTitle')}</h2></div>
      <div className="body">
        <Seg value={per} options={[['d', t('erToday')], ['w', t('erWeek')], ['m', t('erMonth')]]} onChange={setPer} />
        <div className="card hero" style={{ marginTop: 12, border: 0, borderRadius: 28, padding: 20 }}>
          <div className="small">{t('erKeep')}</div>
          <div className="price" style={{ fontSize: 40 }} data-testid="keep">{dh(gross - fee, lang)}</div>
          <div className="small">{t('erTrips', { n: trips })} · {t('erCash')} {dh(gross, lang)}</div>
          {per === 'w' && (
            <div className="bars" style={{ marginTop: 16, height: 100 }}>
              {bars.map((v, i) => (
                <div key={i}>
                  <i style={{ height: `${Math.max(4, (v / maxBar) * 100)}%`, background: i === 5 ? '#fff' : 'rgba(255,255,255,.35)', animationDelay: `${i * 0.05}s` }} />
                  <span className="tiny" style={{ color: 'rgba(255,255,255,.75)' }}>{p(days[i])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="list" style={{ marginTop: 12 }}>
          <Row icon={<Wallet size={18} />} title={t('erCash')} right={<b className="num">{dh(gross, lang)}</b>} />
          <Row icon={<Receipt size={18} />} title={t('erComm', { pct })} right={<b className="num" style={{ color: 'var(--warn)' }}>−{dh(fee, lang)}</b>} />
          <Row icon={<Check size={18} />} title={t('erKeep')} right={<b className="num" style={{ color: 'var(--ok)' }}>{dh(gross - fee, lang)}</b>} />
        </div>
        <div className="card accent" style={{ marginTop: 12 }}>
          <div className="between"><div><div className="h3">{t('erOutstanding')}</div><div className="small">{t('erDue')}</div></div><div className="price" style={{ fontSize: 22 }} data-testid="due">{dh(e.fee, lang)}</div></div>
          <div className="row small" style={{ gap: 6, marginTop: 8 }}><MessageCircle size={14} /> SMS · WhatsApp</div>
        </div>
        <div className="sect">{t('erInvoices')}</div>
        <div className="list">
          <Row icon={<FileText size={18} />} title="INV-2026-46" sub={`10–16 ${p(['Nov', 'nov.', 'نونبر'])} · ${t('erTrips', { n: e.trips })}`} right={<span className="badge warn">{t('erOpen')} · {dh(e.fee, lang)}</span>} />
          {INVOICES.map((i) => <Row key={i.id} icon={<FileText size={18} />} title={i.id} sub={`${p(i.period)} · ${t('erTrips', { n: i.trips })}`} right={<span className="badge ok">{t('erPaid')} · {dh(Math.round(i.gross * 0.1), lang)}</span>} />)}
        </div>
        <p className="tiny center" style={{ marginTop: 14 }}>{p(['No wallet: customers pay you cash, Xapp invoices its commission weekly.', 'Pas de portefeuille : les clients vous paient en espèces, Xapp facture sa commission chaque semaine.', 'ما كاينش بزطام: الزبناء كيخلصوك كاش، وXapp كتصيفط فاتورة العمولة كل سيمانة.'])}</p>
      </div>
    </Screen>
  );
}

// ---------------- Profile & vehicle ----------------
function DProfile() {
  const { s, d } = useApp();
  const { t, p } = useT();
  const nav = useNav();
  const [helpers, setHelpers] = useState(true);
  const [shared, setShared] = useState(true);
  const v = VEHICLES[ME.vehicle];
  const docs: [Key, string, typeof FileText][] = [['docLicense', 'license', FileText], ['docReg', 'reg', FileText], ['docIns', 'ins', ShieldCheck], ['docId', 'cin', User], ['docPhotos', 'photos', Camera]];
  const ok = (k: string) => k !== 'photos' || s.approvedDocs.includes('me:photos');
  return (
    <Screen>
      <div className="body">
        <div className="card hero" style={{ marginTop: 6, border: 0, borderRadius: 28, padding: 20 }}>
          <div className="row">
            <Avatar d={ME} size="lg" />
            <div className="grow">
              <div className="h2" style={{ color: '#fff' }}>{ME.name}</div>
              <div className="row small" style={{ gap: 6 }}>★ {ME.rating} · {t('offTrips', { n: ME.trips })} · {ME.years} {p(['yrs', 'ans', 'سنين'])}</div>
              <span className="badge glass" style={{ marginTop: 6 }}><ShieldCheck size={12} />{t('dpVerified')} · {t('dpCommitted')}</span>
            </div>
          </div>
        </div>
        <div className="sect">{t('dpVehicle')}</div>
        <div className="card vehicle-card"><img src={v.img} alt="" style={{ width: 110, height: 70 }} /><div className="grow"><div className="h3">{p(v.name)}</div><div className="small" dir="ltr" style={{ textAlign: 'start' }}>{ME.plate}</div><div className="small">{t('dpUpTo', { kg: num(v.maxKg) })}</div></div></div>
        <div className="sect">{t('dpDocs')}</div>
        <div className="list">
          {docs.map(([k, id, I]) => <Row key={id} icon={<I size={18} />} title={t(k)} right={<span className={`badge ${ok(id) ? 'ok' : 'warn'}`}>{ok(id) ? t('docOk') : t('docReview')}</span>} />)}
        </div>
        <div className="sect">{t('dpPrefs')}</div>
        <div className="list">
          <Row icon={<MapPin size={18} />} title={t('prefArea')} sub={t('prefAreaV')} />
          <Row icon={<Users size={18} />} title={t('prefHelpers')} right={<Switch on={helpers} onChange={setHelpers} />} />
          <Row icon={<Repeat size={18} />} title={t('prefShared')} right={<Switch on={shared} onChange={setShared} />} />
          <Row icon={<Settings size={18} />} title={t('settings')} onClick={() => nav.push({ name: 'settings' })} />
          <Row icon={<Headphones size={18} />} title={t('support')} onClick={() => nav.push({ name: 'chat', arg: 'support' })} />
        </div>
        <div className="sect">{t('setMode')}</div>
        <ModeSwitch />
        <div className="list" style={{ marginTop: 12 }}><AdminLink /></div>
        <button className="link" style={{ margin: '16px auto', display: 'flex' }} onClick={() => d({ t: 'set', patch: { driverOnline: !s.driverOnline } })}>{s.driverOnline ? t('offline') : t('online')}</button>
      </div>
    </Screen>
  );
}

// ---------------- Chats tab ----------------
function DChats() {
  const { s } = useApp();
  const { t, p } = useT();
  const nav = useNav();
  const keys = Array.from(new Set(s.chats.map((c) => c.reqId))).filter((k) => k !== 'support' && (k.endsWith(':me') || s.reqs.find((r) => r.id === k)?.booked?.driverId === 'me'));
  return (
    <Screen>
      <div className="topbar"><h2 style={{ textAlign: 'start', fontSize: 24, paddingInlineStart: 6 }}>{t('tChats')}</h2></div>
      <div className="body">
        <div className="list">
          {keys.map((k) => {
            const r = s.reqs.find((x) => x.id === k.split(':')[0])!;
            const last = s.chats.filter((c) => c.reqId === k).slice(-1)[0];
            return <Row key={k} icon={<div className="av sm" style={{ background: 'linear-gradient(135deg,#f472b6,#c2410c)' }}>{r.customer.slice(0, 2).toUpperCase()}</div>} title={`${r.customer} · ${p(placeById(r.from).name)} → ${p(placeById(r.to).name)}`} sub={last?.text} onClick={() => nav.push({ name: 'chat', arg: k })} />;
          })}
          <Row icon={<Headphones size={18} />} title={t('support')} sub={t('supportLast')} onClick={() => nav.push({ name: 'chat', arg: 'support' })} />
        </div>
      </div>
    </Screen>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  Home, Route as RouteIcon, Wallet, User, Mic, MapPin, Users, Package, Bookmark, BookmarkCheck, MessageSquare, Navigation, Phone, Check, Minus, Plus, Send, Keyboard, Volume2, VolumeX,
  FileText, ShieldCheck, Camera, Settings, Sparkles, Repeat, Layers, CornerDownLeft, Receipt, MessageCircle, Languages, X, Headphones, Info, ChevronRight, ArrowRight,
} from 'lucide-react';
import { INVOICES, ME, PLACES, placeById, VEHICLES, WEEK_TRIPS, DAY_BARS, type L3 } from './data';
import { isReturn, kgOf, myActiveTrip, myOffer, myTrips, onRoute, openLoads, useApp, type Req, type Stage, type VoiceLang, type VoiceMsg } from './store';
import { dh, num, useT, type Key } from './i18n';
import { AppHead, Avatar, BackBtn, Chips, Confetti, Empty, NavBar, RouteMap, Row, Screen, Sec, Sheet, SlideToConfirm, Switch, Toasts, TopBar, useFx, useNav, useNow } from './ui';
import { AdminLink, ChatScreen, ModeSwitch, SettingsScreen } from './common';
import { answer, earnings, LANG_LABEL, parse, speechLang, SUGGEST } from './voice';
import { canListen, listen, realVoice, speak, stopSpeaking } from './claude';
import { sfx } from './sound';
import { CashScene, DriverScene, ItemArt, RouteScene, VoiceScene } from './art';

// ======================================================================
export function DriverApp() {
  const nav = useNav();
  const { s } = useApp();
  const { t } = useT();
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
  const waiting = s.offers.filter((o) => o.driverId === 'me' && o.awaiting === 'driver' && o.status === 'countered').length;
  return (
    <>
      {view}
      {!r && (
        <NavBar
          items={[
            { id: 'home', icon: <Home size={22} strokeWidth={2.2} />, label: t('tHome') },
            { id: 'trips', icon: <RouteIcon size={22} strokeWidth={2.2} />, label: t('tTrips'), count: waiting },
            { id: 'chats', icon: <MessageCircle size={22} strokeWidth={2.2} />, label: t('tChats') },
            { id: 'earnings', icon: <Wallet size={22} strokeWidth={2.2} />, label: t('tEarnings') },
            { id: 'profile', icon: <User size={22} strokeWidth={2.2} />, label: t('tProfile') },
          ]}
          center={() => nav.push({ name: 'voice' })}
          centerLabel={t('dAsk')}
          centerIcon={<Mic size={24} strokeWidth={2.4} />}
        />
      )}
      <Toasts role="driver" />
    </>
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
  const by: Record<Filter, Req[]> = {
    all: loads, near: loads.filter((r) => placeById(r.from).cx !== undefined), route: loads.filter((r) => onRoute(s, r)), return: loads.filter((r) => isReturn(s, r)), shared: loads.filter((r) => r.shared),
  };
  const list = by[f].slice().sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || b.createdAt - a.createdAt);
  const e = earnings(s);
  const countered = s.offers.filter((o) => o.driverId === 'me' && o.awaiting === 'driver' && o.status === 'countered').length;
  return (
    <Screen>
      <AppHead hello={t('welcome')} name={(lang === 'ar' ? ME.nameAr : ME.name).split(' ')[0]} bell={countered} onBell={() => nav.setTab('trips')} />
      <div className="body nav-pad">
        <div className={`status-card ${s.driverOnline ? '' : 'off'}`} data-testid="online">
          <span className={`dot ${s.driverOnline ? 'live' : ''}`} style={s.driverOnline ? undefined : { background: 'var(--faint)' }} />
          <div className="grow"><div className="h3">{s.driverOnline ? t('online') : t('offline')}</div><div className="tiny">{s.driverOnline ? t('dVisible') : t('dHidden')}</div></div>
          <Switch on={s.driverOnline} onChange={(v) => { d({ t: 'set', patch: { driverOnline: v } }); sfx(v ? 'success' : 'step', s.sound); }} label={t('online')} />
        </div>

        <button className="svc fade-up" style={{ height: 150, marginTop: 34, paddingInlineEnd: '40%' }} onClick={() => { fx('voice'); nav.push({ name: 'voice' }); }} data-testid="voice-entry">
          <div className="art" style={{ top: -24, insetInlineEnd: 6, width: '40%' }}><VoiceScene /></div>
          <div className="h3" style={{ fontSize: 18 }}>{t('dVoiceTitle')}</div>
          <div className="small" style={{ margin: '3px 0 10px' }}>{t('dVoiceSub')}</div>
          <span className="pill" style={{ background: 'var(--bg)', alignSelf: 'flex-start' }}><Mic size={13} />{t('dAskHint')}</span>
        </button>

        {trip && (
          <button className="box mint fade-up" style={{ width: '100%', textAlign: 'start', marginTop: 14, display: 'block' }} onClick={() => nav.push({ name: 'trip', arg: trip.id })} data-testid="active-trip">
            <div className="between"><span className="row tiny" style={{ gap: 6, color: 'var(--ink)' }}><span className="dot live" />{t('dActive')} · {t(`st${trip.stage}` as Key)}</span><span className="price">{dh(trip.booked!.price, lang)}</span></div>
            <div className="between" style={{ marginTop: 8 }}>
              <div className="grow"><div className="h3 ellipsis">{p(placeById(trip.from).name)} → {p(placeById(trip.to).name)}</div><div className="small">{trip.customer} · {p(trip.when)}</div></div>
              <span className="round"><ArrowRight size={18} className="flip" /></span>
            </div>
          </button>
        )}

        <div className="grid2" style={{ marginTop: 14 }}>
          <button className="box mint" style={{ textAlign: 'start' }} onClick={() => nav.setTab('earnings')}>
            <div style={{ width: 54, height: 40 }}><CashScene /></div>
            <div className="tiny" style={{ marginTop: 6 }}>{t('dEarnToday')}</div>
            <div className="price" style={{ fontSize: 22 }}>{dh(e.today, lang)}</div>
          </button>
          <button className="box mint" style={{ textAlign: 'start' }} onClick={() => { fx(); setPlan(true); }} data-testid="plan">
            <div style={{ width: 54, height: 40 }}><RouteScene /></div>
            <div className="tiny" style={{ marginTop: 6 }}>{t('dYourTrip')}</div>
            <div className="h3 ellipsis" style={{ fontSize: 15 }}>{s.plan ? `${p(placeById(s.plan.from).city)} → ${p(placeById(s.plan.to).city)}` : t('dAnnounce')}</div>
            {s.plan && <div className="tiny">{t('dOnRoute', { n: by.route.length })}</div>}
          </button>
        </div>

        <Sec title={t('dOpps')} sub={t('dOppsSub', { n: loads.length })} />
        <Chips value={f} onChange={setF} options={([['all', 'fAll', Sparkles], ['near', 'fNear', MapPin], ['route', 'fRoute', RouteIcon], ['return', 'fReturn', CornerDownLeft], ['shared', 'fShared', Layers]] as [Filter, Key, typeof MapPin][]).map(([id, k, I]) => [id, <><I size={14} />{t(k)} <span style={{ opacity: 0.6 }}>{by[id].length}</span></>])} />
        {!s.driverOnline ? (
          <Empty art={<DriverScene />} title={t('dOffline')} sub={t('dHidden')} action={<button className="btn sm" onClick={() => d({ t: 'set', patch: { driverOnline: true } })}>{t('online')}</button>} />
        ) : (
          <div className="col" style={{ gap: 10, marginTop: 14 }}>
            {list.map((r, i) => <LoadCard key={r.id} r={r} i={i} />)}
            {!list.length && <Empty art={<RouteScene />} title={t('dNothing')} sub={t('dNothingSub')} />}
          </div>
        )}
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
  if (r.mine) tags.push(['tagNew', 'orange']);
  if (onRoute(s, r)) tags.push(['tagRoute', 'mint']);
  if (isReturn(s, r)) tags.push(['tagReturn', 'mint']);
  if (r.shared) tags.push(['tagShared', '']);
  return (
    <button className="load" style={{ animationDelay: `${i * 0.05}s`, borderColor: r.mine ? 'var(--orange)' : undefined }} onClick={() => nav.push({ name: 'load', arg: r.id })} data-testid="load">
      <div className="top">
        <div className="ph">{r.photos[0] ? <img src={r.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: 56, height: 44 }}><ItemArt name={r.items[0]?.name[0] ?? ''} /></div>}</div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}><span className="rdot" /><b className="ellipsis name">{p(placeById(r.from).name)}</b></div>
          <div className="rline" />
          <div className="row" style={{ gap: 8 }}><span className="rdot end" /><b className="ellipsis name">{p(placeById(r.to).name)}</b></div>
          <div className="tiny ellipsis" style={{ marginTop: 4 }}>{r.km} {t('km')} · {p(r.when)} · ≈{num(kgOf(r))} {t('kg')}</div>
        </div>
        <div style={{ textAlign: 'end' }}>
          <div className="price" style={{ fontSize: 19 }}>{dh(r.price, lang)}</div>
          {r.helpers > 0 && <div className="tiny"><Users size={11} style={{ verticalAlign: -1 }} /> {r.helpers}</div>}
        </div>
      </div>
      {(tags.length > 0 || mine) && (
        <div className="row wrap" style={{ gap: 6, padding: '0 12px 12px' }}>
          {tags.map(([k, tone]) => <span key={k} className={`badge ${tone}`}>{t(k)}</span>)}
          {mine && <span className="badge orange">{mine.awaiting === 'driver' ? t('ldTheyCounter', { price: mine.price }) : t('ldSent', { price: mine.price })}</span>}
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
  const [dep, setDep] = useState(1);
  const deps: L3[] = [['Today 18:00', "Aujourd'hui 18:00", 'اليوم 18:00'], ['Tomorrow 07:00', 'Demain 07:00', 'غدا 07:00'], ['Sunday 08:00', 'Dimanche 08:00', 'الحد 08:00']];
  return (
    <Sheet open={open} onClose={onClose} title={t('dAnnounce')}>
      <p className="small" style={{ marginBottom: 12 }}>{t('dAnnounceSub')}</p>
      <div className="name" style={{ marginBottom: 8 }}>{t('fromL')}</div>
      <div className="chips wrap">{cities.map((c) => <button key={c.id} className={`chip ${from === c.id ? 'on' : ''}`} onClick={() => setFrom(c.id)}>{p(c.city)}</button>)}</div>
      <div className="name" style={{ margin: '14px 0 8px' }}>{t('toL')}</div>
      <div className="chips wrap">{cities.filter((c) => c.id !== from).map((c) => <button key={c.id} className={`chip ${to === c.id ? 'on' : ''}`} onClick={() => setTo(c.id)}>{p(c.city)}</button>)}</div>
      <div className="name" style={{ margin: '14px 0 8px' }}>{t('secWhen')}</div>
      <div className="chips wrap">{deps.map((x, i) => <button key={i} className={`chip ${dep === i ? 'on' : ''}`} onClick={() => setDep(i)}>{p(x)}</button>)}</div>
      <div style={{ marginTop: 14, borderRadius: 12, overflow: 'hidden' }}><RouteMap from={from} to={to} height={140} /></div>
      <div className="row" style={{ marginTop: 14 }}>
        {s.plan && <button className="round soft lg" aria-label={t('cancel')} onClick={() => { d({ t: 'set', patch: { plan: null } }); onClose(); }}><X size={18} /></button>}
        <button className="btn" onClick={() => { fx('success'); d({ t: 'set', patch: { plan: { from, to, depart: deps[dep], back: null } } }); onClose(); }}>{t('save')}</button>
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
        {r.photos[0] ? <img src={r.photos[0]} alt="" style={{ width: '100%', height: 210, objectFit: 'cover' }} /> : <RouteMap from={r.from} to={r.to} height={210} />}
        <div style={{ position: 'absolute', top: 8, left: 18, right: 18, display: 'flex', justifyContent: 'space-between' }}>
          <BackBtn />
          <button className="round" aria-label={t('ldSave')} onClick={() => { fx(); d({ t: 'save', reqId: r.id }); }}>{r.savedByMe ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}</button>
        </div>
      </div>
      <div className="sheet-page">
        <div className="body" style={{ paddingTop: 8 }}>
          <div className="between">
            <div><div className="tiny">{t('ldProposed')}</div><div className="price" style={{ fontSize: 32 }}>{dh(r.price, lang)}</div></div>
            <div className="box mint" style={{ padding: '8px 12px', textAlign: 'end' }}><div className="tiny">{t('fair')}</div><div className="name num" style={{ color: 'var(--ink)' }}>{r.fair.low}–{r.fair.high}</div></div>
          </div>
          <div className="small" style={{ color: 'var(--ink)', fontWeight: 700, marginTop: 4 }}>{t('ldKeep', { net: Math.round(r.price * (1 - s.commission)), pct })}</div>
          <div className="box" style={{ padding: 0, overflow: 'hidden', marginTop: 14 }}>
            <RouteMap from={r.from} to={r.to} height={130} />
            <div style={{ padding: 14 }}>
              <div className="row" style={{ gap: 8 }}><span className="rdot" /><b className="name">{p(placeById(r.from).name)}</b><span className="tiny">· {floorTxt(r.floors.pickup)}</span></div>
              <div className="rline" />
              <div className="row" style={{ gap: 8 }}><span className="rdot end" /><b className="name">{p(placeById(r.to).name)}</b><span className="tiny">· {floorTxt(r.floors.dropoff)}</span></div>
              <div className="small" style={{ marginTop: 8 }}>{r.km} {t('km')} · {r.min} {t('min')} · {p(r.when)}</div>
            </div>
          </div>
          <Sec title={t('ldCargo')} sub={t('ldWeight', { kg: num(kgOf(r)) })} />
          <div className="grid2">
            {r.items.map((it) => (
              <div key={it.id} className="icard" style={{ animation: 'none' }}>
                <div className="pic" style={{ height: 86 }}>{it.qty > 1 && <span className="qty">×{it.qty}</span>}<div style={{ width: '100%', height: 64 }}><ItemArt name={it.name[0]} /></div></div>
                <div className="meta"><div className="name ellipsis">{p(it.name)}</div><div className="tiny">{t('each', { kg: it.kg })}</div></div>
              </div>
            ))}
          </div>
          <div className="list" style={{ marginTop: 12 }}>
            <Row icon={<Package size={17} />} title={t('ldVehicle')} sub={p(v.name)} />
            <Row icon={<Users size={17} />} title={t('ldHelpers')} sub={r.helpers ? t('ldHelpersN', { n: r.helpers }) : t('ldNone')} />
            {flags.length > 0 && <Row icon={<Info size={17} />} title={flags.join(' · ')} sub={r.shared ? t('sharedInfo') : undefined} />}
            {r.notes && <Row icon={<MessageSquare size={17} />} title={r.notes} />}
          </div>
          <div className="tiny" style={{ marginTop: 10 }}>{r.customer} · {r.mine ? t('tagMine') : t('sample')}</div>
        </div>
        <div className="foot">
          {bookedMine ? (
            <>
              <div className="box mint center name" style={{ color: 'var(--ink)' }}><Check size={16} style={{ verticalAlign: -3 }} /> {t('ldBooked')}</div>
              <button className="btn" onClick={() => nav.replace({ name: 'trip', arg: r.id })}>{t('ldGoTrip')}</button>
            </>
          ) : r.status !== 'open' ? (
            <div className="box soft center small">{t('sBooked')}</div>
          ) : mine ? (
            mine.awaiting === 'driver' ? (
              <>
                <div className="center h3">{t('ldTheyCounter', { price: mine.price })}</div>
                <div className="row">
                  <button className="btn mint md" style={{ flex: 1 }} onClick={() => nav.push({ name: 'offer', arg: r.id })}>{t('counter')}</button>
                  <button className="btn md" style={{ flex: 1 }} onClick={() => { fx('success'); d({ t: 'acceptOffer', offerId: mine.id, by: 'driver' }); }}>{t('ldAccept', { price: mine.price })}</button>
                </div>
              </>
            ) : (
              <>
                <div className="row small" style={{ justifyContent: 'center', gap: 8 }}><span className="spin" style={{ width: 14, height: 14, border: '2px solid var(--ink)', borderTopColor: 'transparent', borderRadius: '50%' }} />{t('ldSent', { price: mine.price })}</div>
                <div className="row">
                  <button className="btn line md" style={{ flex: 1 }} onClick={() => d({ t: 'declineOffer', offerId: mine.id })}>{t('cancel')}</button>
                  <button className="btn mint md" style={{ flex: 1 }} onClick={() => nav.push({ name: 'offer', arg: r.id })}>{t('edit')}</button>
                </div>
              </>
            )
          ) : (
            <>
              <button className="btn" onClick={() => { fx('send', 20); d({ t: 'offer', reqId: r.id, driverId: 'me', price: r.price, etaMin: 15 }); }} data-testid="accept-load">{t('ldAccept', { price: r.price })}</button>
              <div className="row">
                <button className="btn mint md" style={{ flex: 1.3 }} onClick={() => nav.push({ name: 'offer', arg: r.id })} data-testid="other-price">{t('ldOffer')}</button>
                <button className="btn line md" style={{ flex: 1 }} onClick={() => nav.push({ name: 'chat', arg: `${r.id}:me` })}><MessageSquare size={16} />{t('ldAsk')}</button>
              </div>
            </>
          )}
        </div>
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
      <div className="body col" style={{ gap: 16 }}>
        <div className="svc" style={{ height: 'auto', paddingTop: 90, marginTop: 24 }}>
          <div className="art" style={{ top: -26, insetInlineEnd: 8, width: 190 }}><DriverScene /></div>
          <div className="small">{t('ofSub')}</div>
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 18 }} dir="ltr">
          <button className="round soft lg" onClick={() => { fx(); setPrice(Math.max(50, price - 10)); }}><Minus size={22} /></button>
          <div className="price center" style={{ fontSize: 40, minWidth: 160 }} data-testid="offer-price">{dh(price, lang)}</div>
          <button className="round lg" style={{ background: 'var(--btn)', color: '#fff' }} onClick={() => { fx(); setPrice(price + 10); }}><Plus size={22} /></button>
        </div>
        <div className="chips wrap" style={{ justifyContent: 'center' }}>
          {[r.price, r.fair.mid, r.fair.high, r.fair.high + 50].filter((x, i, a) => a.indexOf(x) === i).map((x) => <button key={x} className={`chip ${x === price ? 'on' : ''}`} onClick={() => setPrice(x)}>{dh(x, lang)}</button>)}
        </div>
        <div className="list">
          <Row icon={<Wallet size={17} />} title={t('erKeep')} right={<b className="price">{dh(price - fee, lang)}</b>} />
          <Row icon={<Receipt size={17} />} title={t('erComm', { pct: Math.round(s.commission * 100) })} right={<b className="num" style={{ color: 'var(--orange)' }}>−{dh(fee, lang)}</b>} />
        </div>
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
  const vl = s.voiceLang;
  const rtlVoice = vl === 'darija' || vl === 'msa';
  const L = (en: string, fr: string, da: string, msa: string) => (vl === 'en' ? en : vl === 'fr' ? fr : vl === 'darija' ? da : msa);

  const reply = async (txt: string, confirm?: VoiceMsg['confirm']) => {
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
    if (!yes) { sfx('step', s.sound); reply(L('OK, nothing sent.', 'D’accord, rien n’est envoyé.', 'واخا، ما صيفطنا والو.', 'حسناً، لم يُرسل شيء.')); return; }
    sfx('success', s.sound);
    if (c.kind === 'accept' || c.kind === 'counter') {
      const mo = sRef.current.offers.find((x) => x.reqId === c.reqId && x.driverId === 'me' && x.status !== 'declined');
      if (c.kind === 'accept' && mo && mo.awaiting === 'driver' && mo.price === c.price) d({ t: 'acceptOffer', offerId: mo.id, by: 'driver' });
      else d({ t: 'offer', reqId: c.reqId, driverId: 'me', price: c.price!, etaMin: 15 });
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
  const statusTxt = st === 'listening' ? t('vaListening') : st === 'thinking' ? t('vaThinking') : st === 'speaking' ? t('vaSpeaking') : t('vaTap');
  return (
    <Screen>
      <TopBar
        title={t('vaTitle')}
        right={<button className="round soft" aria-label="read aloud" onClick={() => { d({ t: 'set', patch: { voiceRead: !s.voiceRead } }); if (s.voiceRead) stopSpeaking(); }}>{s.voiceRead ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>}
      />
      <div className="row" style={{ gap: 8, padding: '0 20px 8px' }}>
        <button className="pill" onClick={() => setLangOpen(true)} data-testid="voice-lang"><Languages size={14} />{LANG_LABEL[vl]}</button>
        <span className="badge" style={{ height: 30, borderRadius: 8 }}>{realVoice() || canListen() ? t('vaReal') : t('vaSim')}</span>
      </div>
      <div className="body col" style={{ gap: 10, paddingTop: 6 }} dir={rtlVoice ? 'rtl' : 'ltr'}>
        {s.voice.length === 0 && (
          <div className="col fade-up" style={{ alignItems: 'center', textAlign: 'center', gap: 6 }}>
            <div style={{ width: 150 }}><VoiceScene /></div>
            <div className="h2">{L('Salam Hamid. How can I help?', 'Salam Hamid. Je vous écoute.', 'السلام حميد. كيفاش نعاونك؟', 'السلام عليكم حميد. كيف أساعدك؟')}</div>
            <p className="small" dir="auto" style={{ maxWidth: 290 }}>{t('vaSafety')}</p>
            <div className="list" style={{ width: '100%', marginTop: 8, textAlign: 'start' }}>
              {SUGGEST[vl].slice(0, 4).map((x) => <Row key={x} icon={<Sparkles size={16} />} title={x} onClick={() => sendText(x)} />)}
            </div>
          </div>
        )}
        {s.voice.map((m) => (
          <div key={m.id} className={`vm ${m.from === 'me' ? 'me' : 'x'}`}>
            {m.text}
            {m.confirm && (m.done ? (
              <div style={{ marginTop: 8, fontSize: 12.5, opacity: 0.7, fontWeight: 800 }}>{m.cancelled ? '✕' : '✓'} {m.confirm.label}</div>
            ) : (
              <div className="confirm">
                <button className="n" onClick={() => run(m.id, false)}>{t('no')}</button>
                <button className="y" onClick={() => run(m.id, true)} data-testid="voice-yes">{t('yes')} · {m.confirm.label.split('·').pop()}</button>
              </div>
            ))}
          </div>
        ))}
        {heard && <div className="vm me" style={{ opacity: 0.6 }}>{heard}…</div>}
        <div ref={endRef} />
      </div>
      <div style={{ flex: 'none', padding: '4px 20px 16px', background: 'var(--bg)' }}>
        <div className="col" style={{ alignItems: 'center', gap: 4 }}>
          <div className={`wave ${st === 'listening' || st === 'speaking' ? 'on' : ''}`}>{Array.from({ length: 16 }).map((_, i) => <i key={i} />)}</div>
          <button className={`orb ${st}`} onClick={mic} aria-label={t('vaTap')} data-testid="mic">
            <span className="ring" /><span className="ring" /><span className="ring" />
            <span className="core"><Mic size={32} /></span>
          </button>
          <div className="name" style={{ color: 'var(--ink)' }}>{statusTxt}</div>
        </div>
        <div className="row" style={{ marginTop: 10, gap: 8 }}>
          <button className="pill" style={{ height: 46, borderRadius: 10 }} onClick={() => setIdeas(true)} data-testid="voice-ideas"><Sparkles size={15} />{t('vaTry')}</button>
          {typing ? (
            <div className="field grow" style={{ minHeight: 46, paddingInlineEnd: 4 }}>
              <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t('vaTypePh')} onKeyDown={(e) => e.key === 'Enter' && text.trim() && sendText(text)} dir="auto" data-testid="voice-input" style={{ padding: '10px 0' }} />
              <button className="send" style={{ width: 38, height: 38, borderRadius: 9 }} onClick={() => text.trim() && sendText(text)} aria-label="send"><Send size={16} className="flip" /></button>
            </div>
          ) : (
            <button className="search grow" style={{ height: 46 }} onClick={() => setTyping(true)} data-testid="voice-type"><Keyboard size={17} />{t('vaTypePh')}</button>
          )}
        </div>
      </div>

      <Sheet open={ideas} onClose={() => setIdeas(false)} title={t('vaTry')}>
        {!canListen() && <p className="small" style={{ marginTop: 0 }}>{t('vaNoMic')}</p>}
        <div className="list" dir={rtlVoice ? 'rtl' : 'ltr'}>
          {SUGGEST[vl].map((x) => <Row key={x} icon={<Sparkles size={16} />} title={x} onClick={() => sendText(x)} />)}
        </div>
      </Sheet>
      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={t('setLang')}>
        <div className="list">
          {(['darija', 'msa', 'fr', 'en'] as VoiceLang[]).map((l) => (
            <Row key={l} title={LANG_LABEL[l]} chevron={false} right={vl === l ? <Check size={18} color="var(--ink)" /> : undefined} onClick={() => { d({ t: 'set', patch: { voiceLang: l } }); setLangOpen(false); }} />
          ))}
        </div>
        <p className="tiny" style={{ marginTop: 10 }}>{lang === 'ar' ? 'الصوت كيهضر بنفس اللغة اللي ختاريتي.' : lang === 'fr' ? 'La voix répond dans la langue choisie.' : 'The voice answers in the language you choose.'}</p>
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
        <div className="body col" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 12 }}>
          <div style={{ width: 230 }}><DriverScene /></div>
          <div className="h2">{t('dtDone', { net })}</div>
          <div className="list" style={{ width: '100%', textAlign: 'start' }}>
            <Row icon={<Wallet size={17} />} title={t('erCash')} right={<b className="price">{dh(r.booked.price, lang)}</b>} />
            <Row icon={<Receipt size={17} />} title={t('erComm', { pct: Math.round(s.commission * 100) })} right={<b className="num" style={{ color: 'var(--orange)' }}>−{dh(r.booked.price - net, lang)}</b>} />
            <Row icon={<Check size={17} />} title={t('erKeep')} right={<b className="price" style={{ fontSize: 18 }}>{dh(net, lang)}</b>} />
          </div>
        </div>
        <div className="foot"><button className="btn" onClick={() => nav.reset('home')}>{t('done')}</button></div>
      </Screen>
    );
  return (
    <Screen>
      <div style={{ position: 'relative', flex: 'none' }}>
        <RouteMap from={r.from} to={r.to} height={250} progress={progress} live={r.stage === 4} radar={r.stage < 2} />
        <div style={{ position: 'absolute', top: 8, left: 18 }}><BackBtn /></div>
        <a className="btn sm" style={{ position: 'absolute', bottom: 36, insetInlineEnd: 16, background: 'var(--bg)', color: 'var(--ink)' }} href={`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`} target="_blank" rel="noreferrer"><Navigation size={15} />{t('navigate')}</a>
      </div>
      <div className="sheet-page">
        <div className="body" style={{ paddingTop: 8 }}>
          <div className="tiny" style={{ color: 'var(--orange)' }}>{t(`st${r.stage}` as Key)}</div>
          <div className="h2" key={r.stage} style={{ animation: 'fadeUp .4s' }}>{p(dest.name)}</div>
          <div className="small">{p(r.when)} · {r.km} {t('km')}</div>
          <div className="row" style={{ gap: 4, margin: '14px 0' }}>{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={{ flex: 1, height: 6, borderRadius: 6, background: i <= r.stage ? 'var(--btn)' : 'var(--mint)', transition: 'background .4s' }} />)}</div>
          <div className="box mint row">
            <div className="av" style={{ background: 'var(--orange)' }}>{r.customer.slice(0, 2).toUpperCase()}</div>
            <div className="grow"><div className="tiny">{t('dtCustomer')}</div><div className="name">{r.customer}</div></div>
            <button className="round" aria-label={t('call')}><Phone size={17} /></button>
            <button className="round" aria-label={t('message')} onClick={() => nav.push({ name: 'chat', arg: r.id })}><MessageSquare size={17} /></button>
          </div>
          <div className="box" style={{ marginTop: 10 }}>
            <div className="h3">{t('dtCollect', { price: r.booked.price })}</div>
            <div className="tiny" style={{ marginTop: 4 }}>{t('ldKeep', { net, pct: Math.round(s.commission * 100) })}</div>
          </div>
          <div className="hscroll" style={{ marginTop: 10 }}>
            {r.items.map((it) => <div key={it.id} className="mini" style={{ width: 96, minHeight: 92, padding: 8 }}><div style={{ height: 44 }}><ItemArt name={it.name[0]} /></div><span className="name ellipsis" style={{ fontSize: 12, marginTop: 4 }}>{it.qty > 1 ? `${it.qty}× ` : ''}{p(it.name)}</span></div>)}
          </div>
          <p className="tiny center" style={{ marginTop: 10 }}>{t('negRule')}</p>
        </div>
        <div className="foot">
          <SlideToConfirm key={r.stage} label={t('slide', { label: t(`act${r.stage}` as Key) })} onDone={() => { d({ t: 'stage', reqId: r.id, stage: next }); sfx(next === 5 ? 'success' : 'step', s.sound); }} />
          <button className="link" style={{ margin: '0 auto' }} onClick={() => { fx(); nav.push({ name: 'voice' }); }}><Mic size={15} />{t('dAsk')}</button>
        </div>
      </div>
    </Screen>
  );
}

// ---------------- Trips ----------------
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
      <div style={{ padding: '8px 20px 4px' }}><div className="title">{t('tTrips')}</div></div>
      <div className="body nav-pad">
        {active.length > 0 && <Sec title={t('dtUpcoming')} />}
        {active.map((r) => (
          <button key={r.id} className="box mint" style={{ width: '100%', textAlign: 'start', marginBottom: 10, display: 'block' }} onClick={() => nav.push({ name: 'trip', arg: r.id })}>
            <div className="between"><span className="row tiny" style={{ gap: 6, color: 'var(--ink)' }}><span className="dot live" />{t(`st${r.stage}` as Key)}</span><span className="price">{dh(r.booked!.price, lang)}</span></div>
            <div className="h3" style={{ marginTop: 6 }}>{p(placeById(r.from).name)} → {p(placeById(r.to).name)}</div>
            <div className="small">{r.customer} · {p(r.when)}</div>
          </button>
        ))}
        {offers.length > 0 && <Sec title={t('dtWaiting')} />}
        {offers.map((o) => {
          const r = s.reqs.find((x) => x.id === o.reqId)!;
          return (
            <button key={o.id} className="box" style={{ width: '100%', textAlign: 'start', marginBottom: 10, display: 'block' }} onClick={() => nav.push({ name: 'load', arg: r.id })}>
              <div className="between"><div className="h3 ellipsis">{p(placeById(r.from).name)} → {p(placeById(r.to).name)}</div><span className="price">{dh(o.price, lang)}</span></div>
              <span className={`badge ${o.awaiting === 'driver' ? 'orange' : 'mint'}`} style={{ marginTop: 6 }}>{o.awaiting === 'driver' ? t('ldTheyCounter', { price: o.price }) : t('ldSent', { price: o.price })}</span>
            </button>
          );
        })}
        <Sec title={t('dtHistory')} />
        <div className="list">
          {done.map((r) => <Row key={r.id} icon={<Check size={17} />} title={`${p(placeById(r.from).name)} → ${p(placeById(r.to).name)}`} sub={t('sDelivered')} right={<b className="price">{dh(r.booked!.price, lang)}</b>} />)}
          {WEEK_TRIPS.slice().reverse().map((x, i) => <Row key={i} icon={<Check size={17} />} title={x.route} sub={p(x.day)} right={<b className="price">{dh(x.gross, lang)}</b>} />)}
        </div>
      </div>
    </Screen>
  );
}

// ---------------- Chats ----------------
function DChats() {
  const { s } = useApp();
  const { t, p } = useT();
  const nav = useNav();
  const keys = Array.from(new Set(s.chats.map((c) => c.reqId))).filter((k) => k !== 'support' && (k.endsWith(':me') || s.reqs.find((r) => r.id === k)?.booked?.driverId === 'me'));
  return (
    <Screen>
      <div style={{ padding: '8px 20px 12px' }}><div className="title">{t('tChats')}</div></div>
      <div className="body nav-pad">
        <div className="list">
          {keys.map((k) => {
            const r = s.reqs.find((x) => x.id === k.split(':')[0])!;
            const last = s.chats.filter((c) => c.reqId === k).slice(-1)[0];
            return <Row key={k} icon={<div className="av sm" style={{ background: 'var(--orange)' }}>{r.customer.slice(0, 2).toUpperCase()}</div>} title={`${r.customer} · ${p(placeById(r.from).name)} → ${p(placeById(r.to).name)}`} sub={last?.text} onClick={() => nav.push({ name: 'chat', arg: k })} />;
          })}
          <Row icon={<Headphones size={18} />} title={t('support')} sub={t('supportLast')} onClick={() => nav.push({ name: 'chat', arg: 'support' })} />
        </div>
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
  const gross = per === 'd' ? e.today : per === 'w' ? e.week : month;
  const trips = per === 'd' ? e.todayTrips : per === 'w' ? e.trips : e.trips + INVOICES.reduce((n, i) => n + i.trips, 0);
  const fee = Math.round(gross * s.commission);
  const bars = DAY_BARS.map((v, i) => (i === 5 ? v + e.today : v));
  const maxBar = Math.max(...bars, 1);
  const days: L3[] = [['M', 'L', 'ن'], ['T', 'M', 'ث'], ['W', 'M', 'ر'], ['T', 'J', 'خ'], ['F', 'V', 'ج'], ['S', 'S', 'س'], ['S', 'D', 'ح']];
  return (
    <Screen>
      <div style={{ padding: '8px 20px 12px' }}><div className="title">{t('erTitle')}</div></div>
      <div className="body nav-pad">
        <Chips value={per} options={[['d', t('erToday')], ['w', t('erWeek')], ['m', t('erMonth')]]} onChange={setPer} />
        <div className="svc" style={{ height: 'auto', marginTop: 34, paddingTop: 70 }}>
          <div className="art" style={{ top: -28, insetInlineEnd: 10, width: 110 }}><CashScene /></div>
          <div className="small">{t('erKeep')}</div>
          <div className="price" style={{ fontSize: 36 }} data-testid="keep">{dh(gross - fee, lang)}</div>
          <div className="tiny">{t('erTrips', { n: trips })} · {t('erCash')} {dh(gross, lang)}</div>
          {per === 'w' && (
            <div className="bars" style={{ marginTop: 14, height: 96 }}>
              {bars.map((v, i) => <div key={i}><i className={i === 5 ? 'on' : ''} style={{ height: `${Math.max(4, (v / maxBar) * 100)}%`, animationDelay: `${i * 0.05}s`, background: i === 5 ? undefined : 'var(--bg)' }} /><span className="tiny">{p(days[i])}</span></div>)}
            </div>
          )}
        </div>
        <div className="list" style={{ marginTop: 12 }}>
          <Row icon={<Wallet size={18} />} title={t('erCash')} right={<b className="num">{dh(gross, lang)}</b>} />
          <Row icon={<Receipt size={18} />} title={t('erComm', { pct })} right={<b className="num" style={{ color: 'var(--orange)' }}>−{dh(fee, lang)}</b>} />
          <Row icon={<Check size={18} />} title={t('erKeep')} right={<b className="price">{dh(gross - fee, lang)}</b>} />
        </div>
        <div className="box" style={{ marginTop: 12, borderColor: 'var(--orange)' }}>
          <div className="between"><div><div className="h3">{t('erOutstanding')}</div><div className="tiny">{t('erDue')}</div></div><div className="price" style={{ fontSize: 22, color: 'var(--orange)' }} data-testid="due">{dh(e.fee, lang)}</div></div>
        </div>
        <Sec title={t('erInvoices')} />
        <div className="list">
          <Row icon={<FileText size={18} />} title="INV-2026-46" sub={`10–16 ${p(['Nov', 'nov.', 'نونبر'])} · ${t('erTrips', { n: e.trips })}`} right={<span className="badge orange">{t('erOpen')}</span>} />
          {INVOICES.map((i) => <Row key={i.id} icon={<FileText size={18} />} title={i.id} sub={`${p(i.period)} · ${dh(Math.round(i.gross * 0.1), lang)}`} right={<span className="badge mint">{t('erPaid')}</span>} />)}
        </div>
        <p className="tiny center" style={{ marginTop: 14 }}>{p(['No wallet: customers pay you cash, Xapp invoices its commission weekly by SMS / WhatsApp.', 'Pas de portefeuille : les clients vous paient en espèces, Xapp facture sa commission chaque semaine par SMS / WhatsApp.', 'ما كاينش بزطام: الزبناء كيخلصوك كاش، وXapp كتصيفط فاتورة العمولة كل سيمانة ف SMS / واتساب.'])}</p>
      </div>
    </Screen>
  );
}

// ---------------- Profile & vehicle ----------------
function DProfile() {
  const { s, d } = useApp();
  const { t, p, lang } = useT();
  const nav = useNav();
  const [helpers, setHelpers] = useState(true);
  const [shared, setShared] = useState(true);
  const v = VEHICLES[ME.vehicle];
  const docs: [Key, string, typeof FileText][] = [['docLicense', 'license', FileText], ['docReg', 'reg', FileText], ['docIns', 'ins', ShieldCheck], ['docId', 'cin', User], ['docPhotos', 'photos', Camera]];
  const ok = (k: string) => k !== 'photos' || s.approvedDocs.includes('me:photos');
  return (
    <Screen>
      <div className="body nav-pad" style={{ paddingTop: 10 }}>
        <div className="row" style={{ gap: 14 }}>
          <Avatar d={ME} size="lg" />
          <div className="grow"><div className="title" style={{ fontSize: 22 }}>{lang === 'ar' ? ME.nameAr : ME.name}</div><div className="small">★ {ME.rating} · {t('offTrips', { n: ME.trips })} · {ME.years} {p(['yrs', 'ans', 'سنين'])}</div></div>
          <button className="round soft" aria-label={t('settings')} onClick={() => nav.push({ name: 'settings' })}><Settings size={18} /></button>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 10 }}><span className="badge mint"><ShieldCheck size={12} />{t('dpVerified')}</span><span className="badge mint">{t('dpCommitted')}</span><span className="badge mint">{t('dpActive')}</span></div>
        <Sec title={t('dpVehicle')} />
        <div className="icard" style={{ animation: 'none' }}>
          <div className="pic" style={{ height: 130 }}><span className="scanb"><Check size={14} /></span><img src={v.img} alt="" style={{ height: 100, objectFit: 'contain' }} /></div>
          <div className="meta between"><div><div className="name">{p(v.name)}</div><div className="tiny">{t('dpUpTo', { kg: num(v.maxKg) })}</div></div><span className="badge" dir="ltr">{ME.plate}</span></div>
        </div>
        <Sec title={t('dpDocs')} />
        <div className="list">
          {docs.map(([k, id, I]) => <Row key={id} icon={<I size={18} />} title={t(k)} right={<span className={`badge ${ok(id) ? 'mint' : 'orange'}`}>{ok(id) ? t('docOk') : t('docReview')}</span>} />)}
        </div>
        <Sec title={t('dpPrefs')} />
        <div className="list">
          <Row icon={<MapPin size={18} />} title={t('prefArea')} sub={t('prefAreaV')} />
          <Row icon={<Users size={18} />} title={t('prefHelpers')} right={<Switch on={helpers} onChange={setHelpers} />} />
          <Row icon={<Repeat size={18} />} title={t('prefShared')} right={<Switch on={shared} onChange={setShared} />} />
          <Row icon={<Settings size={18} />} title={t('settings')} onClick={() => nav.push({ name: 'settings' })} />
        </div>
        <Sec title={t('setMode')} />
        <ModeSwitch />
        <div className="list" style={{ marginTop: 12 }}><AdminLink /></div>
        <button className="link" style={{ margin: '16px auto', display: 'flex' }} onClick={() => d({ t: 'set', patch: { driverOnline: !s.driverOnline } })}>{s.driverOnline ? t('offline') : t('online')} <ChevronRight size={15} className="flip" /></button>
      </div>
    </Screen>
  );
}

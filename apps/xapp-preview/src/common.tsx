import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Globe, Lock, MapPin, Moon, RotateCcw, Search, Send, ShieldCheck, Sun, User, Volume2, LocateFixed, Map as MapIcon, LayoutDashboard, Headphones } from 'lucide-react';
import { CUSTOMER, driverById, nm, PLACES, placeById, type Place } from './data';
import { useApp, type Role } from './store';
import { useT } from './i18n';
import { Row, Screen, Seg, Sheet, Switch, TopBar, useFx, useNav, Avatar } from './ui';
import { sfx } from './sound';

/** Settings shared by both sides: language, look, sounds, notifications, privacy, location, mode. */
export function SettingsScreen() {
  const { s, d } = useApp();
  const { t } = useT();
  return (
    <Screen>
      <TopBar title={t('settings')} />
      <div className="body">
        <div className="sect">{t('setLang')}</div>
        <Seg value={s.lang} options={[['en', 'English'], ['fr', 'Français'], ['ar', 'العربية']]} onChange={(v) => d({ t: 'set', patch: { lang: v } })} />
        <div className="sect">{t('setTheme')}</div>
        <Seg value={s.theme} options={[['light', <span className="row" style={{ gap: 6, justifyContent: 'center' }}><Sun size={16} />{t('light')}</span>], ['dark', <span className="row" style={{ gap: 6, justifyContent: 'center' }}><Moon size={16} />{t('dark')}</span>]]} onChange={(v) => d({ t: 'set', patch: { theme: v } })} />
        <div className="sect">{t('setAccount')}</div>
        <div className="list">
          <Row icon={<Volume2 size={18} />} title={t('setSound')} right={<Switch on={s.sound} onChange={(v) => { d({ t: 'set', patch: { sound: v } }); if (v) sfx('success', true); }} />} />
          <Row icon={<Bell size={18} />} title={t('setNotif')} right={<Switch on={s.notifications} onChange={(v) => d({ t: 'set', patch: { notifications: v } })} />} />
          <Row icon={<LocateFixed size={18} />} title={t('setLocation')} sub={t('setLocationSub')} right={<Switch on={s.location} onChange={(v) => d({ t: 'set', patch: { location: v } })} />} />
          <Row icon={<Lock size={18} />} title={t('setPrivacy')} sub={t('setPrivacySub')} />
        </div>
        <div className="sect">{t('setMode')}</div>
        <ModeSwitch />
        <div style={{ height: 14 }} />
        <div className="list">
          <Row icon={<RotateCcw size={18} />} title={t('resetDemo')} onClick={() => d({ t: 'reset' })} chevron={false} />
        </div>
      </div>
    </Screen>
  );
}

export function ModeSwitch() {
  const { s, d } = useApp();
  const { t } = useT();
  return <Seg<Role> value={s.role} options={[['customer', t('modeCustomer')], ['driver', t('modeDriver')], ['admin', t('modeAdmin')]]} onChange={(v) => d({ t: 'set', patch: { role: v } })} />;
}

export function AdminLink() {
  const { d } = useApp();
  const { t } = useT();
  return <Row icon={<LayoutDashboard size={18} />} title={t('openAdmin')} onClick={() => d({ t: 'set', patch: { role: 'admin' } })} />;
}

/** One conversation. `key` is a request id (after booking) or `request:driver` (questions before booking), or `support`. */
export function ChatScreen({ chatKey, me }: { chatKey: string; me: 'customer' | 'driver' }) {
  const { s, d } = useApp();
  const { t, p } = useT();
  const fx = useFx();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const [reqId, driverPart] = chatKey.split(':');
  const req = s.reqs.find((r) => r.id === reqId);
  const driverId = driverPart ?? req?.booked?.driverId;
  const msgs = s.chats.filter((c) => c.reqId === chatKey);
  const other = chatKey === 'support' ? null : me === 'customer' ? (driverId ? driverById(driverId) : null) : null;
  const title = chatKey === 'support' ? t('support') : me === 'customer' ? (other ? nm(other, s.lang) : '') : req?.customer ?? '';
  // The other person replies when they are a sample (never when both sides are the preview's own user).
  const simulated = chatKey === 'support' || (me === 'customer' ? driverId !== 'me' : !req?.mine);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);
  const send = (txt: string) => {
    if (!txt.trim()) return;
    fx('send');
    d({ t: 'chat', reqId: chatKey, from: me, text: txt.trim() });
    setText('');
    if (simulated) {
      const reply = chatKey === 'support'
        ? ['Thanks! An agent will answer within a few minutes.', 'Merci ! Un conseiller répond dans quelques minutes.', 'شكراً! غادي يجاوبك شي واحد من الفريق فدقايق.']
        : me === 'customer'
          ? ['Salam! Yes, no problem. I can be there on time.', 'Salam ! Oui, pas de souci. Je serai là à l’heure.', 'السلام! إيه، ماشي مشكل. غادي نكون فالوقت.']
          : ['Thank you, it is the 3rd floor, the stairs are wide.', 'Merci, c’est au 3e étage, l’escalier est large.', 'شكراً، الطابق 3، الدروج واسعين.'];
      setTimeout(() => {
        d({ t: 'chat', reqId: chatKey, from: chatKey === 'support' ? 'xapp' : me === 'customer' ? 'driver' : 'customer', text: p(reply as [string, string, string]) });
        sfx('ping', s.sound);
      }, 2200);
    }
  };
  const quick = me === 'customer'
    ? [['Where are you now?', 'Où êtes-vous ?', 'فين وصلتي؟'], ['The building has a lift', 'Il y a un ascenseur', 'كاين المصعد'], ['Please call me when you arrive', 'Appelez-moi en arrivant', 'عيّط ليا ملي توصل']]
    : [['I am on my way', 'Je suis en route', 'راني جاي'], ['Is there parking?', 'Il y a un parking ?', 'واش كاين فين نوقف؟'], ['Which floor?', 'Quel étage ?', 'شمن طابق؟']];
  return (
    <Screen>
      <TopBar
        title={
          <span className="row" style={{ justifyContent: 'center', gap: 8 }}>
            {chatKey === 'support' ? <Headphones size={18} /> : other ? <Avatar d={other} size="sm" /> : null}
            <span className="ellipsis">{title}</span>
          </span>
        }
      />
      <div className="body col" style={{ gap: 8, paddingTop: 10 }}>
        {req && (
          <div className="bubble sys">
            {p(placeById(req.from).name)} → {p(placeById(req.to).name)} · {p(req.when)}
          </div>
        )}
        <div className="bubble sys"><ShieldCheck size={13} style={{ verticalAlign: -2 }} /> {t('setPrivacySub')}</div>
        {chatKey === 'support' && <div className="bubble them">{t('supportLast')}</div>}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.from === me ? 'me' : 'them'}`}>{m.text}</div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="chips" style={{ padding: '6px 14px', margin: 0 }}>
        {quick.map((q) => (
          <button key={q[0]} className="chip soft" onClick={() => send(p(q as [string, string, string]))}>{p(q as [string, string, string])}</button>
        ))}
      </div>
      <div className="composer">
        <div className="field"><input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('chatPh')} onKeyDown={(e) => e.key === 'Enter' && send(text)} /></div>
        <button className="send" aria-label="send" onClick={() => send(text)}><Send size={19} className="flip" /></button>
      </div>
    </Screen>
  );
}

/** Pick a place: search, current location, or tap on the map. */
export function PlaceSheet({ open, onClose, onPick, title, exclude }: { open: boolean; onClose: () => void; onPick: (id: string) => void; title: string; exclude?: string }) {
  const { t, p } = useT();
  const fx = useFx();
  const [q, setQ] = useState('');
  const [map, setMap] = useState(false);
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = useMemo(() => PLACES.filter((pl) => pl.id !== exclude && (!q || pl.name.concat(pl.city).some((n) => norm(n).includes(norm(q))))), [q, exclude]);
  const choose = (id: string) => {
    fx('step');
    onPick(id);
    setQ('');
    setMap(false);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="field" style={{ marginBottom: 10 }}>
        <span className="lead"><Search size={18} /></span>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} />
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 10 }}>
        <button className="chip" onClick={() => choose('maarif')}><LocateFixed size={16} color="var(--accent)" />{t('myLoc')}</button>
        <button className={`chip ${map ? 'on' : ''}`} onClick={() => setMap(!map)}><MapIcon size={16} />{t('pickOnMap')}</button>
      </div>
      {map ? <PickMap onPick={choose} exclude={exclude} /> : (
        <div className="list">
          {list.map((pl) => (
            <Row key={pl.id} icon={<MapPin size={18} />} title={p(pl.name)} sub={p(pl.city)} onClick={() => choose(pl.id)} chevron={false} />
          ))}
        </div>
      )}
      <p className="tiny center" style={{ marginTop: 10 }}>{t('myLoc')}: {p(placeById('maarif').name)} · {t('sample')}</p>
    </Sheet>
  );
}

function PickMap({ onPick, exclude }: { onPick: (id: string) => void; exclude?: string }) {
  const { p } = useT();
  const city = PLACES.filter((x): x is Place & { cx: number; cy: number } => x.cx !== undefined && x.id !== exclude);
  return (
    <div className="map" style={{ height: 300, borderRadius: 18 }}>
      <svg viewBox="0 0 400 400">
        <CasaBaseMini />
        {city.map((pl) => (
          <g key={pl.id} onClick={() => onPick(pl.id)} style={{ cursor: 'pointer' }}>
            <circle cx={pl.cx} cy={pl.cy} r="22" fill="var(--accent)" opacity="0.12" />
            <circle cx={pl.cx} cy={pl.cy} r="9" fill="var(--accent)" stroke="var(--surface)" strokeWidth="3" />
            <text x={pl.cx} y={pl.cy + 26} textAnchor="middle" className="label" style={{ fontSize: 14 }}>{p(pl.name)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
function CasaBaseMini() {
  return (
    <g>
      <path d="M0 0 H300 C270 30 230 52 190 64 C150 76 110 98 72 132 C46 156 22 190 0 214 Z" fill="var(--map-water)" />
      {[60, 120, 180, 240, 300, 360].map((y) => <path key={y} d={`M0 ${y} Q200 ${y + 14} 400 ${y - 8}`} stroke="var(--map-road2)" strokeWidth="1.5" fill="none" />)}
      <path d="M0 300 C120 270 220 240 400 150" stroke="var(--map-road)" strokeWidth="7" fill="none" />
      <path d="M150 400 C170 300 200 200 260 90" stroke="var(--map-road)" strokeWidth="7" fill="none" />
    </g>
  );
}

export function CustomerCard() {
  return (
    <div className="row">
      <div className="av" style={{ background: 'linear-gradient(135deg,#f472b6,#c2410c)' }}>{CUSTOMER.initials}</div>
      <div className="grow">
        <div className="h3">{CUSTOMER.name}</div>
        <div className="small">{CUSTOMER.phone}</div>
      </div>
    </div>
  );
}

export const LangIcon = Globe;
export const UserIcon = User;

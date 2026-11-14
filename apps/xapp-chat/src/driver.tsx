import { useState } from 'react';
import { MapPin, Users, Minus, Plus, Check, Truck, MessageSquare, Navigation } from 'lucide-react';
import { ME, VEHICLES } from './data';
import { placeById, routeOf } from './places';
import { aiSay, stageWords, useApp, type Load, type Stage } from './store';
import { dh, useT, type Key } from './i18n';
import { sfx, buzz } from './sound';
import { ItemArt } from './art';
import { whenText } from './brain';

/** The driver side: no chat, just requests to accept or decline, and the trip in progress. */
export function DriverBoard() {
  const { s, d } = useApp();
  const { t, p, lang } = useT();
  const active = s.loads.find((l) => l.id === s.activeLoad && l.status === 'booked');
  const list = s.loads.filter((l) => l.status === 'open' || l.status === 'offered');
  return (
    <div className="scr">
      <div className="app-head" style={{ gridTemplateColumns: '1fr auto' }}>
        <div className="row">
          <div className="av" style={{ background: ME.color }}>{ME.initials}</div>
          <div className="who"><div className="tiny">{p(VEHICLES[ME.vehicle].name)} · <span dir="ltr">{ME.plate}</span></div><b>{lang === 'ar' ? ME.nameAr : ME.name}</b></div>
        </div>
        <span className="logo end" style={{ fontSize: 18 }} dir="ltr"><b style={{ color: 'var(--ink)' }}>X</b><b style={{ color: 'var(--orange)' }}>APP</b></span>
      </div>
      <div className="body" style={{ paddingTop: 0 }}>
        <div className={`status-card ${s.online ? '' : 'off'}`} data-testid="online">
          <span className={`dot ${s.online ? 'live' : ''}`} style={s.online ? undefined : { background: 'var(--faint)' }} />
          <div className="grow"><div className="h3">{s.online ? t('online') : t('offline')}</div><div className="tiny">{s.online ? t('onlineSub') : t('offlineSub')}</div></div>
          <button role="switch" aria-checked={s.online} aria-label={t('online')} className={`switch ${s.online ? 'on' : ''}`} onClick={() => { d({ t: 'set', patch: { online: !s.online } }); sfx(s.online ? 'step' : 'success', s.sound); }} />
        </div>

        {active && <ActiveTrip l={active} />}

        <div className="sec"><div className="h2">{t('dTitle')}</div>{s.online && <span className="pill">{list.length}</span>}</div>
        {!s.online ? <div className="box soft center small">{t('offlineSub')}</div> : (
          <div className="col" style={{ gap: 12 }}>
            {list.map((l, i) => <LoadCard key={l.id} l={l} i={i} />)}
            {!list.length && <div className="box soft center small">{t('noLoads')}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadCard({ l, i }: { l: Load; i: number }) {
  const { s, d } = useApp();
  const { t, p, lang } = useT();
  const [other, setOther] = useState<number | null>(null);
  const r = routeOf(placeById(l.from), placeById(l.to));
  const offer = (price: number) => {
    sfx('send', s.sound);
    buzz(15);
    d({ t: 'load', id: l.id, patch: { status: 'offered', myPrice: price } });
    if (l.mine) {
      // The driver's offer appears in the customer's chat.
      d({ t: 'offer', driverId: 'me', price, eta: 20 });
      aiSay(d, s.talk, { da: `${ME.nameAr} (شيفور) عطاك عرض: ${price} درهم.`, fr: `${ME.name} (chauffeur) vous propose ${price} DH.`, en: `${ME.name} (driver) offers ${price} DH.` }, 'offers');
    }
    setOther(null);
  };
  return (
    <div className="load" style={{ animationDelay: `${i * 0.05}s`, borderColor: l.mine ? 'var(--orange)' : undefined }} data-testid="load">
      <div className="top">
        <div className="ph">{l.photo ? <img src={l.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: 56, height: 42 }}><ItemArt name={l.what[0]?.name[0] ?? ''} /></div>}</div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}><span className="rdot" /><b className="name ellipsis">{p(placeById(l.from).name)}</b></div>
          <div className="rline" />
          <div className="row" style={{ gap: 8 }}><span className="rdot end" /><b className="name ellipsis">{p(placeById(l.to).name)}</b></div>
          <div className="tiny" style={{ marginTop: 4 }}>{r.km} km · {whenText(l.when, lang === 'ar' ? 'darija' : lang)} · ≈{l.kg} kg</div>
        </div>
        <div style={{ textAlign: 'end' }}><div className="price" style={{ fontSize: 19 }}>{dh(l.price, lang)}</div></div>
      </div>
      <div style={{ padding: '0 12px 12px' }} className="col">
        <div className="small" dir="auto" style={{ color: 'var(--text)', fontWeight: 600 }}>{l.what.map((w) => `${w.qty > 1 ? w.qty + '× ' : ''}${p(w.name)}`).join(lang === 'ar' ? '، ' : ', ')}</div>
        <div className="row wrap" style={{ gap: 6 }}>
          {l.mine && <span className="badge orange"><MessageSquare size={11} />{t('fromChat')}</span>}
          {!l.mine && <span className="badge">{t('sample')}</span>}
          {l.helpers > 0 && <span className="badge mint"><Users size={11} />{t('helpersNeed', { n: l.helpers })}</span>}
        </div>
        {l.status === 'offered' ? (
          <div className="box mint small center" style={{ color: 'var(--ink)', fontWeight: 700 }}><span className="spin" style={{ display: 'inline-block', width: 11, height: 11, border: '2px solid var(--ink)', borderTopColor: 'transparent', borderRadius: '50%', verticalAlign: -1 }} /> {t('sentWait', { p: l.myPrice ?? l.price })}</div>
        ) : other !== null ? (
          <div className="row" dir="ltr">
            <button className="round soft" onClick={() => setOther(other - 10)}><Minus size={16} /></button>
            <div className="price grow center" style={{ fontSize: 20 }}>{dh(other, lang)}</div>
            <button className="round soft" onClick={() => setOther(other + 10)}><Plus size={16} /></button>
            <button className="btn sm" onClick={() => offer(other)} data-testid="send-other">{t('sendOffer', { p: other })}</button>
          </div>
        ) : (
          <>
            <button className="btn md" onClick={() => offer(l.price)} data-testid="accept-load"><Check size={18} />{t('acceptAt', { p: l.price })}</button>
            <div className="row">
              <button className="btn mint sm" style={{ flex: 1 }} onClick={() => setOther(l.price + 30)} data-testid="other-price">{t('offerOther')}</button>
              <button className="link" style={{ color: 'var(--bad)', minHeight: 44, paddingInline: 12 }} onClick={() => d({ t: 'load', id: l.id, patch: { status: 'declined' } })}>{t('decline')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ActiveTrip({ l }: { l: Load }) {
  const { s, d } = useApp();
  const { t, p, lang } = useT();
  const price = l.mine ? s.booked?.price ?? l.price : l.myPrice ?? l.price;
  const dest = s.stage >= 3 ? placeById(l.to) : placeById(l.from);
  const next = () => {
    const n = (s.stage + 1) as Stage;
    d({ t: 'stage', stage: n });
    sfx(n === 5 ? 'success' : 'step', s.sound);
    buzz(20);
    if (l.mine) d({ t: 'msg', msg: { from: 'ai', text: stageWords(n, s.talk, s.talk === 'darija' ? ME.nameAr : ME.name.split(' ')[0], price), card: n === 5 ? 'trip' : undefined, by: 'app' } });
  };
  return (
    <div className="ccard" style={{ marginTop: 14 }} data-testid="active-trip">
      <div className="hd"><Truck size={16} />{t('activeTrip')} · {t(`st${s.stage}` as Key)}</div>
      <div className="bd">
        <div className="tl">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={s.stage >= i ? 'on' : ''} />)}</div>
        <div className="between"><div><div className="tiny">{t('customer')}: {l.customer}</div><div className="h3"><MapPin size={15} style={{ verticalAlign: -2 }} /> {p(dest.name)}</div></div><div className="price" style={{ fontSize: 20 }}>{dh(price, lang)}</div></div>
        {s.stage < 5 ? (
          <>
            <button className="btn" onClick={next} data-testid="next-step">{t(`act${s.stage}` as Key)}</button>
            <a className="btn mint sm" style={{ width: '100%' }} href={`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`} target="_blank" rel="noreferrer"><Navigation size={16} />Google Maps</a>
          </>
        ) : (
          <div className="box mint center name" style={{ color: 'var(--ink)' }}>{t('tripDone', { p: price })}</div>
        )}
      </div>
    </div>
  );
}

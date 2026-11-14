import { useEffect, useRef, useState } from 'react';
import { Camera, Mic, Send, Images, Sparkles, Plus, Minus, Trash2, Check, MapPin, LocateFixed, Clock, Users, Truck, ShieldCheck, Star, Headphones, SquarePen, Volume2, VolumeX, Search, Phone, MessageSquare } from 'lucide-react';
import { DRIVERS, driverById, SAMPLE_ITEMS, SAMPLE_PHOTO, THINGS, VEHICLES, type Item } from './data';
import { PLACES, placeById, pick, routeOf, type L3 } from './places';
import { kgOf, nextNeed, question, quote, say, talkOf, turn, uid, whenText, type CardKind, type Slots, type Talk, type When } from './brain';
import { aiSay, useApp, type Msg, type Stage } from './store';
import { dh, useT } from './i18n';
import { canListen, canSee, canThink, claudeReady, listen, readPhotos, speak, stopSpeaking } from './claude';
import { sfx, buzz } from './sound';
import { ItemArt } from './art';

const tl = (talk: Talk, l: L3) => (talk === 'en' ? l[0] : talk === 'fr' ? l[1] : l[2]);
const speechLang = (talk: Talk) => (talk === 'en' ? 'en' : talk === 'fr' ? 'fr' : 'ar') as 'en' | 'fr' | 'ar';

/** The customer side: one conversation, like talking to a person, with cards to tap where tapping is faster. */
export function CustomerChat() {
  const { s, d } = useApp();
  const { t } = useT();
  const [text, setText] = useState('');
  const [hearing, setHearing] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [brainReady, setBrainReady] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const sRef = useRef(s);
  sRef.current = s;
  useEffect(() => { claudeReady().then(() => setBrainReady(true)); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [s.msgs.length, s.thinking, s.offers.length, s.stage]);
  useEffect(() => () => stopSpeaking(), []);

  /** Speak the assistant's newest words when the person asked for it. */
  const lastAi = [...s.msgs].reverse().find((m) => m.from === 'ai' && m.text);
  useEffect(() => {
    if (s.speakReplies && lastAi?.text) speak(lastAi.text, speechLang(s.talk));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAi?.id]);

  /** Moves the conversation on after something was set by tapping a card. */
  const advance = (patch: Partial<Slots>, echo: string) => {
    const cur = sRef.current;
    d({ t: 'msg', msg: { from: 'user', text: echo } });
    d({ t: 'slots', patch });
    const merged = { ...cur.slots, ...patch };
    const need = nextNeed(merged);
    const q = question(need, cur.talk);
    sfx('tap', cur.sound);
    setTimeout(() => d({ t: 'msg', msg: { from: 'ai', text: q.text, card: need, quick: q.quick, by: 'app' } }), 350);
  };

  const sendText = async (raw: string) => {
    const said = raw.trim();
    if (!said) return;
    setText('');
    const cur = sRef.current;
    const talk = talkOf(said, cur.talk);
    if (talk !== cur.talk) d({ t: 'set', patch: { talk } });
    d({ t: 'msg', msg: { from: 'user', text: said } });
    sfx('send', cur.sound);
    if (cur.phase !== 'chat') {
      // After sending, the assistant keeps the person company and points to people when needed.
      setTimeout(() => aiSay(d, talk, cur.phase === 'sent' ? { da: 'العروض كيوصلو هنا مباشرة. إلا بغيتي تبدّل الثمن، ضغط على «ثمن آخر» فشي عرض.', fr: 'Les offres arrivent ici. Pour changer de prix, touchez « Autre prix » sur une offre.', en: 'Offers arrive right here. To change the price, tap “Other price” on an offer.' } : { da: 'الرحلة كتتبّع هنا. إلا كان شي مشكل، ضغط على «هضر مع شي واحد».', fr: 'Le trajet est suivi ici. En cas de problème, touchez « Parler à une personne ».', en: 'The trip is tracked here. If something’s wrong, tap “Talk to a person”.' }), 500);
      return;
    }
    d({ t: 'set', patch: { thinking: true } });
    const history = [...cur.msgs.filter((m) => m.text).map((m) => ({ from: m.from, text: m.text! })), { from: 'user' as const, text: said }];
    const r = await turn(said, history, cur.slots, talk);
    d({ t: 'slots', patch: r.patch });
    d({ t: 'set', patch: { thinking: false } });
    d({ t: 'msg', msg: { from: 'ai', text: r.reply, card: r.card, quick: r.quick, by: r.by } });
    sfx('ping', sRef.current.sound);
  };

  const mic = () => {
    if (hearing) return;
    stopSpeaking();
    if (!canListen()) {
      d({ t: 'toast', text: t('noMic'), role: 'customer' });
      return;
    }
    buzz(15);
    sfx('voice', s.sound);
    setHearing(true);
    listen(speechLang(s.talk), (p) => setText(p)).then((said) => {
      setHearing(false);
      if (said) sendText(said);
    });
  };

  /** A photo of the load: shown in the chat, then read (by Claude when available). */
  const addPhoto = (src: string, b64: string | null, sample: boolean) => {
    setPhotoMenu(false);
    const cur = sRef.current;
    d({ t: 'msg', msg: { from: 'user', photo: src } });
    const id = uid();
    d({ t: 'scan', id, scan: { photo: src, sample, status: 'reading', items: [], by: 'sample' } });
    d({ t: 'msg', msg: { id, from: 'ai', text: say(cur.talk, { da: 'شفت التصويرة، خليني نشوف شنو فيها…', fr: 'Je regarde votre photo…', en: 'Let me look at your photo…' }), card: 'scan', by: 'app' } });
    sfx('voice', cur.sound);
    const done = (items: Item[], by: 'claude' | 'sample') => {
      d({ t: 'scan', id, scan: { status: 'done', items, by } });
      sfx('success', sRef.current.sound);
    };
    if (!sample && b64 && canSee()) {
      readPhotos([b64]).then((seen) => {
        if (seen?.length) done(seen.map((x) => ({ id: uid(), name: [x.name_en, x.name_fr, x.name_ar] as L3, qty: Math.max(1, Math.round(x.qty || 1)), kg: Math.max(1, Math.round(x.kg_each || 10)), conf: x.confidence ?? 'medium', box: { x: Math.max(0.04, Math.min(0.96, x.x ?? 0.5)), y: Math.max(0.04, Math.min(0.96, x.y ?? 0.5)), w: 0, h: 0 } })), 'claude');
        else {
          done([], 'claude');
          aiSay(d, sRef.current.talk, { da: 'ما قدرتش نعرف شنو فالتصويرة. كتب ليا شنو بغيتي تنقل.', fr: 'Je n’ai pas reconnu le contenu. Écrivez-moi ce que vous transportez.', en: 'I couldn’t tell what’s in the photo. Type what you want to move.' });
        }
      });
    } else if (!sample) {
      // No AI on this page: say so plainly; the photo still goes to the drivers.
      setTimeout(() => {
        done([], 'sample');
        aiSay(d, sRef.current.talk, { da: 'التصويرة تزادت للطلب، ولكن هنا (معاينة) ما نقدرش نقراها. كتب ليا شنو فيها، ولا جرّب تصويرة المثال.', fr: 'Photo ajoutée, mais je ne peux pas la lire ici (aperçu). Écrivez ce qu’elle montre, ou essayez la photo exemple.', en: 'Photo added, but I can’t read it here (preview). Type what it shows, or try the sample photo.' }, 'items');
      }, 1500);
    } else setTimeout(() => done(SAMPLE_ITEMS.map((x) => ({ ...x, id: uid() })), 'sample'), 3200);
  };

  const onFile = (f?: File) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', 0.82);
      addPhoto(data, data.split(',')[1], false);
    };
    img.src = url;
  };

  const lastCardIdx = s.msgs.map((m) => !!m.card && m.card !== 'offers' && m.card !== 'trip').lastIndexOf(true);
  const lastQuickIdx = s.msgs.map((m) => !!m.quick?.length).lastIndexOf(true);
  // The offers list and the trip card are live: only the newest one is shown, so nothing repeats.
  const lastOffersIdx = s.msgs.map((m) => m.card === 'offers').lastIndexOf(true);
  const lastTripIdx = s.msgs.map((m) => m.card === 'trip').lastIndexOf(true);
  return (
    <div className="scr">
      <div className="chat-head">
        <button className="round soft" aria-label={t('newChat')} title={t('newChat')} onClick={() => { stopSpeaking(); d({ t: 'newChat' }); }} data-testid="new-chat"><SquarePen size={18} /></button>
        <div className="grow">
          <span className="logo" style={{ fontSize: 20 }} dir="ltr"><b style={{ color: 'var(--ink)' }}>X</b><b style={{ color: 'var(--orange)' }}>APP</b></span>
          <span className="brain" data-testid="brain"><Sparkles size={11} />{brainReady && canThink() ? t('brainClaude') : t('brainBuiltin')}</span>
        </div>
        <button className="round soft" aria-label={t('speak')} title={t('speak')} onClick={() => { if (s.speakReplies) stopSpeaking(); d({ t: 'set', patch: { speakReplies: !s.speakReplies } }); }}>{s.speakReplies ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
      </div>

      <div className="thread" data-testid="thread">
        {!s.msgs.length && <Welcome onPick={sendText} onPhoto={() => setPhotoMenu(true)} />}
        {s.msgs.map((m, i) => (
          <MsgView key={m.id} m={m} live={(m.card === 'offers' && i === lastOffersIdx) || (m.card === 'trip' && i === lastTripIdx)} active={i === lastCardIdx} quick={i === lastQuickIdx && s.phase === 'chat' ? m.quick : undefined} onQuick={sendText} advance={advance} onPhoto={() => setPhotoMenu(true)} />
        ))}
        {s.thinking && <div className="typing" aria-label="…"><i /><i /><i /></div>}
        {s.msgs.length > 2 && (
          <button className="link" style={{ alignSelf: 'center', fontSize: 12.5, color: 'var(--muted)' }} onClick={() => { d({ t: 'msg', msg: { from: 'user', text: t('human') } }); setTimeout(() => d({ t: 'msg', msg: { from: 'ai', text: t('humanReply'), by: 'app' } }), 400); }}>
            <Headphones size={13} />{t('human')}
          </button>
        )}
        <div ref={endRef} />
      </div>

      {photoMenu && (
        <>
          <div className="scrim" onClick={() => setPhotoMenu(false)} />
          <div className="sheet">
            <div className="grab" />
            <div className="h2" style={{ marginBottom: 12 }}>{t('photoTitle')}</div>
            <div className="list">
              <button className="li" onClick={() => camRef.current?.click()}><div className="ic"><Camera size={18} /></div><div className="grow t">{t('camera')}</div></button>
              <button className="li" onClick={() => galRef.current?.click()}><div className="ic"><Images size={18} /></div><div className="grow t">{t('gallery')}</div></button>
              <button className="li" onClick={() => addPhoto(SAMPLE_PHOTO, null, true)} data-testid="sample-photo"><div className="ic"><Sparkles size={18} /></div><div className="grow t">{t('samplePhoto')}</div></button>
            </div>
          </div>
        </>
      )}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

      <div className="cbar">
        <button className="rb cam" aria-label={t('camera')} onClick={() => setPhotoMenu(true)} data-testid="cam"><Camera size={22} /></button>
        <div className="box">
          <textarea rows={1} dir="auto" value={text} placeholder={hearing ? t('listening') : t('typeHere')} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(text); } }} data-testid="box" />
        </div>
        {text.trim() && !hearing ? (
          <button className="rb mic" aria-label="send" onClick={() => sendText(text)} data-testid="send"><Send size={20} className="flip" /></button>
        ) : (
          <button className={`rb mic ${hearing ? 'on' : ''}`} aria-label={hearing ? t('listening') : 'mic'} onClick={mic} data-testid="mic"><Mic size={22} /></button>
        )}
      </div>
    </div>
  );
}

function Welcome({ onPick, onPhoto }: { onPick: (s: string) => void; onPhoto: () => void }) {
  const { t } = useT();
  return (
    <div className="welcome fade-up">
      <div className="logo-big">X</div>
      <div className="h2" style={{ marginTop: 6 }}>{t('hello')}</div>
      <p className="sub" style={{ maxWidth: 300 }}>{t('helloSub')}</p>
      <div className="starters">
        <button onClick={onPhoto} data-testid="starter-photo"><Camera size={18} />{t('photoTitle')}</button>
        {(['starter1', 'starter3', 'starter2'] as const).map((k) => <button key={k} dir="auto" onClick={() => onPick(t(k))} data-testid={`starter-${k}`}><MessageSquare size={18} />{t(k)}</button>)}
      </div>
    </div>
  );
}

function MsgView({ m, live, active, quick, onQuick, advance, onPhoto }: { m: Msg; live: boolean; active: boolean; quick?: string[]; onQuick: (s: string) => void; advance: (p: Partial<Slots>, echo: string) => void; onPhoto: () => void }) {
  const { s } = useApp();
  if (m.from === 'user') return m.photo ? <div className="b user photo"><img src={m.photo} alt="" /></div> : <div className="b user" dir="auto">{m.text}</div>;
  return (
    <>
      {m.text && (
        <div className="ai-row">
          <div className="ai-av">X</div>
          <div className="b ai" dir="auto" style={{ maxWidth: '100%' }}>{m.text}</div>
        </div>
      )}
      {m.card === 'scan' && <ScanCard id={m.id} active={active} advance={advance} />}
      {m.card === 'items' && <ItemsCard active={active} advance={advance} onPhoto={onPhoto} />}
      {(m.card === 'from' || m.card === 'to') && <PlaceCard which={m.card} active={active} advance={advance} />}
      {m.card === 'when' && <WhenCard active={active} advance={advance} />}
      {m.card === 'helpers' && <HelpersCard active={active} advance={advance} />}
      {m.card === 'summary' && <SummaryCard active={active && s.phase === 'chat'} />}
      {m.card === 'offers' && live && <OffersCard />}
      {m.card === 'trip' && live && <TripCard />}
      {quick && <div className="quick">{quick.map((q) => <button key={q} dir="auto" onClick={() => onQuick(q)}>{q}</button>)}</div>}
    </>
  );
}

function Card({ icon, title, active, children, testid }: { icon: React.ReactNode; title: string; active: boolean; children: React.ReactNode; testid?: string }) {
  return (
    <div className={`ccard ${active ? '' : 'done'}`} data-testid={testid}>
      <div className="hd">{icon}{title}</div>
      <div className="bd">{children}</div>
    </div>
  );
}

// ---------------- Photo scan ----------------
const rng = (seed: string) => {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return (h >>> 0) / 4294967296;
  };
};
function mesh(id: string, x: number, y: number, w: number, h: number) {
  const r = rng(id), cols = 5, rows = 4, pts: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    pts.push([]);
    for (let i = 0; i <= cols; i++) {
      const e = i === 0 || j === 0 || i === cols || j === rows;
      pts[j].push([x + (w * i) / cols + (e ? 0 : (r() - 0.5) * (w / cols) * 0.7), y + (h * j) / rows + (e ? 0 : (r() - 0.5) * (h / rows) * 0.7)]);
    }
  }
  const f = (q: [number, number]) => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`;
  let d = '';
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i], e = pts[j + 1][i + 1];
    d += `M${f(a)}L${f(b)}L${f(e)}ZM${f(a)}L${f(e)}L${f(c)}Z`;
  }
  return d;
}

function ScanCard({ id, active, advance }: { id: string; active: boolean; advance: (p: Partial<Slots>, echo: string) => void }) {
  const { s, d } = useApp();
  const { t } = useT();
  const sc = s.scans[id];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (sc?.status !== 'done') return;
    let n = 0;
    const iv = setInterval(() => { n++; setShown(n); sfx('tap', s.sound); if (n >= sc.items.length) clearInterval(iv); }, 380);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sc?.status]);
  if (!sc) return null;
  const set = (items: Item[]) => d({ t: 'scan', id, scan: { items } });
  const p = (l: L3) => tl(s.talk, l);
  return (
    <Card icon={<Sparkles size={16} />} title={sc.status === 'reading' ? t('reading') : t('found', { n: sc.items.length })} active={active || sc.status === 'reading'} testid="scan-card">
      <div className="photo-scan" dir="ltr">
        <img src={sc.photo} alt="" />
        {sc.status === 'reading' && <div className="sweep" />}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {sc.items.slice(0, shown).filter((i) => i.box && i.box.w > 0).map((i) => (
            <path key={i.id} d={mesh(i.id, i.box!.x * 100, i.box!.y * 100, i.box!.w * 100, i.box!.h * 100)} fill="rgba(255,255,255,.08)" stroke={i.conf === 'low' ? '#FDE68A' : '#fff'} strokeWidth="1" vectorEffect="non-scaling-stroke" style={{ strokeDasharray: 600, strokeDashoffset: 600, animation: 'draw 1.2s ease-out forwards' }} />
          ))}
          {sc.items.slice(0, shown).filter((i) => i.box && i.box.w === 0).map((i) => <circle key={i.id} cx={i.box!.x * 100} cy={i.box!.y * 100} r="2.4" fill="#fff" stroke="#1E5B53" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        </svg>
        {sc.items.slice(0, shown).filter((i) => i.box).map((i) => (
          <span key={i.id} className={`lb ${i.conf === 'low' ? 'q' : ''}`} style={{ left: `${(i.box!.x + i.box!.w / 2) * 100}%`, top: `${Math.max(9, i.box!.y * 100 + (i.box!.w ? 4 : 0))}%` }}>{p(i.name)}{i.qty > 1 ? ` ×${i.qty}` : ''}</span>
        ))}
      </div>
      {sc.status === 'done' && sc.items.length > 0 && (
        <>
          <span className={`badge ${sc.by === 'claude' ? 'mint' : ''}`} style={{ alignSelf: 'flex-start' }}><Sparkles size={11} />{sc.by === 'claude' ? t('aiReal') : t('aiSample')}</span>
          <div>
            {sc.items.map((i) => (
              <div className="irow" key={i.id}>
                <div className="art"><ItemArt name={i.name[0]} /></div>
                <div className="grow"><div className="name" style={{ fontSize: 14 }}>{p(i.name)}</div><div className="tiny">≈ {i.kg} kg</div></div>
                <Stepper value={i.qty} onChange={(q) => set(sc.items.map((x) => (x.id === i.id ? { ...x, qty: q } : x)))} />
                <button className="round soft" style={{ width: 32, height: 32 }} aria-label={t('remove')} onClick={() => set(sc.items.filter((x) => x.id !== i.id))}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="tiny">{t('estimate')}</div>
          {active && (
            <button className="btn md" data-testid="scan-ok" onClick={() => {
              const items = sc.items.map((x) => ({ ...x, name: x.name.map((n) => n.replace(/\s?[?？؟]$/, '')) as L3, conf: 'high' as const }));
              advance({ items: [...s.slots.items, ...items] }, say(s.talk, { da: `صحيح: ${items.map((x) => p(x.name)).join('، ')}`, fr: `C’est bon : ${items.map((x) => p(x.name)).join(', ')}`, en: `Correct: ${items.map((x) => p(x.name)).join(', ')}` }));
            }}><Check size={18} />{t('looksRight')}</button>
          )}
        </>
      )}
    </Card>
  );
}

function ItemsCard({ active, advance, onPhoto }: { active: boolean; advance: (p: Partial<Slots>, echo: string) => void; onPhoto: () => void }) {
  const { s } = useApp();
  const { t } = useT();
  return (
    <Card icon={<Truck size={16} />} title={t('what')} active={active}>
      <button className="btn mint md" onClick={onPhoto}><Camera size={18} />{t('photoTitle')}</button>
      <div className="pchips">
        {THINGS.slice(0, 9).map((th) => (
          <button key={th.name[0]} onClick={() => advance({ items: [...s.slots.items, { id: uid(), name: th.name, qty: 1, kg: th.kg, conf: 'high' }] }, tl(s.talk, th.name))}>{tl(s.talk, th.name)}</button>
        ))}
      </div>
    </Card>
  );
}

// ---------------- Places ----------------
function PlaceCard({ which, active, advance }: { which: 'from' | 'to'; active: boolean; advance: (p: Partial<Slots>, echo: string) => void }) {
  const { s } = useApp();
  const { t } = useT();
  const [q, setQ] = useState('');
  const other = which === 'from' ? s.slots.to : s.slots.from;
  const n = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = PLACES.filter((p) => p.id !== other && (!q || p.name.concat(p.alias as unknown as L3).some((x) => n(x).includes(n(q))))).slice(0, q ? 8 : 0);
  const popular = ['casa', 'maarif', 'rabat', 'marrakech', 'tangier', 'agadir', 'fes', 'dakhla'].filter((id) => id !== other);
  const choose = (id: string) => advance({ [which]: id } as Partial<Slots>, say(s.talk, which === 'from' ? { da: `من ${tl(s.talk, placeById(id).name)}`, fr: `Depuis ${tl(s.talk, placeById(id).name)}`, en: `From ${tl(s.talk, placeById(id).name)}` } : { da: `لـ ${tl(s.talk, placeById(id).name)}`, fr: `Vers ${tl(s.talk, placeById(id).name)}`, en: `To ${tl(s.talk, placeById(id).name)}` }));
  const chosen = s.slots[which];
  return (
    <Card icon={<MapPin size={16} />} title={which === 'from' ? t('pickupQ') : t('dropQ')} active={active} testid={`place-${which}`}>
      <MoroccoMap from={which === 'from' ? chosen : s.slots.from} to={which === 'to' ? chosen : s.slots.to} />
      {which === 'from' && <button className="btn mint md" onClick={() => choose('maarif')}><LocateFixed size={18} />{t('myLocation')}</button>}
      <div className="field" style={{ minHeight: 44 }}><span className="lead"><Search size={16} /></span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlace')} dir="auto" /></div>
      <div className="pchips">
        {(q ? list.map((p) => p.id) : popular).map((id) => <button key={id} className={chosen === id ? 'on' : ''} onClick={() => choose(id)}>{tl(s.talk, placeById(id).name)}</button>)}
      </div>
    </Card>
  );
}

/** A drawn map of Morocco with the pickup and destination (a picture, not a real map). */
function MoroccoMap({ from, to }: { from?: string; to?: string }) {
  const a = from ? placeById(from) : null, b = to ? placeById(to) : null;
  return (
    <div className="minimap" dir="ltr">
      <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
        <path d="M0 0 H232 C224 30 214 70 204 96 C190 112 176 122 166 130 C150 140 136 152 126 176 C116 200 106 222 96 246 C90 268 86 290 74 312 C60 340 44 368 20 400 H0 Z" fill="var(--map-water)" />
        <path d="M232 0 H400 C370 30 340 44 300 40 C280 36 262 30 252 22 Z" fill="var(--map-water)" />
        <path d="M246 30 L204 98 L168 128 L142 222 L86 292 L40 362 L14 396 M204 98 L286 104 L372 76" stroke="var(--map-road)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {a && b && <path d={`M${a.x} ${a.y} Q${(a.x + b.x) / 2 + 30} ${(a.y + b.y) / 2} ${b.x} ${b.y}`} stroke="var(--btn)" strokeWidth="5" fill="none" strokeDasharray="2 10" strokeLinecap="round" style={{ animation: 'dash 1s linear infinite' }} />}
        {a && <circle cx={a.x} cy={a.y} r="10" fill="var(--bg)" stroke="var(--btn)" strokeWidth="5" />}
        {b && <g transform={`translate(${b.x} ${b.y})`}><path d="M0 0 C-10 -12 -12 -18 -12 -24 A12 12 0 1 1 12 -24 C12 -18 10 -12 0 0 Z" fill="var(--orange)" /><circle cy="-24" r="4.5" fill="#fff" /></g>}
      </svg>
    </div>
  );
}

// ---------------- Time and helpers ----------------
function WhenCard({ active, advance }: { active: boolean; advance: (p: Partial<Slots>, echo: string) => void }) {
  const { s } = useApp();
  const { t } = useT();
  const [kind, setKind] = useState<'today' | 'tomorrow' | null>(null);
  const go = (w: When) => advance({ when: w }, whenText(w, s.talk));
  return (
    <Card icon={<Clock size={16} />} title={t('when')} active={active} testid="when-card">
      <div className="pchips">
        <button onClick={() => go({ kind: 'now' })} data-testid="when-now">{t('now')}</button>
        <button className={kind === 'today' ? 'on' : ''} onClick={() => setKind('today')}>{t('today')}</button>
        <button className={kind === 'tomorrow' ? 'on' : ''} onClick={() => setKind('tomorrow')} data-testid="when-tomorrow">{t('tomorrow')}</button>
      </div>
      {kind && <div className="pchips fade-up">{['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'].map((h) => <button key={h} dir="ltr" onClick={() => go({ kind, time: h })} data-testid={`time-${h}`}>{h}</button>)}</div>}
    </Card>
  );
}

function HelpersCard({ active, advance }: { active: boolean; advance: (p: Partial<Slots>, echo: string) => void }) {
  const { s } = useApp();
  const { t } = useT();
  const label = (n: number) => (n === 0 ? t('helpers0') : n === 1 ? t('helpers1') : t('helpersN', { n }));
  return (
    <Card icon={<Users size={16} />} title={t('helpers')} active={active} testid="helpers-card">
      <div className="pchips">{[0, 1, 2, 3].map((n) => <button key={n} onClick={() => advance({ helpers: n }, label(n))} data-testid={`help-${n}`}>{label(n)}</button>)}</div>
      <div className="tiny">{say(s.talk, { da: 'المساعدين كيهزّو وكيحمّلو. الثمن ديالهم داخل فالعرض ديال الشيفور.', fr: 'Les aides portent et chargent ; leur coût est compris dans l’offre du chauffeur.', en: 'Helpers carry and load; their cost is part of the driver’s offer.' })}</div>
    </Card>
  );
}

// ---------------- Summary, offers, trip ----------------
function SummaryCard({ active }: { active: boolean }) {
  const { s, d } = useApp();
  const { t, lang } = useT();
  const q = quote(s.slots);
  const [price, setPrice] = useState(q.fair.mid);
  const p = (l: L3) => tl(s.talk, l);
  const v = VEHICLES[q.vehicle];
  if (!s.slots.from || !s.slots.to) return null;
  return (
    <Card icon={<Check size={16} />} title={t('summary')} active={active} testid="summary-card">
      <div className="kv"><span>{t('what')}</span><span>{s.slots.items.map((i) => `${i.qty > 1 ? i.qty + '× ' : ''}${p(i.name)}`).join('، ')} · ≈{kgOf(s.slots)} kg</span></div>
      <div className="kv"><span>{t('route')}</span><span>{p(placeById(s.slots.from).name)} → {p(placeById(s.slots.to).name)} · {q.km} km</span></div>
      <div className="kv"><span>{t('when')}</span><span>{s.slots.when ? whenText(s.slots.when, s.talk) : '—'}</span></div>
      <div className="kv"><span>{t('helpers')}</span><span>{s.slots.helpers ? s.slots.helpers : t('helpers0')}</span></div>
      {s.slots.notes && <div className="kv"><span>📝</span><span>{s.slots.notes}</span></div>}
      <div className="box mint row" style={{ padding: 10 }}>
        <img src={v.img} alt="" style={{ width: 70, height: 42, objectFit: 'contain' }} />
        <div className="grow"><div className="tiny">{t('vehicle')}</div><div className="name">{p(v.name)}</div></div>
      </div>
      <div className="center">
        <div className="tiny">{t('fair')}</div>
        <div className="row" style={{ justifyContent: 'center', gap: 14, marginTop: 4 }} dir="ltr">
          <button className="round soft" disabled={!active} onClick={() => setPrice(Math.max(50, price - 10))} aria-label="less"><Minus size={18} /></button>
          <div className="price" style={{ fontSize: 30, minWidth: 120 }} data-testid="price">{dh(price, lang)}</div>
          <button className="round" style={{ background: 'var(--btn)', color: '#fff' }} disabled={!active} onClick={() => setPrice(price + 10)} aria-label="more"><Plus size={18} /></button>
        </div>
        <div className="tiny" style={{ marginTop: 4 }}>{t('range', { low: q.fair.low, high: q.fair.high })}</div>
      </div>
      <div className="tiny"><ShieldCheck size={12} style={{ verticalAlign: -2 }} /> {t('cash')}</div>
      {active && (
        <button className="btn" data-testid="send-drivers" onClick={() => {
          d({ t: 'send', price });
          d({ t: 'msg', msg: { from: 'user', text: `${t('sendDrivers')} · ${dh(price, lang)}` } });
          sfx('send', s.sound);
          setTimeout(() => aiSay(d, s.talk, { da: 'صيفطت الطلب للشيفورات اللي قراب. العروض غادي يوصلو هنا ففرصة.', fr: 'Demande envoyée aux chauffeurs proches. Les offres arrivent ici.', en: 'Sent to nearby drivers. Offers will arrive right here.' }), 400);
        }}><Truck size={18} />{t('sendDrivers')}</button>
      )}
    </Card>
  );
}

function OffersCard() {
  const { s, d } = useApp();
  const { t, lang } = useT();
  const [counter, setCounter] = useState<{ id: string; price: number } | null>(null);
  const list = s.offers.filter((o) => o.status !== 'declined').sort((a, b) => a.price - b.price);
  const name = (id: string) => (s.talk === 'darija' ? driverById(id).nameAr : driverById(id).name);
  return (
    <Card icon={<Truck size={16} />} title={s.phase === 'sent' ? `${t('offers')} · ${list.length}` : t('booked', { n: name(s.booked?.driverId ?? 'youssef'), p: s.booked?.price ?? 0 })} active={s.phase === 'sent'} testid="offers-card">
      {s.phase === 'sent' && !list.length && <div className="skeleton" style={{ height: 56 }} />}
      {list.map((o) => {
        const dr = driverById(o.driverId);
        return (
          <div key={o.id}>
            <div className="drv-offer" data-testid="offer">
              <div className="av sm" style={{ background: dr.color, width: 40, height: 40 }}>{dr.initials}</div>
              <div className="grow">
                <div className="name">{name(o.driverId)} {o.driverId !== 'me' && <span className="badge" style={{ height: 18, fontSize: 10 }}>{t('sample')}</span>}</div>
                <div className="tiny"><Star size={11} fill="var(--orange)" color="var(--orange)" style={{ verticalAlign: -1 }} /> {dr.rating} · {t('trips', { n: dr.trips })} · {tl(s.talk, VEHICLES[dr.vehicle].name)}</div>
                <div className="tiny">{t('arrives', { n: o.eta })}{dr.helpers ? ` · ${t('withHelpers')}` : ''}</div>
              </div>
              <div className="price" style={{ fontSize: 19 }}>{dh(o.price, lang)}</div>
            </div>
            {s.phase === 'sent' && (o.counter ? (
              <div className="tiny" style={{ textAlign: 'center', paddingBottom: 6 }}><span className="spin" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid var(--ink)', borderTopColor: 'transparent', borderRadius: '50%', verticalAlign: -1 }} /> {t('propose', { p: o.counter })}…</div>
            ) : counter?.id === o.id ? (
              <div className="row" style={{ paddingBottom: 8 }} dir="ltr">
                <button className="round soft" onClick={() => setCounter({ id: o.id, price: counter.price - 10 })}><Minus size={16} /></button>
                <div className="price grow center">{dh(counter.price, lang)}</div>
                <button className="round soft" onClick={() => setCounter({ id: o.id, price: counter.price + 10 })}><Plus size={16} /></button>
                <button className="btn sm" onClick={() => { d({ t: 'counter', id: o.id, price: counter.price }); setCounter(null); sfx('send', s.sound); }}>{t('propose', { p: counter.price })}</button>
              </div>
            ) : (
              <div className="row" style={{ paddingBottom: 8, gap: 8 }}>
                <button className="link" style={{ color: 'var(--bad)', minHeight: 40 }} onClick={() => d({ t: 'declineOffer', id: o.id })}>{t('decline')}</button>
                <button className="btn mint sm" style={{ flex: 1 }} onClick={() => setCounter({ id: o.id, price: o.price - 20 })}>{t('counter')}</button>
                <button className="btn sm" style={{ flex: 1.2 }} data-testid="accept" onClick={() => {
                  d({ t: 'accept', id: o.id });
                  sfx('success', s.sound);
                  buzz(30);
                  setTimeout(() => aiSay(d, s.talk, { da: `مبروك! تحجزات مع ${name(o.driverId)} بـ ${o.price} درهم. غادي نعلمك بكل خطوة هنا.`, fr: `Réservé avec ${name(o.driverId)} pour ${o.price} DH. Je vous tiens informé ici.`, en: `Booked with ${name(o.driverId)} for ${o.price} DH. I’ll keep you posted here.` }, 'trip'), 300);
                }}>{t('accept')}</button>
              </div>
            ))}
          </div>
        );
      })}
    </Card>
  );
}

function TripCard() {
  const { s, d } = useApp();
  const { t, lang } = useT();
  if (!s.booked) return null;
  const dr = driverById(s.booked.driverId);
  return (
    <Card icon={<Truck size={16} />} title={`${s.talk === 'darija' ? dr.nameAr : dr.name} · ${t(`st${s.stage}` as 'st0')}`} active testid="trip-card">
      <div className="tl">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={s.stage >= i ? 'on' : ''} />)}</div>
      <div className="row">
        <div className="av sm" style={{ background: dr.color, width: 40, height: 40 }}>{dr.initials}</div>
        <div className="grow"><div className="name">{s.talk === 'darija' ? dr.nameAr : dr.name}</div><div className="tiny" dir="ltr" style={{ textAlign: 'start' }}>{tl(s.talk, VEHICLES[dr.vehicle].name)} · {dr.plate}</div></div>
        <button className="round soft" aria-label="call"><Phone size={16} /></button>
        <div className="price">{dh(s.booked.price, lang)}</div>
      </div>
      <div className="tiny"><ShieldCheck size={12} style={{ verticalAlign: -2 }} /> {t('cash')}</div>
      {s.stage === 5 && (
        <div className="center" style={{ paddingTop: 4 }}>
          <div className="name">{s.rating ? t('thanks') : t('rate')}</div>
          <div className="row" style={{ justifyContent: 'center', gap: 6, marginTop: 6 }} dir="ltr">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n}`} onClick={() => { d({ t: 'rate', n }); sfx('step', s.sound); }} style={{ color: n <= s.rating ? 'var(--orange)' : 'var(--line)' }}><Star size={30} fill="currentColor" strokeWidth={0} /></button>)}
          </div>
        </div>
      )}
    </Card>
  );
}

export function Stepper({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="stepper" dir="ltr">
      <button aria-label="less" onClick={() => value > min && onChange(value - 1)} style={{ opacity: value > min ? 1 : 0.35 }}><Minus size={14} /></button>
      <span>{value}</span>
      <button aria-label="more" onClick={() => onChange(value + 1)}><Plus size={14} /></button>
    </div>
  );
}


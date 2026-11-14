import { useEffect, useState } from 'react';
import { Moon, Sun, Volume2, VolumeX, RotateCcw, Settings2, Bell } from 'lucide-react';
import { AppProvider, useApp, type Role } from './store';
import { useT } from './i18n';
import { CustomerChat } from './chat';
import { DriverBoard } from './driver';
import { prepareClaude } from './claude';

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, React.ReactNode][]; onChange: (v: T) => void }) {
  return <div className="seg">{options.map(([v, l]) => <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

function Toasts({ role }: { role: Role }) {
  const { s, d } = useApp();
  const list = s.toasts.filter((x) => x.role === role).slice(-1);
  if (!list.length) return null;
  return (
    <div className="toasts">
      {list.map((x) => <button key={x.id} className="toast" onClick={() => d({ t: 'dropToast', id: x.id })}><span className="tic"><Bell size={17} /></span><span className="grow" dir="auto">{x.text}</span></button>)}
    </div>
  );
}

function Shell() {
  const { s, d } = useApp();
  const { t, rtl, lang } = useT();
  const [demo, setDemo] = useState(false);
  useEffect(() => { prepareClaude(); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.lang = lang;
  }, [s.theme, lang]);
  const L = (en: string, fr: string, ar: string) => (lang === 'en' ? en : lang === 'fr' ? fr : ar);
  const controls = (
    <>
      <div><div className="lbl">{L('View', 'Vue', 'العرض')}</div><Seg<Role> value={s.role} options={[['customer', t('customer')], ['driver', t('driver')]]} onChange={(v) => d({ t: 'set', patch: { role: v } })} /></div>
      <div><div className="lbl">{L('App language', 'Langue de l’appli', 'لغة التطبيق')}</div><Seg value={s.lang} options={[['ar', 'العربية'], ['fr', 'FR'], ['en', 'EN']]} onChange={(v) => d({ t: 'set', patch: { lang: v } })} /></div>
      <div className="row">
        <div className="grow"><Seg value={s.theme} options={[['light', <Sun key="l" size={16} />], ['dark', <Moon key="d" size={16} />]]} onChange={(v) => d({ t: 'set', patch: { theme: v } })} /></div>
        <button className="round soft" aria-label="sound" onClick={() => d({ t: 'set', patch: { sound: !s.sound } })}>{s.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        <button className="round soft" aria-label="restart" onClick={() => d({ t: 'reset' })} data-testid="reset"><RotateCcw size={18} /></button>
      </div>
    </>
  );
  return (
    <div className="shell">
      <aside className="panel" dir={rtl ? 'rtl' : 'ltr'}>
        <span className="logo" style={{ fontSize: 28 }} dir="ltr"><b style={{ color: 'var(--ink)' }}>X</b><b style={{ color: 'var(--orange)' }}>APP</b> <span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: 16, marginInlineStart: 6 }}>Chat</span></span>
        <p className="small">{L('Transport in Morocco by conversation: the customer talks (Darija, Arabic, French or English), shows a photo, taps a few cards, and gets offers. The driver side is a simple board of requests.', 'Le transport au Maroc par la conversation : le client parle (darija, arabe, français ou anglais), montre une photo, touche quelques cartes et reçoit des offres. Le chauffeur a un tableau simple de demandes.', 'النقل فالمغرب بالهضرة: الزبون كيهضر (بالدارجة، العربية، الفرنسية ولا الإنجليزية)، كيورّي تصويرة، كيضغط على شي بطاقات، وكتوصلو العروض. الشيفور عندو لوحة بسيطة ديال الطلبات.')}</p>
        {controls}
        <div className="card flat small" style={{ color: 'var(--ink)' }}>{L('Try: «بغيت نصيفط حوايج ديال الدار من الدار البيضاء للداخلة» (by voice or text), or tap the camera. Send the request, then switch to Driver: it’s there. Accept it, switch back, and accept the driver’s offer in the chat.', 'Essayez : « Je veux envoyer un frigo de Casa à Rabat demain » (voix ou texte), ou touchez la caméra. Envoyez, passez en Chauffeur : la demande y est. Acceptez, revenez, et acceptez l’offre dans le chat.', 'جرّب: «بغيت نصيفط حوايج ديال الدار من الدار البيضاء للداخلة» (بالصوت ولا بالكتابة)، ولا ضغط على الكاميرا. صيفط الطلب، دوز للشيفور: غادي تلقاه. قبلو، رجع، وقبل العرض فالشات.')}</div>
        <p className="panel-note">{L('Other drivers and customers are samples. With Claude on this page the assistant is real AI and reads real photos; otherwise a built-in demo understanding answers, and the chat header says which.', 'Les autres chauffeurs et clients sont des exemples. Avec Claude sur cette page, l’assistant est une vraie IA qui lit les vraies photos ; sinon une compréhension de démo répond, et l’en-tête du chat l’indique.', 'الشيفورات والزبناء الآخرين أمثلة. مع Claude فهاد الصفحة، المساعد ذكاء حقيقي وكيقرا التصاور الحقيقية؛ وإلا كيجاوب فهم تجريبي، والراس ديال الشات كيقول ليك شمن واحد.')}</p>
      </aside>
      <div className="stage">
        <div className="phone" dir={rtl ? 'rtl' : 'ltr'}>
          <div className="notch" />
          <div className="screen-root">
            <div className="statusbar"><span>9:41</span><span /></div>
            {s.role === 'customer' ? <CustomerChat /> : <DriverBoard />}
            <Toasts role={s.role} />
          </div>
        </div>
      </div>
      <button className="demo-fab" aria-label="demo" onClick={() => setDemo(true)} data-testid="demo-fab"><Settings2 size={18} /></button>
      {demo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 95 }} dir={rtl ? 'rtl' : 'ltr'}>
          <div className="scrim" onClick={() => setDemo(false)} />
          <div className="sheet"><div className="grab" /><div className="col" style={{ gap: 14, paddingBottom: 8 }}>{controls}<button className="btn md" onClick={() => setDemo(false)}>OK</button></div></div>
        </div>
      )}
    </div>
  );
}

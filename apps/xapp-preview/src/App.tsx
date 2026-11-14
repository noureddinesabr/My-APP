import { useEffect, useState } from 'react';
import { Settings2, Moon, Sun, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { AppProvider, useApp, type Role } from './store';
import { useT } from './i18n';
import { NavCtx, Seg, Sheet, StatusBar, useNavState } from './ui';
import { CustomerApp } from './customer';
import { DriverApp } from './driver';
import { AdminApp } from './admin';
import { SAMPLE_ROOM_ITEMS, PHOTOS } from './data';
import { uid } from './store';
import { prepareClaude } from './claude';

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { s, d } = useApp();
  const { lang, rtl, p } = useT();
  const cNav = useNavState('home');
  const dNav = useNavState('home');
  const [demo, setDemo] = useState(false);
  useEffect(() => { prepareClaude(); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [s.theme, lang, rtl]);
  const role = s.role;
  const setRole = (r: Role) => d({ t: 'set', patch: { role: r } });
  /** Demo shortcut: a ready request (sample room photo, Maarif → Ain Sebaa) so offers arrive at once. */
  const quickRequest = () => {
    d({ t: 'resetDraft' });
    d({ t: 'draft', patch: { photos: [{ id: uid(), src: PHOTOS.room, user: false }], items: SAMPLE_ROOM_ITEMS.map((x) => ({ ...x, photo: 0 })), ai: 'sample', to: 'ainsebaa', helpers: 2 } });
    d({ t: 'publish' });
    setRole('customer');
    cNav.reset('home', { name: 'offers' });
  };
  const jumpC: [string, () => void][] = [
    [p(['Home', 'Accueil', 'الرئيسية']), () => cNav.reset('home')],
    [p(['Camera', 'Caméra', 'الكاميرا']), () => { d({ t: 'resetDraft' }); cNav.reset('home', { name: 'capture' }); }],
    [p(['AI result', 'Résultat IA', 'نتيجة الذكاء']), () => { d({ t: 'draft', patch: { photos: [{ id: uid(), src: PHOTOS.room, user: false }], items: SAMPLE_ROOM_ITEMS, ai: 'sample' } }); cNav.reset('home', { name: 'items' }); }],
    [p(['Offers (quick request)', 'Offres (demande rapide)', 'العروض (طلب سريع)']), quickRequest],
    [p(['My requests', 'Mes demandes', 'طلباتي']), () => cNav.reset('requests')],
    [p(['Messages', 'Messages', 'الرسائل']), () => cNav.reset('messages')],
    [p(['Profile', 'Profil', 'حسابي']), () => cNav.reset('profile')],
  ];
  const jumpD: [string, () => void][] = [
    [p(['Home', 'Accueil', 'الرئيسية']), () => dNav.reset('home')],
    [p(['Voice assistant', 'Assistant vocal', 'المساعد الصوتي']), () => dNav.reset('home', { name: 'voice' })],
    [p(['Load details', 'Détail chargement', 'تفاصيل الطلب']), () => dNav.reset('home', { name: 'load', arg: 'L1' })],
    [p(['Active trip', 'Trajet en cours', 'الرحلة الجارية']), () => dNav.reset('home', { name: 'trip', arg: 'B1' })],
    [p(['Trips', 'Trajets', 'الرحلات']), () => dNav.reset('trips')],
    [p(['Earnings', 'Gains', 'المداخيل']), () => dNav.reset('earnings')],
    [p(['Profile & vehicle', 'Profil et véhicule', 'الحساب والطوموبيل']), () => dNav.reset('profile')],
  ];
  const controls = (
    <>
      <div>
        <div className="lbl">{p(['View', 'Vue', 'العرض'])}</div>
        <Seg<Role> value={role} options={[['customer', p(['Customer', 'Client', 'زبون'])], ['driver', p(['Driver', 'Chauffeur', 'شيفور'])], ['admin', 'Admin']]} onChange={setRole} />
      </div>
      <div>
        <div className="lbl">{p(['Language', 'Langue', 'اللغة'])}</div>
        <Seg value={s.lang} options={[['en', 'EN'], ['fr', 'FR'], ['ar', 'ع']]} onChange={(v) => d({ t: 'set', patch: { lang: v } })} />
      </div>
      <div className="row">
        <div className="grow"><Seg value={s.theme} options={[['light', <Sun key="l" size={16} />], ['dark', <Moon key="d" size={16} />]]} onChange={(v) => d({ t: 'set', patch: { theme: v } })} /></div>
        <button className="iconbtn" aria-label="sound" onClick={() => d({ t: 'set', patch: { sound: !s.sound } })}>{s.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        <button className="iconbtn" aria-label="reset" onClick={() => { d({ t: 'reset' }); cNav.reset('home'); dNav.reset('home'); }}><RotateCcw size={18} /></button>
      </div>
    </>
  );
  return (
    <div className="shell" data-theme={s.theme}>
      <aside className="panel" dir={rtl ? 'rtl' : 'ltr'}>
        <div>
          <div className="row" style={{ gap: 10 }}><div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(150deg,#c2410c,#f59e0b)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 19 }}>X</div><h1>Xapp</h1></div>
          <p className="small" style={{ marginTop: 8 }}>{p(['Interactive preview of the freight marketplace. Customer, driver and admin share one live market: what one side does, the other sees.', 'Aperçu interactif de la plateforme de transport. Client, chauffeur et admin partagent le même marché en direct.', 'معاينة تفاعلية لمنصة النقل. الزبون والشيفور والإدارة كيشاركو نفس السوق مباشرة.'])}</p>
        </div>
        {controls}
        {role !== 'admin' && (
          <div>
            <div className="lbl">{p(['Jump to', 'Aller à', 'سير لـ'])}</div>
            <div className="jump">{(role === 'customer' ? jumpC : jumpD).map(([l, f]) => <button key={l} onClick={f}>{l}</button>)}</div>
          </div>
        )}
        <div className="card flat tight small" style={{ marginTop: 'auto' }}>
          {p(['Try it: post a request as the customer, then switch to Driver: your request is there as a new load. Send an offer, switch back, accept it, and run the trip from the driver side.', 'Essayez : publiez une demande comme client, puis passez en Chauffeur : elle y est. Envoyez une offre, revenez, acceptez-la, et faites le trajet côté chauffeur.', 'جرّب: صيفط طلب كزبون، من بعد دوز للشيفور: الطلب ديالك كاين. صيفط عرض، رجع، قبلو، ودير الرحلة من جهة الشيفور.'])}
        </div>
        <p className="tiny">{p(['Camera, GPS and other people are simulated. Photo reading and voice use real AI when this page allows it.', 'Caméra, GPS et autres personnes sont simulés. La lecture des photos et la voix utilisent une vraie IA quand la page le permet.', 'الكاميرا والـGPS والناس الآخرين محاكاة. قراءة التصاور والصوت كيستعملو ذكاء حقيقي ملي الصفحة كتسمح.'])}</p>
      </aside>
      <div className={`stage ${role === 'admin' ? 'wide' : ''}`}>
        {role === 'admin' ? (
          <div dir={rtl ? 'rtl' : 'ltr'} style={{ width: '100%' }}><AdminApp /></div>
        ) : (
          <div className="phone" data-role={role} dir={rtl ? 'rtl' : 'ltr'}>
            <div className="notch" />
            <div className="screen-root">
              <StatusBar />
              <NavCtx.Provider value={role === 'customer' ? cNav : dNav}>
                {role === 'customer' ? <CustomerApp /> : <DriverApp />}
              </NavCtx.Provider>
            </div>
          </div>
        )}
      </div>
      <button className="demo-fab" aria-label="demo" onClick={() => setDemo(true)} data-testid="demo-fab"><Settings2 size={20} /></button>
      {demo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 95 }} dir={rtl ? 'rtl' : 'ltr'}>
          <Sheet open onClose={() => setDemo(false)} title="Xapp · demo">
            <div className="col" style={{ gap: 14, paddingBottom: 10 }}>
              {controls}
              {role !== 'admin' && <div className="jump" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{(role === 'customer' ? jumpC : jumpD).map(([l, f]) => <button key={l} className="chip" onClick={() => { f(); setDemo(false); }}>{l}</button>)}</div>}
            </div>
          </Sheet>
        </div>
      )}
    </div>
  );
}

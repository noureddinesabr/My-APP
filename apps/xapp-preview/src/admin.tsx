import { useState } from 'react';
import { LayoutDashboard, Map as MapIcon, Truck, Users, ClipboardList, Handshake, Route as RouteIcon, ShieldCheck, FileText, Percent, Receipt, Wallet, BarChart3, AlertTriangle, Bell, Settings, Check, X, Send, ArrowLeft } from 'lucide-react';
import { DRIVERS, ME, PLACES, placeById, VEHICLES, WEEK_TRIPS, INVOICES, driverById, type L3 } from './data';
import { kgOf, useApp } from './store';
import { dh, num, useT } from './i18n';
import { Avatar, Seg } from './ui';
import { sfx } from './sound';

/**
 * Xapp's back office, on a desktop screen. It reads the same marketplace as the two apps: what the
 * customer posts and what the driver does shows up here at once, and the commission set here
 * changes the driver's earnings straight away.
 */
type Sec = 'overview' | 'map' | 'drivers' | 'customers' | 'requests' | 'offers' | 'trips' | 'verify' | 'docs' | 'commission' | 'invoices' | 'balances' | 'reports' | 'disputes' | 'notify' | 'settings';
const W: Record<string, L3> = {
  overview: ['Overview', 'Vue d’ensemble', 'نظرة عامة'], map: ['Live map', 'Carte en direct', 'الخريطة المباشرة'], drivers: ['Drivers', 'Chauffeurs', 'الشيفورات'], customers: ['Customers', 'Clients', 'الزبناء'],
  requests: ['Requests', 'Demandes', 'الطلبات'], offers: ['Offers', 'Offres', 'العروض'], trips: ['Trips', 'Trajets', 'الرحلات'], verify: ['Verification', 'Vérification', 'التحقق'], docs: ['Documents', 'Documents', 'الوثائق'],
  commission: ['Commission', 'Commission', 'العمولة'], invoices: ['Invoices', 'Factures', 'الفواتير'], balances: ['Balances', 'Soldes', 'الأرصدة'], reports: ['Reports', 'Rapports', 'التقارير'], disputes: ['Disputes', 'Litiges', 'النزاعات'],
  notify: ['Notifications', 'Notifications', 'الإشعارات'], settings: ['Settings', 'Réglages', 'الإعدادات'],
  openReq: ['Open requests', 'Demandes ouvertes', 'طلبات مفتوحة'], activeTrips: ['Active trips', 'Trajets en cours', 'رحلات جارية'], gmv: ['Cash volume (week)', 'Volume espèces (semaine)', 'حجم الكاش (السيمانة)'], due: ['Commission due', 'Commission due', 'العمولة المستحقة'],
  activity: ['Live activity', 'Activité en direct', 'النشاط المباشر'], status: ['Status', 'Statut', 'الحالة'], route: ['Route', 'Trajet', 'الطريق'], price: ['Price', 'Prix', 'الثمن'], driver: ['Driver', 'Chauffeur', 'الشيفور'], customer: ['Customer', 'Client', 'الزبون'],
  rating: ['Rating', 'Note', 'التقييم'], trips2: ['Trips', 'Trajets', 'الرحلات'], vehicle: ['Vehicle', 'Véhicule', 'الطوموبيل'], approve: ['Approve', 'Valider', 'قبول'], reject: ['Reject', 'Refuser', 'رفض'], pending: ['Pending', 'En attente', 'كيتسنى'],
  approved: ['Approved', 'Validé', 'مقبول'], rate: ['Commission rate', 'Taux de commission', 'نسبة العمولة'], rateNote: ['Applies to new earnings immediately. Past invoices keep their rate.', 'S’applique tout de suite aux nouveaux gains. Les anciennes factures gardent leur taux.', 'كتطبق دغيا على المداخيل الجديدة. الفواتير القديمة كتبقى بالنسبة ديالها.'],
  example: ['Example: a 300 DH trip', 'Exemple : un trajet à 300 DH', 'مثال: رحلة بـ 300 درهم'], driverKeeps: ['Driver keeps', 'Le chauffeur garde', 'الشيفور كيبقى ليه'], xapp: ['Xapp', 'Xapp', 'Xapp'],
  sendSms: ['Send by SMS / WhatsApp', 'Envoyer par SMS / WhatsApp', 'صيفط ف SMS / واتساب'], sent: ['Sent', 'Envoyé', 'تصيفط'], outstanding: ['Outstanding', 'Impayé', 'باقي'], paid: ['Paid', 'Payé', 'مخلّص'],
  preview: ['Preview data · connected to the two apps', 'Données d’aperçu · reliées aux deux applis', 'بيانات المعاينة · مربوطة بالتطبيقين'], back: ['Back to the app', 'Retour à l’appli', 'رجوع للتطبيق'],
  broadcast: ['Message to all drivers', 'Message à tous les chauffeurs', 'ميساج لجميع الشيفورات'], broadcastPh: ['E.g. Heavy traffic on the A7 near Settat', 'Ex. Trafic dense sur l’A7 près de Settat', 'مثلاً: زحام فالأوطوروت قرب سطات'],
  cities: ['Cities served', 'Villes desservies', 'المدن'], langs: ['Languages', 'Langues', 'اللغات'], payment: ['Payment', 'Paiement', 'الخلاص'], cashOnly: ['Cash to driver · weekly commission invoice', 'Espèces au chauffeur · facture de commission hebdomadaire', 'كاش للشيفور · فاتورة العمولة كل سيمانة'],
  noDispute: ['Reported by the customer', 'Signalé par le client', 'بلّغ عليه الزبون'], weekBars: ['Cash volume by day', 'Volume par jour', 'الحجم حسب النهار'], offersN: ['Offers', 'Offres', 'العروض'],
  applicant: ['New applicant', 'Nouveau candidat', 'مترشح جديد'],
};

const APPLICANTS = [{ id: 'said', name: 'Said Ouali', vehicle: 'triporteur' as const, city: 'Casablanca', docs: ['docLicense', 'docReg', 'docId'] }];

export function AdminApp() {
  const { s, d } = useApp();
  const { p, lang } = useT();
  const [sec, setSec] = useState<Sec>('overview');
  const [sent, setSent] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const pct = Math.round(s.commission * 100);
  const open = s.reqs.filter((r) => r.status === 'open');
  const active = s.reqs.filter((r) => r.status === 'booked');
  const weekGross = WEEK_TRIPS.reduce((n, x) => n + x.gross, 0) + s.reqs.filter((r) => r.status === 'delivered').reduce((n, r) => n + (r.booked?.price ?? 0), 0);
  const fleet = [ME, ...DRIVERS];
  const driverWeek = (id: string) => (id === 'me' ? WEEK_TRIPS.reduce((n, x) => n + x.gross, 0) : id === 'youssef' ? 2480 : id === 'hamza' ? 1960 : 640) + s.reqs.filter((r) => r.status === 'delivered' && r.booked?.driverId === id).reduce((n, r) => n + r.booked!.price, 0);
  const totalDue = Math.round(fleet.reduce((n, x) => n + driverWeek(x.id), 0) * s.commission);
  const statusBadge = (st: string) => <span className={`badge ${st === 'open' ? 'acc' : st === 'booked' ? 'info' : st === 'delivered' ? 'ok' : ''}`}>{st === 'open' ? p(['Open', 'Ouverte', 'مفتوح']) : st === 'booked' ? p(['Booked', 'Réservée', 'محجوز']) : st === 'delivered' ? p(['Delivered', 'Livrée', 'توصل']) : p(['Cancelled', 'Annulée', 'ملغي'])}</span>;
  const approve = (key: string) => { d({ t: 'set', patch: { approvedDocs: [...s.approvedDocs, key] } }); sfx('success', s.sound); };
  const nav: [Sec, typeof LayoutDashboard][] = [['overview', LayoutDashboard], ['map', MapIcon], ['drivers', Truck], ['customers', Users], ['requests', ClipboardList], ['offers', Handshake], ['trips', RouteIcon], ['verify', ShieldCheck], ['docs', FileText], ['commission', Percent], ['invoices', Receipt], ['balances', Wallet], ['reports', BarChart3], ['disputes', AlertTriangle], ['notify', Bell], ['settings', Settings]];
  const reqTable = (rows = s.reqs) => (
    <div className="card tbl"><table><thead><tr><th>ID</th><th>{p(W.route)}</th><th>{p(W.customer)}</th><th>kg</th><th>{p(W.offersN)}</th><th>{p(W.price)}</th><th>{p(W.status)}</th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.id}><td className="tiny">{r.id}</td><td><b>{p(placeById(r.from).name)}</b> → {p(placeById(r.to).name)}</td><td>{r.mine ? 'Salma Idrissi' : r.customer}</td><td className="num">{num(kgOf(r))}</td><td className="num">{s.offers.filter((o) => o.reqId === r.id).length}</td><td className="num"><b>{dh(r.booked?.price ?? r.price, lang)}</b></td><td>{statusBadge(r.status)}</td></tr>)}
    </tbody></table></div>
  );
  const docRows: { key: string; who: string; doc: L3 }[] = [
    { key: 'me:photos', who: ME.name, doc: ['Vehicle photos', 'Photos du véhicule', 'تصاور الطوموبيل'] },
    ...APPLICANTS.flatMap((a) => [{ key: `${a.id}:license`, who: a.name, doc: ['Driving licence', 'Permis', 'البيرمي'] as L3 }, { key: `${a.id}:cin`, who: a.name, doc: ['National ID', 'CIN', 'البطاقة الوطنية'] as L3 }]),
  ];
  const DocQueue = () => (
    <div className="card tbl"><table><thead><tr><th>{p(W.driver)}</th><th>{p(W.docs)}</th><th>{p(W.status)}</th><th /></tr></thead><tbody>
      {docRows.map((x) => <tr key={x.key}><td><b>{x.who}</b></td><td>{p(x.doc)}</td><td>{s.approvedDocs.includes(x.key) ? <span className="badge ok">{p(W.approved)}</span> : <span className="badge warn">{p(W.pending)}</span>}</td><td style={{ textAlign: 'end' }}>{!s.approvedDocs.includes(x.key) && <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}><button className="btn sm" onClick={() => approve(x.key)} data-testid={`approve-${x.key}`}><Check size={15} />{p(W.approve)}</button><button className="btn sm ghost"><X size={15} /></button></span>}</td></tr>)}
    </tbody></table></div>
  );
  const Map = ({ h = 360 }: { h?: number }) => (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="map" style={{ height: h }}>
        <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
          <path d="M0 0 H300 C270 30 230 52 190 64 C150 76 110 98 72 132 C46 156 22 190 0 214 Z" fill="var(--map-water)" />
          {[60, 120, 180, 240, 300, 360].map((y) => <path key={y} d={`M0 ${y} Q200 ${y + 14} 400 ${y - 8}`} stroke="var(--map-road2)" strokeWidth="1.5" fill="none" />)}
          <path d="M0 300 C120 270 220 240 400 150" stroke="var(--map-road)" strokeWidth="7" fill="none" />
          <path d="M150 400 C170 300 200 200 260 90" stroke="var(--map-road)" strokeWidth="7" fill="none" />
          {s.reqs.filter((r) => r.status !== 'cancelled' && r.status !== 'delivered').map((r) => { const a = placeById(r.from); if (a.cx === undefined) return null; return <g key={r.id}><circle cx={a.cx} cy={a.cy} r="14" fill={r.status === 'open' ? '#ea580c' : '#2563eb'} opacity=".18" className="pulse" /><circle cx={a.cx} cy={a.cy} r="6" fill={r.status === 'open' ? '#ea580c' : '#2563eb'} stroke="#fff" strokeWidth="2" /></g>; })}
          {[[120, 200], [250, 150], [300, 260], [200, 300]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="9" fill="#047857" stroke="#fff" strokeWidth="2.5" /><path d={`M${x - 4} ${y + 1} h5 v-4 h2 l2 2 v2 h1 v1.5 h-10 z`} fill="#fff" /></g>)}
          {PLACES.filter((x) => x.cx !== undefined).map((x) => <text key={x.id} x={x.cx} y={x.cy! + 20} textAnchor="middle" className="label">{p(x.name)}</text>)}
        </svg>
      </div>
      <div className="row small" style={{ padding: '10px 14px', gap: 14 }}><span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: '#ea580c' }} />{p(W.openReq)}</span><span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: '#2563eb' }} />{p(W.activeTrips)}</span><span className="row" style={{ gap: 6 }}><span className="dot" style={{ background: '#047857' }} />{p(W.drivers)} · 4</span></div>
    </div>
  );
  const kpis: [L3, string, string][] = [[W.openReq, String(open.length), 'acc'], [W.activeTrips, String(active.length), 'info'], [W.gmv, dh(weekGross, lang), 'ok'], [W.due, dh(totalDue, lang), 'warn']];
  const Kpis = () => <div className="grid g4">{kpis.map(([l, v, tone]) => <div key={l[0]} className="card"><span className={`badge ${tone}`}>{p(l)}</span><div className="kv">{v}</div></div>)}</div>;
  const Commission = () => (
    <div className="card">
      <div className="between"><div className="h3">{p(W.rate)}</div><div className="kv" style={{ margin: 0 }} data-testid="rate">{pct}%</div></div>
      <input type="range" min={5} max={20} step={1} value={pct} onChange={(e) => d({ t: 'set', patch: { commission: Number(e.target.value) / 100 } })} data-testid="rate-slider" />
      <div className="between tiny"><span>5%</span><span>10% (default)</span><span>20%</span></div>
      <p className="small" style={{ marginTop: 10 }}>{p(W.rateNote)}</p>
      <div className="card flat tight" style={{ marginTop: 10 }}>
        <div className="small" style={{ fontWeight: 700 }}>{p(W.example)}</div>
        <div className="between small" style={{ marginTop: 6 }}><span>{p(W.driverKeeps)}</span><b>{dh(Math.round(300 * (1 - s.commission)), lang)}</b></div>
        <div className="between small"><span>{p(W.xapp)}</span><b>{dh(Math.round(300 * s.commission), lang)}</b></div>
      </div>
    </div>
  );
  const activity = [...s.offers.map((o) => ({ at: o.at, txt: `${driverById(o.driverId).name} → ${p(placeById(s.reqs.find((r) => r.id === o.reqId)!.from).name)} · ${dh(o.price, lang)}`, tone: o.status === 'accepted' ? 'ok' : 'acc', tag: o.status })), ...s.reqs.filter((r) => r.mine).map((r) => ({ at: r.createdAt, txt: `Salma Idrissi · ${p(placeById(r.from).name)} → ${p(placeById(r.to).name)}`, tone: 'info', tag: r.status }))].sort((a, b) => b.at - a.at).slice(0, 7);

  let content;
  switch (sec) {
    case 'overview':
      content = (
        <div className="grid">
          <Kpis />
          <div className="grid g2"><Map h={320} /><div className="grid"><Commission /></div></div>
          <div className="card"><div className="h3" style={{ marginBottom: 10 }}>{p(W.activity)}</div>{activity.map((a, i) => <div key={i} className="between" style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line)' : 0 }}><span className="small" style={{ color: 'var(--text)' }}>{a.txt}</span><span className={`badge ${a.tone}`}>{a.tag}</span></div>)}{!activity.length && <p className="small">—</p>}</div>
          {reqTable(s.reqs.slice(0, 6))}
        </div>
      );
      break;
    case 'map': content = <Map h={560} />; break;
    case 'drivers':
    case 'verify':
      content = (
        <div className="grid">
          <div className="card tbl"><table><thead><tr><th>{p(W.driver)}</th><th>{p(W.vehicle)}</th><th>{p(W.rating)}</th><th>{p(W.trips2)}</th><th>{p(W.status)}</th><th /></tr></thead><tbody>
            {fleet.map((x) => <tr key={x.id}><td><span className="row"><Avatar d={x} size="sm" /><b>{x.name}</b></span></td><td>{p(VEHICLES[x.vehicle].name)} · <span dir="ltr">{x.plate}</span></td><td>★ {x.rating}</td><td className="num">{x.trips}</td><td><span className="badge ok">{p(W.approved)}</span></td><td /></tr>)}
            {APPLICANTS.map((a) => <tr key={a.id}><td><span className="row"><div className="av sm" style={{ background: '#64748b' }}>SO</div><b>{a.name}</b> <span className="badge info">{p(W.applicant)}</span></span></td><td>{p(VEHICLES[a.vehicle].name)}</td><td>—</td><td>0</td><td>{s.approvedDocs.includes(`${a.id}:all`) ? <span className="badge ok">{p(W.approved)}</span> : <span className="badge warn">{p(W.pending)}</span>}</td><td style={{ textAlign: 'end' }}>{!s.approvedDocs.includes(`${a.id}:all`) && <button className="btn sm" onClick={() => approve(`${a.id}:all`)}><Check size={15} />{p(W.approve)}</button>}</td></tr>)}
          </tbody></table></div>
          <DocQueue />
        </div>
      );
      break;
    case 'docs': content = <DocQueue />; break;
    case 'customers':
      content = <div className="card tbl"><table><thead><tr><th>{p(W.customer)}</th><th>{p(W.requests)}</th><th>{p(W.status)}</th></tr></thead><tbody>{[['Salma Idrissi', s.reqs.filter((r) => r.mine).length], ...s.reqs.filter((r) => !r.mine).map((r) => [r.customer, 1])].map(([n, c], i) => <tr key={i}><td><b>{n}</b></td><td className="num">{c}</td><td><span className="badge ok">{p(W.approved)}</span></td></tr>)}</tbody></table></div>;
      break;
    case 'requests': content = reqTable(); break;
    case 'offers':
      content = <div className="card tbl"><table><thead><tr><th>{p(W.driver)}</th><th>{p(W.route)}</th><th>{p(W.price)}</th><th>{p(W.status)}</th></tr></thead><tbody>{s.offers.map((o) => { const r = s.reqs.find((x) => x.id === o.reqId)!; return <tr key={o.id}><td><b>{driverById(o.driverId).name}</b></td><td>{p(placeById(r.from).name)} → {p(placeById(r.to).name)}</td><td className="num"><b>{dh(o.price, lang)}</b> <span className="tiny">({o.turns.map((x) => x.price).join(' → ')})</span></td><td><span className={`badge ${o.status === 'accepted' ? 'ok' : o.status === 'declined' ? '' : 'acc'}`}>{o.status}</span></td></tr>; })}</tbody></table></div>;
      break;
    case 'trips': content = reqTable(s.reqs.filter((r) => r.booked)); break;
    case 'commission': content = <div className="grid g2"><Commission /><Kpis /></div>; break;
    case 'invoices':
    case 'balances':
      content = (
        <div className="card tbl"><table><thead><tr><th>{p(W.driver)}</th><th>{p(W.gmv)}</th><th>{p(W.due)} ({pct}%)</th><th>{p(W.status)}</th><th /></tr></thead><tbody>
          {fleet.map((x) => { const due = Math.round(driverWeek(x.id) * s.commission); return <tr key={x.id}><td><b>{x.name}</b></td><td className="num">{dh(driverWeek(x.id), lang)}</td><td className="num"><b>{dh(due, lang)}</b></td><td><span className="badge warn">{p(W.outstanding)}</span></td><td style={{ textAlign: 'end' }}><button className="btn sm ghost" disabled={sent.includes(x.id)} onClick={() => { setSent([...sent, x.id]); sfx('send', s.sound); }}>{sent.includes(x.id) ? <><Check size={15} />{p(W.sent)}</> : <><Send size={15} />{p(W.sendSms)}</>}</button></td></tr>; })}
          {INVOICES.map((i) => <tr key={i.id}><td className="tiny">{ME.name} · {i.id}</td><td className="num">{dh(i.gross, lang)}</td><td className="num">{dh(Math.round(i.gross * 0.1), lang)}</td><td><span className="badge ok">{p(W.paid)}</span></td><td /></tr>)}
        </tbody></table></div>
      );
      break;
    case 'reports': {
      const days = [440, 650, 220, 590, 500, s.reqs.filter((r) => r.status === 'delivered').reduce((n, r) => n + (r.booked?.price ?? 0), 0), 0];
      const mx = Math.max(...days, 1);
      content = <div className="grid"><Kpis /><div className="card"><div className="h3">{p(W.weekBars)}</div><div className="bars" style={{ height: 220, marginTop: 16 }}>{days.map((v, i) => <div key={i}><span className="tiny num">{v || ''}</span><i className={i === 5 ? 'on' : ''} style={{ height: `${Math.max(3, (v / mx) * 85)}%` }} /><span className="tiny">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span></div>)}</div></div></div>;
      break;
    }
    case 'disputes': {
      const list = s.reqs.filter((r) => r.problem);
      content = <div className="card tbl"><table><thead><tr><th>{p(W.route)}</th><th>{p(W.driver)}</th><th>{p(W.noDispute)}</th></tr></thead><tbody>{list.map((r) => <tr key={r.id}><td>{p(placeById(r.from).name)} → {p(placeById(r.to).name)}</td><td>{driverById(r.booked!.driverId).name}</td><td>{r.problem}</td></tr>)}<tr><td>Gauthier → Ain Sebaa</td><td>Karim E.</td><td className="small">“Late by 40 minutes” · {p(['resolved', 'résolu', 'تحل'])}</td></tr></tbody></table></div>;
      break;
    }
    case 'notify':
      content = (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="h3">{p(W.broadcast)}</div>
          <div className="field" style={{ marginTop: 10 }}><input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={p(W.broadcastPh)} /></div>
          <button className="btn md" style={{ marginTop: 10 }} disabled={!msg.trim()} onClick={() => { d({ t: 'toast', toast: { text: msg, tone: 'info', role: 'driver' } }); setMsg(''); sfx('send', s.sound); }}><Send size={17} />{p(W.sendSms)}</button>
        </div>
      );
      break;
    case 'settings':
      content = (
        <div className="grid g2">
          <div className="card col"><div className="h3">{p(W.cities)}</div><div className="chips wrap">{['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Agadir', 'Fès', 'Mohammedia', 'El Jadida'].map((c) => <span key={c} className="chip on">{c}</span>)}</div><div className="h3">{p(W.langs)}</div><Seg value={s.lang} options={[['en', 'English'], ['fr', 'Français'], ['ar', 'العربية']]} onChange={(v) => d({ t: 'set', patch: { lang: v } })} /><div className="h3">{p(W.payment)}</div><p className="small">{p(W.cashOnly)}</p></div>
          <Commission />
        </div>
      );
      break;
  }
  return (
    <div className="admin" data-role="admin">
      <nav>
        <div className="brand row" style={{ padding: '4px 10px 16px', gap: 8 }}><div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--hero)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800 }}>X</div><b style={{ fontSize: 17 }}>Xapp Admin</b></div>
        {nav.map(([id, I]) => <button key={id} className={sec === id ? 'on' : ''} onClick={() => setSec(id)} data-testid={`adm-${id}`}><I size={17} />{p(W[id])}</button>)}
        <button onClick={() => d({ t: 'set', patch: { role: 'customer' } })} style={{ marginTop: 'auto' }}><ArrowLeft size={17} className="flip" />{p(W.back)}</button>
      </nav>
      <main>
        <div className="between" style={{ marginBottom: 18 }}>
          <div><div className="h1" style={{ fontSize: 26 }}>{p(W[sec])}</div><div className="small">{p(W.preview)}</div></div>
          <span className="badge ok" style={{ height: 28 }}><span className="dot live" />Live</span>
        </div>
        {content}
      </main>
    </div>
  );
}

// Xapp Freight full tour (owner's 25 reports, 18 Nov 2026): every page, captured in ar/fr/en x light/dark,
// with automatic checks for cut text, text off screen and Latin words in Arabic.
const { chromium } = require('playwright');
const IMG = (process.env.TOUR_IMAGES || __dirname + '/images') + '/';
const fs = require('fs');
const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const report = [];
const H = Number(process.argv[4] || 780);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 360, height: H } });
  await ctx.addInitScript(() => {
    const scan = { summary: 'Small home move', goods: ['household'], items: [{ name: 'Sofa', count: 1, kgEach: 60, sure: true }, { name: 'Boxes', count: 8, kgEach: 12, sure: true }], vehicle: 'smallVan', care: ['fragile'], helpers: 1 };
    window.claude = { use: async (n) => (n === 'sample' ? { limits: async () => ({ images: { maxCount: 4 } }), json: async () => new Promise((r) => setTimeout(() => r(scan), 2500)) } : null) };
  });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message));
  let n = 0;
  const checks = () => p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
    const cut = []; const off = []; const latin = [];
    document.querySelectorAll('div[dir], div').forEach((e) => {
      if (!e.childNodes.length || e.children.length > 0) return; // leaf text nodes only
      const t = (e.innerText || '').trim(); if (!t || !vis(e)) return;
      const s = getComputedStyle(e);
      if ((s.webkitLineClamp && s.webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 2) || (s.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 2)) cut.push(t.slice(0, 60));
      const r = e.getBoundingClientRect();
      let sc = false; for (let a = e.parentElement; a; a = a.parentElement) { const st = getComputedStyle(a); if (st.overflowX === 'auto' || st.overflowX === 'scroll') { sc = true; break; } }
      if (!sc && (r.right > innerWidth + 2 || r.left < -2)) off.push(t.slice(0, 40));
      if (document.documentElement.dir === 'rtl') { const w = t.match(/[A-Za-z]{4,}/g); if (w) latin.push(w.join(' ')); }
    });
    return { cut: [...new Set(cut)], off: [...new Set(off)], latin: [...new Set(latin)].slice(0, 15) };
  });
  const setMode = async (lang, look) => { await p.evaluate(([l, a]) => { window.__xapp.setLanguage(l); window.__xapp.setAppearance(a); }, [lang, look]); await p.waitForTimeout(550); };
  const cap = async (name, all = true) => {
    n++; const id = String(n).padStart(2, '0') + '-' + name;
    const combos = all && !process.env.TOUR_QUICK ? [['ar', 'light'], ['fr', 'light'], ['en', 'light'], ['ar', 'dark'], ['en', 'dark']] : [['en', 'light']];
    for (const [l, a] of combos) {
      await setMode(l, a); await p.waitForTimeout(250);
      await p.screenshot({ path: `${out}/${id}.${l}.${a}.png` });
      const c = await checks(); report.push({ id, l, a, ...c });
    }
    await setMode('en', 'light');
  };
  const shot = (name) => cap(name);
  const dump = async (n) => { if (!process.env.TOUR_DUMP) return; const r = 0; }; const dump0 = async (n) => { const r = await p.evaluate(() => [...document.querySelectorAll('[role=button],[role=checkbox],[role=radio],[role=tab],button,input,textarea')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0}).map(e => (e.getAttribute('role')||e.tagName)+':'+(e.getAttribute('aria-label')||e.innerText||e.placeholder||'').replace(/\s+/g,' ').slice(0,70))); console.log('==',n, JSON.stringify(r)); };
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(900); await cap('00-intro', false); await p.waitForTimeout(3600);
  await shot('01-camera'); await dump('camera');
  p.once('filechooser', (fc) => fc.setFiles(IMG + '4.jpg')); await p.getByLabel('Take a photo').last().click(); await p.waitForTimeout(1200);
  await shot('02-cam-photo'); await dump('cam-photo');
  await p.getByText(/Scan & estimate/).first().click(); await p.waitForTimeout(5000);
  await shot('03-saw'); await dump('saw');
  await p.mouse.move(180, H/2); await p.mouse.wheel(0, 700); await p.waitForTimeout(400); await shot('04-saw-bottom');
  await p.getByRole('button', { name: 'Continue', exact: true }).click(); await p.waitForTimeout(800); await shot('05-route-missing');
  await p.getByRole('button', { name: /^From:/ }).click(); await p.waitForTimeout(900);
  await p.getByRole('textbox', { name: 'From' }).fill('Derb Omar'); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Derb Omar/ }).last().click(); await p.waitForTimeout(600);
  await p.getByRole('button', { name: /^To:/ }).click(); await p.waitForTimeout(800);
  await p.getByRole('textbox', { name: 'To' }).fill('Ain Sebaa'); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Ain Sebaa/ }).last().click(); await p.waitForTimeout(600);
  await shot('06-route-filled');
  // Owner's edit #5: a street or neighbourhood inside the destination.
  await p.getByRole('button', { name: /^Street or neighbourhood · Ain Sebaa/ }).click(); await p.waitForTimeout(900); await shot('06b-area-picker');
  await p.getByRole('textbox', { name: 'Street or neighbourhood' }).fill('Sidi'); await p.waitForTimeout(700); await shot('06c-area-search');
  await p.getByRole('button', { name: /Use “.?Sidi/ }).first().click(); await p.waitForTimeout(600); await shot('06d-area-set');
  await p.getByRole('button', { name: 'Continue', exact: true }).click(); await p.waitForTimeout(900);
  await shot('07-booking'); await dump('booking');
  await p.mouse.move(180, H/2); await p.mouse.wheel(0, 700); await p.waitForTimeout(400); await shot('08-booking-bottom');
  await p.getByRole('button', { name: 'Continue to the price' }).click(); await p.waitForTimeout(700); await shot('09-missing-floors');
  // Owner's edit #3: the floors are asked here now.
  await p.getByRole('radio', { name: 'Pickup floor: Ground floor' }).click(); await p.getByRole('radio', { name: 'Destination floor: Another floor' }).click(); await p.waitForTimeout(300);
  await p.getByRole('radio', { name: 'Destination floor · Elevator: No' }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Continue to the price' }).click(); await p.waitForTimeout(700); await shot('09b-missing-party');
  // Owner's edit #9 (Option A): at the pickup, does that person ride, at the destination.
  await p.getByRole('radio', { name: 'At the pickup: Me' }).click(); await p.waitForTimeout(300);
  await p.getByRole('radio', { name: 'Do you ride with the driver? Yes' }).click(); await p.waitForTimeout(300); await shot('10-rides-yes');
  await p.waitForTimeout(1200); await shot('10a-who-folded');
  await p.getByRole('button', { name: 'Who is there · Change' }).click(); await p.waitForTimeout(400);
  await p.getByRole('radio', { name: 'Do you ride with the driver? No' }).click(); await p.waitForTimeout(300);
  await p.getByRole('radio', { name: 'At the destination: Someone else' }).click(); await p.waitForTimeout(300);
  await p.getByLabel('At the destination · Their name (optional)').fill('Khalid'); await p.waitForTimeout(300);
  await shot('10b-someone');
  await p.getByRole('radio', { name: 'Who pays the driver? Me' }).click(); await p.waitForTimeout(200);
  await p.getByRole('radio', { name: 'Another day' }).click(); await p.waitForTimeout(700); await shot('11-wheels');
  await p.getByLabel('OK').last().click(); await p.waitForTimeout(500); await shot('12-when-set');
  await p.getByRole('button', { name: 'Continue to the price' }).click(); await p.waitForTimeout(1500); await shot('13-price'); await dump('price');
  await p.mouse.move(180, H/2); await p.mouse.wheel(0, 700); await p.waitForTimeout(400); await shot('14-price-bottom');
  await p.getByText('Send to drivers', { exact: true }).click(); await p.waitForTimeout(2500); await shot('15-waiting'); await dump('waiting');
  await p.waitForTimeout(12000); await shot('16-offers'); await dump('offers');
  const bars = async () => { if (!(await p.getByTestId('role-driver').isVisible().catch(() => false))) { await p.getByLabel('Menu').first().click().catch(() => {}); await p.waitForTimeout(500); } };
  await bars(); await p.getByTestId('role-driver').click(); await p.waitForTimeout(1200);
  p.once('filechooser', (fc) => fc.setFiles(IMG + '4.jpg')); await p.getByRole('button', { name: 'From the gallery' }).first().click(); await p.waitForTimeout(1300);
  await p.getByLabel('Your name').fill('Hamid'); await p.getByLabel('Phone', { exact: true }).fill('0612345678');
  await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(600);
  await p.getByLabel('Number plate').fill('12345-A-6'); await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(600);
  for (let i = 0; i < 4; i++) { p.once('filechooser', (fc) => fc.setFiles(IMG + '4.jpg')); await p.getByRole('button', { name: /Tap to add a photo$/ }).first().click(); await p.waitForTimeout(1300); }
  await p.getByRole('button', { name: 'Finish' }).click(); await p.waitForTimeout(800);
  await shot('20-work'); await dump('work');
  await p.getByRole('checkbox', { name: 'Yes, always' }).click(); await p.getByRole('checkbox', { name: 'Between cities' }).click(); await p.getByRole('checkbox', { name: 'Yes', exact: true }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(700); await shot('21-rules');
  await p.getByRole('button', { name: /I read them and I agree/ }).click(); await p.waitForTimeout(1200);
  await shot('22-driver-home'); await dump('driver-home');
  await p.getByRole('button', { name: /Derb Omar/ }).first().click(); await p.waitForTimeout(900); await shot('23-load-open'); await dump('load-open');
  await p.mouse.move(180, H/2); await p.mouse.wheel(0, 600); await p.waitForTimeout(400); await shot('24-load-open-b');

  await p.getByRole('button', { name: /Accept · / }).first().click(); await p.waitForTimeout(500);
  if (await p.getByRole('button', { name: 'Yes, I bring them' }).count()) { await shot('25-helpers-ask'); await p.getByRole('button', { name: 'Yes, I bring them' }).click(); }
  await p.waitForTimeout(400); await cap('26-offer-sent', false);
  await bars(); await p.getByTestId('role-customer').click(); await p.waitForTimeout(1500); await bars(); await p.getByRole('tab', { name: /Rides/ }).click(); await p.waitForTimeout(600); await shot('27-cust'); await dump('cust'); await p.getByRole('button').filter({ hasText: 'Derb Omar' }).first().click(); await p.waitForTimeout(1500);
  const cards = await p.getByRole('button', { name: /Details$/ }).all();
  for (const c of cards) { const l = await c.getAttribute('aria-label'); if (l.startsWith('Hamid')) { await c.click(); break; } }
  await p.waitForTimeout(700); await shot('28-hamid'); await dump('hamid');
  await p.getByRole('button', { name: 'Accept' }).last().click(); await p.waitForTimeout(500); await shot('29-confirm');
  await p.getByRole('button', { name: 'Yes, accept' }).click(); await p.waitForTimeout(1500);
  await bars(); await p.getByTestId('role-driver').click(); await p.waitForTimeout(1500); await shot('30-accepted-sheet'); await dump('accepted');
  await p.getByRole('button', { name: 'Open the trip and the map' }).click(); await p.waitForTimeout(1200); await shot('31-job');
  await p.getByRole('button', { name: 'I take it' }).click(); await p.waitForTimeout(800);
  await p.getByLabel('Xapp').first().click(); await p.waitForTimeout(900); await shot('32-home-job');
  await p.getByRole('button', { name: 'Announce a trip' }).click(); await p.waitForTimeout(900); await shot('33-plan'); await dump('plan');
  const sheet = p.locator('body');
  await p.getByRole('button', { name: /^From:/ }).last().click(); await p.waitForTimeout(800);
  await p.getByRole('textbox', { name: 'From' }).fill('Casablanca'); await p.waitForTimeout(800); await p.getByRole('button', { name: /Casablanca/ }).last().click(); await p.waitForTimeout(600);
  await p.getByRole('button', { name: /^To:/ }).last().click(); await p.waitForTimeout(800);
  await p.getByRole('textbox', { name: 'To' }).fill('Rabat'); await p.waitForTimeout(800); await p.getByRole('button', { name: /Rabat/ }).last().click(); await p.waitForTimeout(600);
  await p.getByRole('radio', { name: /Now/ }).last().click(); await p.waitForTimeout(300);
  await p.getByRole('checkbox', { name: 'No' }).last().click(); await p.waitForTimeout(300);
  await shot('34-plan-filled');
  await p.getByRole('button', { name: 'Announce', exact: true }).click(); await p.waitForTimeout(1000); await shot('35-story'); await dump('story');
  await p.getByRole('button', { name: /Rabat/ }).first().click(); await p.waitForTimeout(1200); await shot('36-story-view'); await dump('story-view');
  await p.getByLabel('Close').last().click(); await p.waitForTimeout(600);
  await p.getByRole('tab', { name: /Earnings/ }).click(); await p.waitForTimeout(800); await shot('37-earnings'); await dump('earn');
  await p.getByRole('tab', { name: /Account/ }).click(); await p.waitForTimeout(800); await shot('38-account'); await dump('account');
  fs.writeFileSync(out + '/report.json', JSON.stringify({ errs, report }, null, 1));
  console.log('done', n, 'errors', errs.slice(0, 5));
  await b.close();
})().catch(e => { console.error('FAILED', e.message.split('\n').slice(0,4).join(' | ')); process.exit(1); });

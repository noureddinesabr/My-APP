// Full screen tour: every page, captured in en/fr/ar x light/dark, with automatic checks.
const { chromium } = require('playwright');
const fs = require('fs');
const IMG = (process.env.TOUR_IMAGES || __dirname + '/images') + '/';
const out = process.argv[3]; const H = Number(process.argv[4] || 640); const W = Number(process.argv[5] || 360);
fs.mkdirSync(out, { recursive: true });
const report = [];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(() => {
    const scan = { summary: 'Small home move', goods: ['household'], items: [{ name: 'Sofa', count: 1, kgEach: 60, sure: true }, { name: 'Fridge', count: 1, kgEach: 70, sure: true }, { name: 'Boxes', count: 8, kgEach: 12, sure: true }, { name: 'Mirror', count: 1, kgEach: 10, sure: false }], vehicle: 'smallVan', care: ['fragile'], helpers: 1 };
    window.claude = { use: async (n) => (n === 'sample' ? { limits: async () => ({ images: { maxCount: 4 } }), json: async () => new Promise((r) => setTimeout(() => r(scan), 3500)) } : null) };
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const log = (...a) => console.log(...a);
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
    const combos = all ? [['ar', 'light'], ['fr', 'light'], ['en', 'light'], ['ar', 'dark'], ['en', 'dark']] : [['en', 'light']];
    for (const [l, a] of combos) {
      await setMode(l, a); await p.waitForTimeout(250);
      await p.screenshot({ path: `${out}/${id}.${l}.${a}.png` });
      const c = await checks(); report.push({ id, l, a, ...c });
    }
    await setMode('en', 'light');
  };
  const T = (s) => p.getByText(s, { exact: true });
  const mode = async (who) => { await p.getByLabel('Settings').click(); await p.waitForTimeout(500); await p.getByRole('radio', { name: new RegExp(who) }).click(); await p.waitForTimeout(1200); };
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(4500);
  n = 39;
  await T('Continue without photo').click(); await p.waitForTimeout(900);
  await p.getByRole('checkbox', { name: /^Furniture/ }).click(); await p.getByRole('checkbox', { name: 'Other things' }).click(); await p.waitForTimeout(400);
  await p.getByRole('textbox', { name: 'Other things' }).type('tank'); await p.waitForTimeout(400); await cap('kinds-other');
  await p.getByRole('textbox', { name: 'Other things' }).press('Enter'); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /^From:/ }).click(); await p.waitForTimeout(700); await p.getByRole('textbox', { name: 'From' }).fill('Maarif'); await p.waitForTimeout(700); await p.getByRole('button', { name: /Maarif/ }).last().click(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /^To:/ }).click(); await p.waitForTimeout(700); await p.getByRole('textbox', { name: 'To' }).fill('Hay Hassani'); await p.waitForTimeout(700); await p.getByRole('button', { name: /Hay Hassani/ }).last().click(); await p.waitForTimeout(500);
  await cap('kinds-route');
  await p.getByText(/Looks right/).click(); await p.waitForTimeout(900);
  await cap('card-byhand');
  await T('Send to drivers').click(); await p.waitForTimeout(1500);
  await mode('Driver'); await p.getByLabel('Your name').fill('Hamid'); await p.getByText(/Save and see loads/).click(); await p.waitForTimeout(900);
  await cap('driver-work');
  await p.getByRole('checkbox', { name: 'Yes, always' }).click(); await p.waitForTimeout(200);
  await p.getByRole('checkbox', { name: 'Between cities' }).click(); await p.waitForTimeout(200);
  await p.getByRole('checkbox', { name: 'Yes', exact: true }).click(); await p.waitForTimeout(300);
  await cap('driver-work-filled');
  await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(700);
  await cap('driver-rules');
  await p.getByRole('button', { name: /I read them and I agree/ }).click(); await p.waitForTimeout(800);
  await cap('driver-loads-2');
  await p.getByRole('button', { name: /^\+50$/ }).first().click(); await p.waitForTimeout(600);
  if (await p.getByRole('button', { name: 'Yes, I bring them' }).count()) { await cap('driver-helpers-ask'); await p.getByRole('button', { name: 'Yes, I bring them' }).click(); await p.waitForTimeout(600); }
  await mode('Customer'); await p.waitForTimeout(1000);
  await p.getByRole('tab', { name: /Offers/ }).click(); await p.waitForTimeout(500);
  await p.getByRole('button').filter({ hasText: 'Maarif' }).first().click(); await p.waitForTimeout(1500);
  const cards3 = await p.getByRole('button', { name: /Details$/ }).all();
  for (const c of cards3) { const l = await c.getAttribute('aria-label'); if (l.startsWith('Hamid')) { await c.click(); break; } }
  await p.waitForTimeout(700); await p.getByRole('button', { name: 'Accept' }).last().click(); await p.waitForTimeout(500); await p.getByRole('button', { name: 'Yes, accept' }).click(); await p.waitForTimeout(1500);
  await cap('track-real-driver');
  await mode('Driver'); await p.waitForTimeout(800); await cap('driver-home-job');
  await p.getByRole('button', { name: 'Open' }).first().click().catch(() => log('no open')); await p.waitForTimeout(1200); await cap('driver-job');
  await p.mouse.move(180, H / 2); await p.mouse.wheel(0, 900); await p.waitForTimeout(400); await cap('driver-job-bottom');
  // the job, step by step (no delivery code): on my way, arrived, loaded, arrived at the destination, handed over
  await p.getByRole('button', { name: "I'm on my way to the pickup" }).click(); await p.waitForTimeout(700);
  await p.getByRole('button', { name: "I've arrived at the pickup" }).click(); await p.waitForTimeout(700); await cap('driver-job-arrived');
  await p.getByRole('button', { name: "Loaded, let's go" }).click(); await p.waitForTimeout(700); await cap('driver-job-loaded');
  await p.getByRole('button', { name: "I've arrived", exact: true }).click(); await p.waitForTimeout(700); await cap('driver-job-dropoff');
  await mode('Customer'); await p.waitForTimeout(900); await cap('track-dropoff');
  await mode('Driver'); await p.waitForTimeout(700);
  await p.getByRole('button', { name: 'Open' }).first().click().catch(() => {}); await p.waitForTimeout(700);
  await p.getByRole('button', { name: 'Handed over', exact: true }).click(); await p.waitForTimeout(900); await cap('driver-after-handover');
  await mode('Customer'); await p.waitForTimeout(1200);
  if (!(await p.getByRole('button', { name: 'I received it' }).count())) { await p.getByRole('tab', { name: /Offers/ }).click(); await p.waitForTimeout(500); await cap('cust-offers-receipt'); await p.getByRole('button').filter({ hasText: 'Maarif' }).first().click(); await p.waitForTimeout(1500); }
  await cap('received-real');
  await p.getByRole('button', { name: 'I received it' }).click().catch(() => log('no received')); await p.waitForTimeout(1000); await cap('rated-real');
  await mode('Driver'); await p.waitForTimeout(700);
  await p.getByRole('button', { name: 'Add a trip' }).click().catch(() => log('no plan')); await p.waitForTimeout(500); await cap('driver-plan-form');
  await p.getByRole('button', { name: 'Cancel' }).last().click().catch(() => {}); await p.waitForTimeout(400);
  await p.getByRole('tab', { name: /Messages/ }).click(); await p.waitForTimeout(500); await p.getByRole('button', { name: /^Customer/ }).first().click().catch(() => log('no thread')); await p.waitForTimeout(600); await cap('driver-chat');
  await p.goBack(); await p.waitForTimeout(400);
  await p.getByRole('tab', { name: /Profile/ }).click(); await p.waitForTimeout(600); await cap('driver-profile-tab');
  await p.mouse.move(180, H / 2); await p.mouse.wheel(0, 900); await p.waitForTimeout(400); await cap('driver-profile-bottom');
  await p.getByRole('tab', { name: /Profile/ }).click(); await p.waitForTimeout(400);
  await p.getByRole('tab', { name: /Offers/ }).click(); await p.waitForTimeout(500); await cap('driver-offers-current');
  await p.getByRole('tab', { name: /History/ }).click().catch(() => {}); await p.waitForTimeout(400); await cap('driver-history');
  fs.writeFileSync(out + '/report2.json', JSON.stringify({ errs, report }, null, 1));
  log('done', n, 'errors', errs.slice(0, 5));
  await b.close();
})().catch((e) => { fs.writeFileSync(out + '/report2.json', JSON.stringify({ report }, null, 1)); console.error('FAILED', e.message.split('\n').slice(0, 5).join(' | ')); process.exit(1); });

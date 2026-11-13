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
  const pickFile = async (role, name) => { p.once('filechooser', (fc) => fc.setFiles(IMG + '4.jpg')); await p.getByRole(role, { name }).first().click(); await p.waitForTimeout(1300); };
  const signUp = async () => {
    await cap('driver-signup-1');
    await pickFile('button', 'From the gallery');
    await p.getByLabel('Your name').fill('Hamid'); await p.getByLabel('Phone', { exact: true }).fill('0612345678'); await p.waitForTimeout(300);
    await cap('driver-signup-1-filled');
    await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(600);
    await p.getByLabel('Number plate').fill('12345-A-6'); await p.waitForTimeout(300);
    await cap('driver-signup-2');
    await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(600);
    for (let i = 0; i < 4; i++) await pickFile('button', /Tap to add a photo$/);
    await cap('driver-signup-3');
    await p.getByRole('button', { name: 'Finish' }).click(); await p.waitForTimeout(800);
  };

  const mode = async (who) => { await p.getByLabel('Settings').click(); await p.waitForTimeout(500); await p.getByRole('radio', { name: new RegExp(who) }).click(); await p.waitForTimeout(1200); };
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(4500);
  await cap('home');
  p.once('filechooser', (fc) => fc.setFiles(IMG + '4.jpg')); await p.getByLabel('Take a photo').last().click(); await p.waitForTimeout(1200);
  p.once('filechooser', (fc) => fc.setFiles(IMG + '3.jpg')); await p.getByLabel('Take a photo').last().click(); await p.waitForTimeout(1200);
  await cap('photos-tray');
  await p.getByText(/Analyse/).first().click(); await p.waitForTimeout(1200);
  await cap('scanning', false);
  await p.waitForTimeout(5000);
  await cap('saw-top');
  await p.mouse.move(180, H / 2); await p.mouse.wheel(0, 700); await p.waitForTimeout(400);
  await cap('saw-bottom');
  await p.mouse.wheel(0, -2000);
  await T('Add item').click(); await p.waitForTimeout(600); await p.keyboard.type('fri'); await p.waitForTimeout(500);
  await cap('add-item');
  await p.getByLabel('Close').last().click(); await p.waitForTimeout(400);
  await p.getByLabel('Change the weight').click(); await p.waitForTimeout(400);
  await cap('weight-edit');
  await p.getByLabel('Change the weight').click(); await p.waitForTimeout(300);
  await p.getByText('Small van', { exact: true }).first().click(); await p.waitForTimeout(800);
  await cap('vehicle-picker');
  await p.goBack().catch(() => {}); await p.waitForTimeout(700);
  await p.getByRole('button', { name: /^From:/ }).click(); await p.waitForTimeout(900);
  await cap('place-picker');
  await p.getByRole('textbox', { name: 'From' }).fill('Derb'); await p.waitForTimeout(800);
  await cap('place-search');
  await p.getByRole('button', { name: /Derb Omar/ }).last().click(); await p.waitForTimeout(600);
  await p.getByRole('button', { name: /^To:/ }).click(); await p.waitForTimeout(800);
  await p.getByRole('textbox', { name: 'To' }).fill('Ain Sebaa'); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Ain Sebaa/ }).last().click(); await p.waitForTimeout(600);
  await cap('saw-route');
  await p.getByText(/Looks right/).click(); await p.waitForTimeout(900);
  await cap('card-top');

  await p.getByRole('radio').filter({ hasText: 'Another day' }).click(); await p.waitForTimeout(700);
  await cap('when-wheels');
  await p.getByLabel('OK').last().click(); await p.waitForTimeout(400);
  await p.getByRole('radio').filter({ hasText: 'Now' }).first().click().catch(() => log('no now radio')); await p.waitForTimeout(400);
  await p.mouse.move(180, H / 2); await p.mouse.wheel(0, 650); await p.waitForTimeout(400);
  await cap('card-helpers');
  await p.getByRole('radio', { name: 'Someone else' }).click(); await p.waitForTimeout(400);
  await p.getByLabel(/Their name/).fill('Khalid'); await p.getByLabel(/Their phone/).fill('0612345678'); await p.waitForTimeout(300);
  await p.getByRole('checkbox', { name: /At the pickup/ }).click(); await p.getByRole('checkbox', { name: /Waits at the destination/ }).click(); await p.getByRole('radio').filter({ hasText: /Khalid/ }).last().click(); await p.waitForTimeout(300);
  await cap('card-companion');
  await p.getByRole('radio', { name: /Shared/ }).click(); await p.waitForTimeout(300);
  await p.mouse.wheel(0, 500); await p.waitForTimeout(400); await cap('card-shared');
  await p.mouse.wheel(0, 650); await p.waitForTimeout(400);
  await cap('card-notes');
  await p.mouse.wheel(0, 1500); await p.waitForTimeout(400);
  await cap('card-price');
  await T('Send to drivers').click(); await p.waitForTimeout(2500);
  await cap('waiting');
  // driver side while the request is open
  await mode('Driver'); await cap('driver-setup');
  await signUp();
  await cap('driver-work');
  await p.getByRole('checkbox', { name: 'Yes, always' }).click(); await p.waitForTimeout(200);
  await p.getByRole('checkbox', { name: 'Between cities' }).click(); await p.waitForTimeout(200);
  await p.getByRole('checkbox', { name: 'Yes', exact: true }).click(); await p.waitForTimeout(300);
  await cap('driver-work-filled');
  await p.getByRole('button', { name: 'Continue' }).click(); await p.waitForTimeout(700);
  await cap('driver-rules');
  await p.getByRole('button', { name: /I read them and I agree/ }).click(); await p.waitForTimeout(800);
  await cap('driver-loads');
  await p.getByRole('button', { name: /Accept · / }).first().click(); await p.waitForTimeout(600);
  if (await p.getByRole('button', { name: 'Yes, I bring them' }).count()) { await cap('driver-helpers-ask'); await p.getByRole('button', { name: 'Yes, I bring them' }).click(); await p.waitForTimeout(600); }
  await p.getByRole('tab', { name: /Offers/ }).click(); await p.waitForTimeout(500); await cap('driver-offers-tab');
  await p.getByRole('tab', { name: /Offers/ }).click(); await p.waitForTimeout(300);
  await mode('Customer'); await p.waitForTimeout(13000);
  await p.getByRole('tab', { name: /Offers/ }).click(); await p.waitForTimeout(500); await cap('cust-offers-tab');
  await p.getByRole('button').filter({ hasText: 'Derb Omar' }).first().click(); await p.waitForTimeout(1500);
  await cap('offers');
  const cards = await p.getByRole('button', { name: /Details$/ }).all();
  for (const c of cards) { const l = await c.getAttribute('aria-label'); if (l.startsWith('Youssef')) { await c.click(); break; } }
  await p.waitForTimeout(700); await cap('offer-details');
  await p.getByRole('button', { name: 'Decline' }).last().click(); await p.waitForTimeout(500); await cap('decline-confirm');
  await p.getByRole('button', { name: 'Yes, decline' }).click(); await p.waitForTimeout(800); await cap('counter');
  await p.goBack().catch(() => {}); await p.waitForTimeout(700);
  const cards2 = await p.getByRole('button', { name: /Details$/ }).all();
  for (const c of cards2) { const l = await c.getAttribute('aria-label'); if (l.startsWith('Youssef')) { await c.click(); break; } }
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: 'Accept' }).last().click(); await p.waitForTimeout(500); await cap('accept-confirm');
  await p.getByRole('button', { name: 'Yes, accept' }).click(); await p.waitForTimeout(2500);
  await cap('track');
  await p.getByRole('button', { name: /^Cancel/ }).last().click(); await p.waitForTimeout(700); await cap('cancel-sheet'); await p.goBack(); await p.waitForTimeout(600);
  await p.getByRole('button', { name: /^Youssef\. / }).first().click(); await p.waitForTimeout(700); await cap('profile-sheet'); await p.goBack(); await p.waitForTimeout(600);
  await p.getByRole('button', { name: /Call .?Youssef/ }).first().click(); await p.waitForTimeout(700); await cap('call'); await p.getByRole('button', { name: 'End', exact: true }).click(); await p.waitForTimeout(500);
  await p.getByRole('tab', { name: /Messages/ }).click(); await p.waitForTimeout(600); await cap('messages-list');
  await p.getByRole('button', { name: /^Youssef, / }).first().click(); await p.waitForTimeout(600);
  await p.locator('textarea').last().fill('Hello, the door is blue'); await p.getByRole('button', { name: 'Send message' }).last().click(); await p.waitForTimeout(800);
  await cap('chat');
  await p.goBack(); await p.waitForTimeout(400); await p.getByRole('tab', { name: /Messages/ }).click().catch(() => {}); await p.waitForTimeout(400);
  await p.getByRole('tab', { name: /Profile/ }).click(); await p.waitForTimeout(600); await cap('cust-profile-tab');
  await p.getByRole('tab', { name: /Profile/ }).click(); await p.waitForTimeout(400);
  await p.getByLabel('Settings').click(); await p.waitForTimeout(600); await cap('settings');
  await p.mouse.move(180, H / 2); await p.mouse.wheel(0, 900); await p.waitForTimeout(400); await cap('settings-bottom');
  await p.goBack(); await p.waitForTimeout(500);
  await p.getByLabel('Choose the language').click(); await p.waitForTimeout(500); await cap('language-menu', false); await p.keyboard.press('Escape'); await p.mouse.click(30, H - 30); await p.waitForTimeout(400);
  // wait for the example trip to deliver
  for (let i = 0; i < 60; i++) { if ((await p.evaluate(() => document.body.innerText)).includes('I received it')) break; await p.waitForTimeout(3000); }
  await cap('received');
  await p.getByText("Received, but there's a problem").click(); await p.waitForTimeout(600); await cap('problem-sheet'); await p.goBack(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'I received it' }).click(); await p.waitForTimeout(1200);
  await cap('delivered');
  await p.getByRole('button', { name: '5 ★' }).click().catch(() => log('no stars')); await p.waitForTimeout(600); await cap('delivered-rated');
  await p.getByRole('button', { name: 'Move something else' }).click().catch(() => log('no move')); await p.waitForTimeout(900);
  // second request: no photo (kinds), accepted by the tester driver
  await T('Continue without photo').click(); await p.waitForTimeout(900); await cap('kinds');
  await p.getByRole('checkbox', { name: /^Furniture/ }).click(); await p.getByRole('checkbox', { name: 'Other things' }).click(); await p.waitForTimeout(400);
  await p.getByRole('textbox', { name: 'Other things' }).type('tank'); await p.waitForTimeout(400); await cap('kinds-other');
  await p.getByRole('textbox', { name: 'Other things' }).press('Enter');
  await p.getByRole('button', { name: /^From:/ }).click(); await p.waitForTimeout(700); await p.getByRole('textbox', { name: 'From' }).fill('Maarif'); await p.waitForTimeout(700); await p.getByRole('button', { name: /Maarif/ }).last().click(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /^To:/ }).click(); await p.waitForTimeout(700); await p.getByRole('textbox', { name: 'To' }).fill('Hay Hassani'); await p.waitForTimeout(700); await p.getByRole('button', { name: /Hay Hassani/ }).last().click(); await p.waitForTimeout(500);
  await p.getByText(/Looks right/).click(); await p.waitForTimeout(900);
  await p.getByRole('radio', { name: /No one/ }).click().catch(() => log('no companion')); await p.waitForTimeout(300); await p.getByRole('radio').filter({ hasText: /\bMe\s*$/ }).last().click().catch(() => log('no payer')); await p.waitForTimeout(300);
  await T('Send to drivers').click(); await p.waitForTimeout(1500);
  await mode('Driver'); await p.waitForTimeout(500); await cap('driver-loads-2');
  await p.getByRole('button', { name: /Accept · / }).first().click(); await p.waitForTimeout(600);
  if (await p.getByRole('button', { name: 'Yes, I bring them' }).count()) { await cap('driver-helpers-ask'); await p.getByRole('button', { name: 'Yes, I bring them' }).click(); await p.waitForTimeout(600); }
  await mode('Customer'); await p.waitForTimeout(1500);
  await cap('cust-after-offer-2', false);
  if (await p.getByText('Choose from gallery').isVisible().catch(() => false)) { await p.getByRole('tab', { name: /Offers/ }).click(); await p.waitForTimeout(500); await p.getByRole('button').filter({ hasText: 'Maarif' }).first().click(); await p.waitForTimeout(1500); }
  const cards3 = await p.getByRole('button', { name: /Details$/ }).all();
  for (const c of cards3) { const l = await c.getAttribute('aria-label'); if (l.startsWith('Hamid')) { await c.click(); break; } }
  await p.waitForTimeout(700); await p.getByRole('button', { name: 'Accept' }).last().click(); await p.waitForTimeout(500); await p.getByRole('button', { name: 'Yes, accept' }).click(); await p.waitForTimeout(1500);
  await mode('Driver'); await p.waitForTimeout(800); await cap('driver-home-job');
  await p.getByRole('button', { name: 'Open' }).first().click().catch(() => log('no open')); await p.waitForTimeout(1200); await cap('driver-job-take'); await p.getByRole('button', { name: 'I confirm, I take this trip' }).click().catch(() => log('no take')); await p.waitForTimeout(700); await cap('driver-job');
  await p.mouse.move(180, H / 2); await p.mouse.wheel(0, 900); await p.waitForTimeout(400); await cap('driver-job-bottom');
  await p.getByRole('tab', { name: /Profile/ }).click(); await p.waitForTimeout(600); await cap('driver-profile-tab');
  await p.getByRole('tab', { name: /Profile/ }).click(); await p.waitForTimeout(400);
  await p.getByRole('tab', { name: /Offers/ }).click(); await p.waitForTimeout(500); await p.getByRole('tab', { name: /History/ }).click().catch(() => {}); await p.waitForTimeout(400); await cap('driver-history');
  fs.writeFileSync(out + '/report.json', JSON.stringify({ errs, report }, null, 1));
  log('done', n, 'errors', errs.slice(0, 5));
  await b.close();
})().catch((e) => { fs.writeFileSync(out + '/report.json', JSON.stringify({ report }, null, 1)); console.error('FAILED', e.message.split('\n').slice(0, 5).join(' | ')); process.exit(1); });

/**
 * Renders the Xapp mark (assets/brand/mark.svg) to the app icon, Android adaptive icon
 * layers, splash image, favicon and the in-app intro image, with the browser that comes
 * with Playwright. Run: node scripts/make-logo.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'assets/brand/mark.svg'), 'utf8');
const out = (name) => path.join(root, 'assets/images', name);

// Variants: the full tile; the X alone (adaptive foreground / monochrome); tile + wordmark (splash).
const xOnly = (color) =>
  svg.replace(/<g id="tile">[\s\S]*?<\/g>/, '').replace(/url\(#rise\)/g, color).replace(/#FFFFFF/g, color);
const scaled = (inner, scale) =>
  inner.replace('<g id="x">', `<g id="x" transform="translate(${512 * (1 - scale)} ${512 * (1 - scale)}) scale(${scale})">`);
const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <g transform="translate(212 90) scale(0.586)">${svg.replace(/<\/?svg[^>]*>/g, '')}</g>
  <text x="512" y="900" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="200" fill="#FFFFFF" letter-spacing="-4">Xapp</text>
</svg>`;

const jobs = [
  { file: 'icon.png', size: 1024, svg },
  { file: 'favicon.png', size: 48, svg },
  { file: 'logo-mark.png', size: 512, svg },
  { file: 'splash-icon.png', size: 1024, svg: splash },
  { file: 'android-icon-foreground.png', size: 512, svg: scaled(xOnly('#FFFFFF'), 0.62) },
  { file: 'android-icon-monochrome.png', size: 432, svg: scaled(xOnly('#FFFFFF'), 0.62) },
  { file: 'android-icon-background.png', size: 512, svg: svg.replace(/<g id="x">[\s\S]*<\/g>\s*<\/svg>/, '</svg>').replace(/rx="230"/g, 'rx="0"') },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const job of jobs) {
    await page.setViewportSize({ width: job.size, height: job.size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${job.svg.replace('<svg ', `<svg width="${job.size}" height="${job.size}" `)}</body></html>`);
    await page.screenshot({ path: out(job.file), omitBackground: true, clip: { x: 0, y: 0, width: job.size, height: job.size } });
    console.log(job.file);
  }
  await browser.close();
})();
